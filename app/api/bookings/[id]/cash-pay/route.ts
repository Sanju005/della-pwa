import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sendPushNotificationToUser } from "@/lib/push-notifications";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { uploadStoredMedia } from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type BookingRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  service_label: string;
  quoted_amount?: number | null;
  booking_status:
    | "pending_provider_response"
    | "declined_by_provider"
    | "accepted"
    | "on_the_way"
    | "arrived"
    | "work_finished_by_provider"
    | "work_confirmed_by_user"
    | "final_payment_sent"
    | "cash_paid_by_user"
    | "payment_received_by_provider"
    | "completed"
    | "cancelled";
};

type CashPaymentPayload = {
  proofDataUrl?: string;
  proofFileName?: string;
  proofMimeType?: string;
};

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

function getAdminSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyCustomerRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 }),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json(
        { error: "This account is not a customer account." },
        { status: 403 },
      ),
    };
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json().catch(() => ({}))) as CashPaymentPayload;
  const params = await context.params;
  const { data: booking, error: bookingError } = await verified.adminClient
    .from("bookings")
    .select("id, customer_id, provider_id, service_label, quoted_amount, booking_status")
    .eq("id", params.id)
    .eq("customer_id", verified.profile.id)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking was not found." }, { status: 404 });
  }

  const bookingRow = booking as BookingRow;
  if (bookingRow.booking_status !== "final_payment_sent") {
    return NextResponse.json(
      { error: "Cash payment can only be confirmed after the provider sends the final amount." },
      { status: 400 },
    );
  }

  const timestamp = new Date().toISOString();
  const storedProofDataUrl = payload.proofDataUrl?.trim()
    ? await uploadStoredMedia(verified.adminClient, {
        bucket: "payment-proofs",
        dataUrl: payload.proofDataUrl,
        ownerId: verified.profile.id,
        pathParts: [bookingRow.id, "customer-cash-proof"],
        fileName: payload.proofFileName || "customer-payment-proof.jpg",
        upsert: true,
        visibility: "private",
      })
    : "";

  const paymentPayload = {
    booking_id: bookingRow.id,
    customer_id: verified.profile.id,
    provider_id: bookingRow.provider_id,
    service_title: `${bookingRow.service_label} Service`,
    currency: "myr",
    amount: Number(bookingRow.quoted_amount ?? 0),
    payment_provider: "manual",
    payment_option: "cash",
    status: "paid",
    payment_method: "Cash",
    paid_at: timestamp,
    customer_confirmed_at: timestamp,
    customer_payment_proof_data_url: storedProofDataUrl || null,
    customer_payment_proof_file_name: payload.proofFileName?.trim() || null,
    customer_payment_proof_mime_type: payload.proofMimeType?.trim() || null,
  };

  const { data: updatedPayments, error: updatePaymentError } = await verified.adminClient
    .from("payments")
    .update(paymentPayload)
    .eq("booking_id", bookingRow.id)
    .select("id");

  if (updatePaymentError) {
    return NextResponse.json(
      { error: updatePaymentError.message || "Unable to confirm cash payment." },
      { status: 500 },
    );
  }

  if (!updatedPayments || updatedPayments.length === 0) {
    const { error: insertPaymentError } = await verified.adminClient
      .from("payments")
      .insert(paymentPayload);

    if (insertPaymentError) {
      return NextResponse.json(
        { error: insertPaymentError.message || "Unable to confirm cash payment." },
        { status: 500 },
      );
    }
  }

  const { error: bookingUpdateError } = await verified.adminClient
    .from("bookings")
    .update({
      booking_status: "cash_paid_by_user",
      cash_paid_by_user_at: timestamp,
      cash_payment_proof_images: storedProofDataUrl ? [storedProofDataUrl] : [],
    })
    .eq("id", bookingRow.id)
    .eq("customer_id", verified.profile.id);

  if (bookingUpdateError) {
    return NextResponse.json(
      { error: bookingUpdateError.message || "Unable to update booking payment status." },
      { status: 500 },
    );
  }

  await verified.adminClient.from("notifications").insert({
    user_id: bookingRow.provider_id,
    booking_id: bookingRow.id,
    notification_type: "payment_done",
    title: "Customer marked payment paid",
    body: `${verified.profile.full_name?.trim() || "A customer"} marked cash payment as paid for the ${bookingRow.service_label} booking. Please confirm receipt.`,
  });

  try {
    await sendPushNotificationToUser(bookingRow.provider_id, {
      title: "Customer marked payment paid",
      body: `${verified.profile.full_name?.trim() || "A customer"} marked cash payment as paid for the ${bookingRow.service_label} booking. Please confirm receipt.`,
      bookingId: bookingRow.id,
      path: `/provider/bookings/${bookingRow.id}`,
    });
  } catch (pushError) {
    console.error("[Cash payment confirm] Failed to send provider push notification:", pushError);
  }

  return NextResponse.json({ success: true });
}
