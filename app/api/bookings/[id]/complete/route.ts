import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sendPushNotificationToUser } from "@/lib/push-notifications";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

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

  const params = await context.params;
  const { data: booking, error: bookingError } = await verified.adminClient
    .from("bookings")
    .select("id, customer_id, provider_id, service_label, booking_status")
    .eq("id", params.id)
    .eq("customer_id", verified.profile.id)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking was not found." }, { status: 404 });
  }

  const bookingRow = booking as BookingRow;

  if (bookingRow.booking_status !== "work_finished_by_provider") {
    return NextResponse.json(
      { error: "You can confirm work completion only after the provider marks the work as finished." },
      { status: 400 },
    );
  }

  const completedAt = new Date().toISOString();

  // Only the first request moves the booking on; a double tap gets a 409 and
  // so never sends duplicate notifications.
  let { data: confirmedRows, error: updateError } = await verified.adminClient
    .from("bookings")
    .update({
      booking_status: "work_confirmed_by_user",
      work_confirmed_by_user_at: completedAt,
    })
    .eq("id", bookingRow.id)
    .eq("customer_id", verified.profile.id)
    .eq("booking_status", "work_finished_by_provider")
    .select("id");

  if (updateError) {
    const fallbackWrite = await verified.adminClient
      .from("bookings")
      .update({
        booking_status: "work_confirmed_by_user",
      })
      .eq("id", bookingRow.id)
      .eq("customer_id", verified.profile.id)
      .eq("booking_status", "work_finished_by_provider")
      .select("id");

    if (fallbackWrite.error) {
      return NextResponse.json(
        { error: fallbackWrite.error.message || "Unable to complete booking." },
        { status: 500 },
      );
    }

    confirmedRows = fallbackWrite.data;
  }

  if (!confirmedRows || confirmedRows.length === 0) {
    return NextResponse.json(
      { error: "This booking was just updated. Please refresh and try again." },
      { status: 409 },
    );
  }

  const providerBody = `${verified.profile.full_name?.trim() || "A customer"} confirmed the ${bookingRow.service_label} work is completed.`;
  const customerBody = `You confirmed the ${bookingRow.service_label} work. The provider can now prepare the final cash payment.`;

  await verified.adminClient.from("notifications").insert([
    {
      user_id: bookingRow.provider_id,
      booking_id: bookingRow.id,
      notification_type: "user_work_confirmed",
      title: "Work confirmed by user",
      body: providerBody,
    },
    {
      user_id: bookingRow.customer_id,
      booking_id: bookingRow.id,
      notification_type: "user_work_confirmed",
      title: "Work confirmation saved",
      body: customerBody,
    },
  ]);

  try {
    await Promise.all([
      sendPushNotificationToUser(bookingRow.provider_id, {
        title: "Work confirmed by user",
        body: providerBody,
        bookingId: bookingRow.id,
        path: `/provider/bookings/${bookingRow.id}`,
        type: "booking",
        event: "work_confirmed_by_user",
      }),
      sendPushNotificationToUser(bookingRow.customer_id, {
        title: "Work confirmation saved",
        body: customerBody,
        bookingId: bookingRow.id,
        path: `/profile/bookings/${bookingRow.id}`,
        type: "booking",
        event: "work_confirmed_by_user",
      }),
    ]);
  } catch (pushError) {
    console.error("[Customer complete booking] Failed to send push notification:", pushError);
  }

  return NextResponse.json({ success: true });
}
