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

type CancelPayload = {
  reason?: string;
};

// A customer can only back out before the provider is already travelling —
// once "on_the_way" the provider may already be committed/en route, so
// cancellation moves to the provider's side from that point on.
const CANCELLABLE_STATUSES: BookingRow["booking_status"][] = [
  "pending_provider_response",
  "accepted",
];

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

  const payload = (await request.json().catch(() => ({}))) as CancelPayload;
  const reason = payload.reason?.trim() ?? "";
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

  if (!CANCELLABLE_STATUSES.includes(bookingRow.booking_status)) {
    return NextResponse.json(
      {
        error:
          "This booking can no longer be cancelled — the provider is already on the way or further along.",
      },
      { status: 400 },
    );
  }

  // Only cancels if the booking is still in the status it was read in — if
  // the provider moved it on (e.g. "on the way") in the meantime, this must
  // not silently overwrite that.
  const { data: cancelledRows, error: updateError } = await verified.adminClient
    .from("bookings")
    .update({
      booking_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      // Reused from the decline flow — the Flutter/web clients already read
      // this same column as `cancellationReason` regardless of whether the
      // booking was declined or cancelled (see app/api/bookings/route.ts).
      decline_reason: reason || "Cancelled by customer.",
    })
    .eq("id", bookingRow.id)
    .eq("customer_id", verified.profile.id)
    .eq("booking_status", bookingRow.booking_status)
    .select("id");

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Unable to cancel booking." },
      { status: 500 },
    );
  }

  if (!cancelledRows || cancelledRows.length === 0) {
    return NextResponse.json(
      { error: "This booking was just updated. Please refresh and try again." },
      { status: 409 },
    );
  }

  const customerName = verified.profile.full_name?.trim() || "The customer";
  const title = "Booking cancelled";
  const body = reason
    ? `${customerName} cancelled the ${bookingRow.service_label} booking. Reason: ${reason}`
    : `${customerName} cancelled the ${bookingRow.service_label} booking.`;

  await verified.adminClient.from("notifications").insert({
    user_id: bookingRow.provider_id,
    booking_id: bookingRow.id,
    notification_type: "booking_cancelled",
    title,
    body,
  });

  try {
    await sendPushNotificationToUser(bookingRow.provider_id, {
      title,
      body,
      bookingId: bookingRow.id,
      path: `/provider/bookings/${bookingRow.id}`,
      type: "booking",
      event: "cancelled_by_user",
    });
  } catch (pushError) {
    console.error("[Booking cancel] Failed to send provider push notification:", pushError);
  }

  return NextResponse.json({ success: true });
}
