import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { buildPaymentBreakdownNote, type PaymentBreakdownRow } from "@/lib/payment-adjustment";
import { calculateCommission } from "@/lib/payments";
import { sendPushNotificationToUser } from "@/lib/push-notifications";
import { normalizeBookingWorkflowStatus } from "@/lib/booking-workflow";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import {
  uploadStoredMedia,
  uploadStoredMediaList,
} from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type BookingStatus =
  | "pending"
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

type UpdatePayload = {
  status?: BookingStatus;
  action?: "settle_company_commission";
  note?: string;
  finalAmount?: number;
  workFinishedImages?: string[];
  paymentBreakdown?: PaymentBreakdownRow[];
  proofDataUrl?: string;
  proofFileName?: string;
  proofMimeType?: string;
  depositedAmount?: number;
};

type BookingOwnerRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  booking_status: BookingStatus;
  service_label: string;
  quoted_amount: number | null;
  booking_price?: number | null;
};

function isUnknownColumnError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return normalized.includes("column") && (
    normalized.includes("work_finished_at") ||
    normalized.includes("work_finished_images") ||
    normalized.includes("work_confirmed_by_user_at") ||
    normalized.includes("payment_sent_at") ||
    normalized.includes("payment_breakdown") ||
    normalized.includes("booking_price") ||
    normalized.includes("additional_charges") ||
    normalized.includes("discount_amount") ||
    normalized.includes("final_amount") ||
    normalized.includes("cash_paid_by_user_at") ||
    normalized.includes("cash_payment_proof_images") ||
    normalized.includes("payment_received_by_provider_at") ||
    normalized.includes("accepted_at") ||
    normalized.includes("provider_response_note") ||
    normalized.includes("decline_reason") ||
    normalized.includes("on_the_way_at") ||
    normalized.includes("arrived_at") ||
    normalized.includes("completed_at") ||
    normalized.includes("cancelled_at")
  );
}

function mapBookingUpdateError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("invalid input value for enum booking_status") ||
    normalized.includes("invalid input value for enum") && normalized.includes("booking_status")
  ) {
    return "The live booking workflow database migration is missing. Apply the latest Supabase migration for booking status values, then try again.";
  }

  return message || "Unable to update booking.";
}

function isUnknownPaymentColumnError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return normalized.includes("column") && (
    normalized.includes("payment_option") ||
    normalized.includes("company_commission_rate") ||
    normalized.includes("company_commission_amount") ||
    normalized.includes("provider_net_amount") ||
    normalized.includes("company_payment_status") ||
    normalized.includes("provider_sent_amount_at")
  );
}

function isMissingCommissionPaymentSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column")
  ) && (
    normalized.includes("provider_company_payment_amount") ||
    normalized.includes("admin_company_received_amount") ||
    normalized.includes("company_payment_requested_at")
  );
}

function buildFallbackUpdatePayload(
  nextStatus: BookingStatus,
  _current: BookingOwnerRow,
) {
  const payload: Record<string, string | number | BookingStatus> = {
    booking_status: nextStatus,
  };

  return payload;
}

function buildPaymentRequestPayload(
  current: BookingOwnerRow,
  amount: number,
  commission: ReturnType<typeof calculateCommission>,
) {
  return {
    booking_id: current.id,
    customer_id: current.customer_id,
    provider_id: current.provider_id,
    service_title: `${current.service_label} Service`,
    currency: "myr",
    amount: commission.amount,
    payment_provider: "cash",
    payment_option: "cash",
    payment_method: "Cash",
    status: "pending",
    company_commission_rate: commission.companyCommissionRate,
    company_commission_amount: commission.companyCommissionAmount,
    provider_net_amount: commission.providerNetAmount,
    company_payment_status: "pending",
    provider_sent_amount_at: new Date().toISOString(),
  };
}

function buildFallbackPaymentRequestPayload(
  current: BookingOwnerRow,
  commission: ReturnType<typeof calculateCommission>,
) {
  return {
    booking_id: current.id,
    customer_id: current.customer_id,
    provider_id: current.provider_id,
    service_title: `${current.service_label} Service`,
    currency: "myr",
    amount: commission.amount,
    payment_provider: "cash",
    payment_method: "Cash",
    status: "pending",
  };
}

async function ensurePaymentRequest(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  current: BookingOwnerRow,
  amount: number,
) {
  const commission = calculateCommission(amount);
  const paymentPayload = buildPaymentRequestPayload(current, amount, commission);
  const fallbackPaymentPayload = buildFallbackPaymentRequestPayload(current, commission);

  const existingPayment = await adminClient
    .from("payments")
    .select("id")
    .eq("booking_id", current.id)
    .maybeSingle();

  if (existingPayment.error) {
    return { error: existingPayment.error };
  }

  let writeResult = existingPayment.data?.id
    ? await adminClient
        .from("payments")
        .update(paymentPayload)
        .eq("id", existingPayment.data.id)
    : await adminClient
        .from("payments")
        .insert(paymentPayload);

  if (writeResult.error && isUnknownPaymentColumnError(writeResult.error.message)) {
    writeResult = existingPayment.data?.id
      ? await adminClient
          .from("payments")
          .update(fallbackPaymentPayload)
          .eq("id", existingPayment.data.id)
      : await adminClient
          .from("payments")
          .insert(fallbackPaymentPayload);
  }

  if (
    writeResult.error?.message?.toLowerCase().includes("duplicate") ||
    writeResult.error?.message?.toLowerCase().includes("unique")
  ) {
    writeResult = await adminClient
      .from("payments")
      .update(
        isUnknownPaymentColumnError(writeResult.error.message)
          ? fallbackPaymentPayload
          : paymentPayload,
      )
      .eq("booking_id", current.id);

    if (writeResult.error && isUnknownPaymentColumnError(writeResult.error.message)) {
      writeResult = await adminClient
        .from("payments")
        .update(fallbackPaymentPayload)
        .eq("booking_id", current.id);
    }
  }

  return { error: writeResult.error };
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

async function verifyProviderRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 500 }
      ),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing auth token." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { error: "Provider profile was not found." },
        { status: 404 }
      ),
    };
  }

  if (!isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json(
        { error: "This account is not a provider account." },
        { status: 403 }
      ),
    };
  }

  return {
    adminClient,
    authUser: user,
    profile: profile as ProfileRow,
  };
}

const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["accepted", "declined_by_provider", "cancelled"],
  pending_provider_response: ["accepted", "declined_by_provider", "cancelled"],
  accepted: ["on_the_way", "cancelled"],
  on_the_way: ["arrived", "cancelled"],
  arrived: ["work_finished_by_provider", "final_payment_sent", "cancelled"],
  work_finished_by_provider: ["final_payment_sent"],
  work_confirmed_by_user: ["final_payment_sent"],
  final_payment_sent: [],
  cash_paid_by_user: ["payment_received_by_provider", "completed"],
  payment_received_by_provider: ["completed"],
  completed: [],
  declined_by_provider: [],
  cancelled: [],
};

function notificationTypeForStatus(status: BookingStatus) {
  switch (status) {
    case "accepted":
      return "booking_accepted";
    case "declined_by_provider":
      return "booking_declined";
    case "on_the_way":
      return "provider_on_the_way";
    case "arrived":
      return "provider_arrived";
    case "work_finished_by_provider":
      return "provider_work_finished";
    case "final_payment_sent":
      return "final_payment_sent";
    case "payment_received_by_provider":
      return "payment_received_by_provider";
    case "completed":
      return "task_completed";
    case "cancelled":
      return "booking_cancelled";
    default:
      return null;
  }
}

function notificationContent(
  status: BookingStatus,
  serviceLabel: string,
  note: string,
) {
  switch (status) {
    case "accepted":
      return {
        title: "Booking confirmed",
        body: `Your ${serviceLabel} booking was accepted.${note ? ` Note: ${note}` : ""}`,
      };
    case "declined_by_provider":
      return {
        title: "Booking declined",
        body: `Your ${serviceLabel} booking was declined.${note ? ` Reason: ${note}` : ""}`,
      };
    case "on_the_way":
      return {
        title: "Provider on the way",
        body: `Your ${serviceLabel} provider is on the way.`,
      };
    case "arrived":
      return {
        title: "Provider arrived",
        body: `Your ${serviceLabel} provider has arrived.`,
      };
    case "work_finished_by_provider":
      return {
        title: "Work finished by provider",
        body: `Your provider marked the ${serviceLabel} work as finished. Please confirm the work completion.`,
      };
    case "final_payment_sent":
      return {
        title: "Final payment sent",
        body: `Your provider sent the final cash payment for the ${serviceLabel} booking.`,
      };
    case "payment_received_by_provider":
      return {
        title: "Payment received",
        body: `Your provider confirmed the cash payment for the ${serviceLabel} booking.`,
      };
    case "completed":
      return {
        title: "Task completed",
        body: `Your ${serviceLabel} booking is completed.`,
      };
    case "cancelled":
      return {
        title: "Booking cancelled",
        body: `Your ${serviceLabel} booking was cancelled.`,
      };
    default:
      return null;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const params = await context.params;
  const payload = (await request.json()) as UpdatePayload;
  const nextStatus = payload.status;
  const note = payload.note?.trim() ?? "";
  const finalAmount =
    typeof payload.finalAmount === "number" && Number.isFinite(payload.finalAmount)
      ? Math.max(0, payload.finalAmount)
      : null;
  const paymentBreakdown = (payload.paymentBreakdown ?? [])
    .map((row) => ({
      description: row.description?.trim() || "Charge",
      amount: Number(row.amount ?? 0),
    }))
    .filter((row) => Number.isFinite(row.amount));
  const paymentTotal =
    finalAmount ??
    (paymentBreakdown.length > 0
      ? paymentBreakdown.reduce((sum, row) => sum + row.amount, 0)
      : null);

  let { data: booking, error: bookingError } = await verified.adminClient
    .from("bookings")
    .select("id, customer_id, provider_id, booking_status, service_label, quoted_amount, booking_price")
    .eq("id", params.id)
    .eq("provider_id", verified.profile.id)
    .maybeSingle();

  if (bookingError && isUnknownColumnError(bookingError.message)) {
    const fallbackLookup = await verified.adminClient
      .from("bookings")
      .select("id, customer_id, provider_id, booking_status, service_label, quoted_amount")
      .eq("id", params.id)
      .eq("provider_id", verified.profile.id)
      .maybeSingle();

    booking = fallbackLookup.data as typeof booking;
    bookingError = fallbackLookup.error;
  }

  if (bookingError || !booking) {
    if (bookingError) {
      console.error("[Provider booking update] Failed to find booking:", bookingError);
    }

    return NextResponse.json(
      { error: "Booking was not found." },
      { status: 404 }
    );
  }

  const current = booking as BookingOwnerRow;

  if (payload.action === "settle_company_commission") {
    const depositedAmount =
      typeof payload.depositedAmount === "number" && Number.isFinite(payload.depositedAmount)
        ? Math.max(0, payload.depositedAmount)
        : 0;

    if (!payload.proofDataUrl?.trim() || !payload.proofFileName?.trim() || !payload.proofMimeType?.trim()) {
      return NextResponse.json(
        { error: "Payment slip is required before submitting company payment." },
        { status: 400 }
      );
    }

    if (depositedAmount <= 0) {
      return NextResponse.json(
        { error: "Deposited amount is required." },
        { status: 400 }
      );
    }

    const { data: paymentRecord, error: paymentLookupError } = await verified.adminClient
      .from("payments")
      .select("id, status")
      .eq("booking_id", current.id)
      .eq("provider_id", verified.profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentLookupError || !paymentRecord) {
      return NextResponse.json(
        { error: paymentLookupError?.message || "No payment record was found for this booking." },
        { status: 404 }
      );
    }

    if (paymentRecord.status !== "paid") {
      return NextResponse.json(
        { error: "Customer cash payment must be marked as paid before company payment submission." },
        { status: 400 }
      );
    }

    const storedProofDataUrl = await uploadStoredMedia(verified.adminClient, {
      bucket: "payment-proofs",
      dataUrl: payload.proofDataUrl,
      ownerId: verified.profile.id,
      pathParts: [current.id, "provider-company-payment-proof"],
      fileName: payload.proofFileName || "provider-company-payment-proof.jpg",
      upsert: true,
      visibility: "private",
    });

    const fullUpdatePayload = {
      company_payment_status: "payment_process",
      company_payment_requested_at: new Date().toISOString(),
      provider_company_payment_amount: depositedAmount,
      provider_company_payment_proof_data_url: storedProofDataUrl,
      provider_company_payment_proof_file_name: payload.proofFileName.trim(),
      provider_company_payment_proof_mime_type: payload.proofMimeType.trim(),
    };
    const fallbackUpdatePayload = {
      company_payment_status: "payment_process",
      provider_company_payment_proof_data_url: storedProofDataUrl,
      provider_company_payment_proof_file_name: payload.proofFileName.trim(),
      provider_company_payment_proof_mime_type: payload.proofMimeType.trim(),
    };

    let { error: paymentUpdateError } = await verified.adminClient
      .from("payments")
      .update(fullUpdatePayload)
      .eq("id", paymentRecord.id);

    if (paymentUpdateError && isMissingCommissionPaymentSchemaError(paymentUpdateError.message)) {
      const fallbackUpdate = await verified.adminClient
        .from("payments")
        .update(fallbackUpdatePayload)
        .eq("id", paymentRecord.id);

      paymentUpdateError = fallbackUpdate.error;
    }

    if (paymentUpdateError) {
      return NextResponse.json(
        { error: paymentUpdateError.message || "Unable to settle company commission." },
        { status: 500 }
      );
    }

    const { data: adminProfiles } = await verified.adminClient
      .from("profiles")
      .select("id")
      .in("role", ["super_admin", "admin", "manager", "customer_care"]);

    if (adminProfiles?.length) {
      await verified.adminClient.from("notifications").insert(
        adminProfiles.map((admin) => ({
          user_id: admin.id,
          booking_id: current.id,
          notification_type: "company_payment_submitted",
          title: "Company payment submitted",
          body: `Provider uploaded a payment slip and submitted RM ${depositedAmount.toFixed(2)} for company commission review.`,
        }))
      );
    }

    return NextResponse.json({ success: true });
  }

  if (!nextStatus) {
    return NextResponse.json(
      { error: "Booking status is required." },
      { status: 400 }
    );
  }

  if (current.booking_status === nextStatus) {
    if (nextStatus === "final_payment_sent") {
      const amount = paymentTotal ?? Number(current.quoted_amount ?? 0);
      const { error: paymentUpsertError } = await ensurePaymentRequest(
        verified.adminClient,
        current,
        amount,
      );

      if (paymentUpsertError) {
        console.error("[Provider booking update] Failed to save payment request on retry:", paymentUpsertError);
        return NextResponse.json(
          { error: paymentUpsertError.message || "Payment request could not be prepared." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, alreadyApplied: true });
  }

  if (!allowedTransitions[current.booking_status].includes(nextStatus)) {
    return NextResponse.json(
      { error: `Cannot move booking from ${current.booking_status} to ${nextStatus}.` },
      { status: 400 }
    );
  }

  if (nextStatus === "final_payment_sent" && paymentTotal === null) {
    return NextResponse.json(
      { error: "Final amount is required before sending the cash payment request." },
      { status: 400 }
    );
  }

  const uploadedWorkFinishedImages =
    payload.workFinishedImages && payload.workFinishedImages.length > 0
      ? await uploadStoredMediaList(
          verified.adminClient,
          payload.workFinishedImages.map((dataUrl, index) => ({
            dataUrl,
            fileName: `job-complete-${index + 1}.jpg`,
          })),
          {
            bucket: "job-completion-images",
            ownerId: verified.profile.id,
            pathPrefix: [current.id, "work-finished"],
            visibility: "private",
          },
        )
      : [];

  const updatePayload: Record<string, unknown> = {
    booking_status: nextStatus,
  };

  if (nextStatus === "accepted") {
    updatePayload.accepted_at = new Date().toISOString();
    updatePayload.provider_response_note = note;
  }

  if (nextStatus === "declined_by_provider") {
    updatePayload.decline_reason = note || "Provider declined booking.";
    updatePayload.cancelled_at = new Date().toISOString();
  }

  if (nextStatus === "on_the_way") {
    updatePayload.on_the_way_at = new Date().toISOString();
  }

  if (nextStatus === "arrived") {
    updatePayload.arrived_at = new Date().toISOString();
  }

  if (nextStatus === "work_finished_by_provider") {
    updatePayload.work_finished_at = new Date().toISOString();
    updatePayload.work_finished_images = uploadedWorkFinishedImages;
    updatePayload.provider_response_note = note || "Provider marked work as finished.";
  }

  if (nextStatus === "final_payment_sent") {
    const amount = paymentTotal ?? Number(current.quoted_amount ?? 0);
    const bookingPrice = Number(current.booking_price ?? current.quoted_amount ?? 0);
    const extraRows = paymentBreakdown.filter((row, index) => index > 0 || row.description !== "Booking Price");
    const isSendingAfterArrival =
      current.booking_status === "arrived" || current.booking_status === "work_finished_by_provider";

    if (isSendingAfterArrival) {
      updatePayload.work_finished_at = new Date().toISOString();
      updatePayload.work_finished_images = uploadedWorkFinishedImages;
    }
    updatePayload.payment_sent_at = new Date().toISOString();
    updatePayload.payment_breakdown =
      paymentBreakdown.length > 0
        ? paymentBreakdown
        : [{ description: "Booking Price", amount: bookingPrice }];
    updatePayload.booking_price = bookingPrice;
    updatePayload.additional_charges = extraRows.filter((row) => row.amount > 0);
    updatePayload.discount_amount = Math.abs(extraRows.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0));
    updatePayload.final_amount = amount;
    updatePayload.quoted_amount = amount;
    updatePayload.provider_response_note = buildPaymentBreakdownNote({
      baseAmount: bookingPrice,
      finalAmount: amount,
      additionalCharge: extraRows.reduce((sum, row) => sum + row.amount, 0),
      chargeDescription: extraRows.map((row) => row.description).join(", "),
      note: note || "Final cash payment sent.",
      rows: paymentBreakdown,
      discountAmount: Number(updatePayload.discount_amount),
    });
  }

  if (nextStatus === "payment_received_by_provider") {
    updatePayload.payment_received_by_provider_at = new Date().toISOString();
  }

  if (nextStatus === "completed") {
    updatePayload.completed_at = new Date().toISOString();
    if (current.booking_status === "cash_paid_by_user") {
      updatePayload.payment_received_by_provider_at = new Date().toISOString();
    }
  }

  if (nextStatus === "cancelled") {
    updatePayload.cancelled_at = new Date().toISOString();
  }

  let { error: updateError } = await verified.adminClient
    .from("bookings")
    .update(updatePayload)
    .eq("id", current.id)
    .eq("provider_id", verified.profile.id);

  if (updateError && isUnknownColumnError(updateError.message)) {
    const fallbackPayload = buildFallbackUpdatePayload(
      nextStatus,
      current,
    );

    const fallbackWrite = await verified.adminClient
      .from("bookings")
      .update(fallbackPayload)
      .eq("id", current.id)
      .eq("provider_id", verified.profile.id);

    updateError = fallbackWrite.error;
  }

  if (updateError) {
    console.error("[Provider booking update] Failed to update booking:", updateError);
    return NextResponse.json(
      { error: mapBookingUpdateError(updateError.message) },
      { status: 500 }
    );
  }

  if (nextStatus === "final_payment_sent") {
    const { error: paymentUpsertError } = await ensurePaymentRequest(
      verified.adminClient,
      current,
      paymentTotal ?? Number(current.quoted_amount ?? 0),
    );

    if (paymentUpsertError) {
      console.error("[Provider booking update] Failed to save payment request:", paymentUpsertError);
      return NextResponse.json(
        { error: paymentUpsertError.message || "Booking updated but payment request could not be prepared." },
        { status: 500 }
      );
    }
  }

  const nextNotificationType = notificationTypeForStatus(nextStatus);
  const nextNotificationContent = notificationContent(
    nextStatus,
    current.service_label,
    note,
  );

  if (nextNotificationType && nextNotificationContent) {
    const { error: notificationError } = await verified.adminClient
      .from("notifications")
      .insert({
        user_id: current.customer_id,
        booking_id: current.id,
        notification_type: nextNotificationType,
        title: nextNotificationContent.title,
        body: nextNotificationContent.body,
      });

    if (notificationError) {
      console.error("[Provider booking update] Failed to store notification:", notificationError);
    }

    try {
      await sendPushNotificationToUser(current.customer_id, {
        title: nextNotificationContent.title,
        body: nextNotificationContent.body,
        bookingId: current.id,
        path: `/profile/notifications?booking=${current.id}`,
      });
    } catch (pushError) {
      console.error("[Provider booking update] Failed to send push notification:", pushError);
    }
  }

  return NextResponse.json({ success: true });
}
