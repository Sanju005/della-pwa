import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parsePaymentAdjustmentNote } from "@/lib/payment-adjustment";
import { calculateCommission } from "@/lib/payments";
import { normalizeBookingWorkflowStatus } from "@/lib/booking-workflow";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

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

type BookingRow = {
  id: string;
  customer_id: string;
  service_label: string;
  service_key: string;
  location_text: string;
  booking_mode: "hourly" | "daily";
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
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  customer_note: string | null;
  provider_response_note: string | null;
  decline_reason: string | null;
  quoted_amount: number | null;
  created_at: string;
  accepted_at?: string | null;
  on_the_way_at?: string | null;
  arrived_at?: string | null;
  work_finished_at?: string | null;
  work_confirmed_by_user_at?: string | null;
  payment_sent_at?: string | null;
  cash_paid_by_user_at?: string | null;
  payment_received_by_provider_at?: string | null;
  completed_at?: string | null;
  work_finished_images?: string[] | null;
  payment_breakdown?: Array<{ description?: string; amount?: number }> | null;
  booking_price?: number | null;
  additional_charges?: Array<{ description?: string; amount?: number }> | null;
  discount_amount?: number | null;
  final_amount?: number | null;
  cash_payment_proof_images?: string[] | null;
  user_review_status?: string | null;
  provider_review_status?: string | null;
  payment_records?: Array<{
    amount: number | null;
    payment_method: string | null;
    payment_option: "cash" | "online" | null;
    status: string | null;
    paid_at: string | null;
    company_commission_amount: number | null;
    provider_net_amount: number | null;
    company_payment_status: "pending" | "payment_process" | "paid" | null;
    provider_company_payment_amount: number | null;
    admin_company_received_amount: number | null;
    customer_payment_proof_data_url: string | null;
    customer_payment_proof_file_name: string | null;
    customer_payment_proof_mime_type: string | null;
    provider_company_payment_proof_data_url: string | null;
    provider_company_payment_proof_file_name: string | null;
    provider_company_payment_proof_mime_type: string | null;
    created_at: string;
  }> | null;
  provider_review_records?: Array<{
    rating: number | null;
    comment: string | null;
    created_at: string | null;
  }> | null;
};

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

function isMissingProviderReviewTableError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return normalized.includes("provider_customer_reviews");
}

function isMissingTaskPathSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column")
  ) && (
    normalized.includes("booking_price") ||
    normalized.includes("final_amount") ||
    normalized.includes("work_finished_at") ||
    normalized.includes("work_finished_images") ||
    normalized.includes("work_confirmed_by_user_at") ||
    normalized.includes("payment_sent_at") ||
    normalized.includes("payment_breakdown") ||
    normalized.includes("cash_paid_by_user_at") ||
    normalized.includes("cash_payment_proof_images") ||
    normalized.includes("payment_received_by_provider_at") ||
    normalized.includes("user_review_status") ||
    normalized.includes("provider_review_status")
  );
}

function isMissingPaymentSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column")
  ) && (
    normalized.includes("company_payment_status") ||
    normalized.includes("provider_company_payment_amount") ||
    normalized.includes("admin_company_received_amount") ||
    normalized.includes("customer_payment_proof_data_url") ||
    normalized.includes("customer_payment_proof_file_name") ||
    normalized.includes("customer_payment_proof_mime_type") ||
    normalized.includes("provider_company_payment_proof_data_url") ||
    normalized.includes("provider_company_payment_proof_file_name") ||
    normalized.includes("provider_company_payment_proof_mime_type") ||
    normalized.includes("company_commission_amount") ||
    normalized.includes("provider_net_amount")
  );
}

const PROVIDER_PAYMENT_RECORDS_SELECT_FULL = `
  amount,
  payment_method,
  payment_option,
  status,
  paid_at,
  company_commission_amount,
  provider_net_amount,
  company_payment_status,
  provider_company_payment_amount,
  admin_company_received_amount,
  customer_payment_proof_data_url,
  customer_payment_proof_file_name,
  customer_payment_proof_mime_type,
  provider_company_payment_proof_data_url,
  provider_company_payment_proof_file_name,
  provider_company_payment_proof_mime_type,
  created_at
`;

const PROVIDER_PAYMENT_RECORDS_SELECT_FALLBACK = `
  amount,
  payment_method,
  payment_option,
  status,
  paid_at,
  created_at
`;

function formatDateTimeLabel(date: string, startTime: string, endTime: string) {
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);

  const dateLabel = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(start);

  const formatTime = (value: Date) =>
    new Intl.DateTimeFormat("en-MY", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(value);

  return `${dateLabel}, ${formatTime(start)} - ${formatTime(end)}`;
}

function providerStatusLabel(status: BookingRow["booking_status"]) {
  switch (normalizeBookingWorkflowStatus(status)) {
    case "pending_provider_response":
      return "Awaiting Action";
    case "declined_by_provider":
      return "Declined";
    case "accepted":
      return "Confirmed";
    case "on_the_way":
      return "On the Way";
    case "arrived":
      return "Arrived";
    case "work_finished_by_provider":
      return "Work Finished";
    case "work_confirmed_by_user":
      return "Prepare Final Payment";
    case "final_payment_sent":
      return "Payment Sent";
    case "cash_paid_by_user":
      return "Confirm Payment";
    case "payment_received_by_provider":
      return "Payment Received";
    case "completed":
      return "Task Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function customerStatusLabel(status: BookingRow["booking_status"]) {
  switch (normalizeBookingWorkflowStatus(status)) {
    case "pending_provider_response":
      return "Booking Sent";
    case "declined_by_provider":
      return "Declined by Provider";
    case "accepted":
      return "Provider Accepted";
    case "on_the_way":
      return "On the Way";
    case "arrived":
      return "Provider Arrived";
    case "work_finished_by_provider":
      return "Confirm Work";
    case "work_confirmed_by_user":
      return "Waiting Final Payment";
    case "final_payment_sent":
      return "Payment Requested";
    case "cash_paid_by_user":
      return "Waiting Provider Confirmation";
    case "payment_received_by_provider":
      return "Payment Received";
    case "completed":
      return "Task Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function toBucket(status: BookingRow["booking_status"]) {
  const normalized = normalizeBookingWorkflowStatus(status);

  if (normalized === "pending_provider_response") {
    return "requests";
  }

  if (normalized === "declined_by_provider" || normalized === "cancelled") {
    return "closed";
  }

  if (normalized === "completed") {
    return "closed";
  }

  if (
    normalized === "work_finished_by_provider" ||
    normalized === "work_confirmed_by_user" ||
    normalized === "final_payment_sent" ||
    normalized === "cash_paid_by_user" ||
    normalized === "payment_received_by_provider"
  ) {
    return "completed";
  }

  return "active";
}

async function loadCustomerNames(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  customerIds: string[]
) {
  if (customerIds.length === 0) {
    return new Map<string, string>();
  }

  const { data } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .in("id", customerIds);

  return new Map(
    ((data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => [
      row.id,
      row.full_name?.trim() || "Customer",
    ])
  );
}

export async function GET(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  let { data, error } = await verified.adminClient
    .from("bookings")
    .select(`
      id,
      customer_id,
      service_label,
      service_key,
      location_text,
      booking_mode,
      booking_status,
      scheduled_date,
      scheduled_start_time,
      scheduled_end_time,
      customer_note,
      provider_response_note,
      decline_reason,
      quoted_amount,
      work_finished_at,
      work_finished_images,
      work_confirmed_by_user_at,
      payment_sent_at,
      payment_breakdown,
      booking_price,
      additional_charges,
      discount_amount,
      final_amount,
      cash_paid_by_user_at,
      cash_payment_proof_images,
      payment_received_by_provider_at,
      user_review_status,
      provider_review_status,
      created_at,
      accepted_at,
      on_the_way_at,
      arrived_at,
      completed_at,
      payment_records:payments(${PROVIDER_PAYMENT_RECORDS_SELECT_FULL}),
      provider_review_records:provider_customer_reviews(rating, comment, created_at)
    `)
    .eq("provider_id", verified.profile.id)
    .order("created_at", { ascending: false });

  if (
    error &&
    (
      isMissingProviderReviewTableError(error.message) ||
      isMissingTaskPathSchemaError(error.message) ||
      isMissingPaymentSchemaError(error.message)
    )
  ) {
    const fallbackRead = await verified.adminClient
      .from("bookings")
      .select(`
        id,
        customer_id,
        service_label,
        service_key,
        location_text,
        booking_mode,
        booking_status,
        scheduled_date,
        scheduled_start_time,
        scheduled_end_time,
        customer_note,
        provider_response_note,
        decline_reason,
        quoted_amount,
        created_at,
        accepted_at,
        on_the_way_at,
        arrived_at,
        completed_at,
        payment_records:payments(${PROVIDER_PAYMENT_RECORDS_SELECT_FALLBACK})
      `)
      .eq("provider_id", verified.profile.id)
      .order("created_at", { ascending: false });

    data = fallbackRead.data as typeof data;
    error = fallbackRead.error;
  }

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to load provider bookings." },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as BookingRow[];
  const customerNames = await loadCustomerNames(
    verified.adminClient,
    [...new Set(rows.map((row) => row.customer_id))]
  );

  return NextResponse.json({
    bookings: rows.map((row) => {
      const normalizedStatus = normalizeBookingWorkflowStatus(row.booking_status);
      const parsedAdjustment = parsePaymentAdjustmentNote(row.provider_response_note);
      const quotedAmount =
        typeof row.payment_records?.[0]?.amount === "number"
          ? Number(row.payment_records[0]?.amount ?? 0)
          : Number(row.final_amount ?? 0) ||
            (parsedAdjustment?.finalAmount ?? Number(row.quoted_amount ?? 0));
      const baseAmount =
        Number(row.booking_price ?? 0) ||
        (parsedAdjustment?.baseAmount ?? Number(row.quoted_amount ?? 0));
      const paymentOption =
        row.payment_records?.[0]?.payment_option === "online" ? "online" : "cash";
      const derivedCommission = calculateCommission(quotedAmount);
      const shouldCarryCompanyCommission =
        paymentOption === "cash" &&
        [
          "final_payment_sent",
          "cash_paid_by_user",
          "payment_received_by_provider",
          "completed",
        ].includes(normalizedStatus);
      const companyCommissionAmount =
        typeof row.payment_records?.[0]?.company_commission_amount === "number"
          ? Number(row.payment_records[0]?.company_commission_amount ?? 0)
          : shouldCarryCompanyCommission
            ? derivedCommission.companyCommissionAmount
            : 0;
      const providerNetAmount =
        typeof row.payment_records?.[0]?.provider_net_amount === "number"
          ? Number(row.payment_records[0]?.provider_net_amount ?? 0)
          : shouldCarryCompanyCommission
            ? derivedCommission.providerNetAmount
            : Number(row.quoted_amount ?? 0);

      return {
        id: row.id,
        customerId: row.customer_id,
        customerName: customerNames.get(row.customer_id) || "Customer",
        serviceLabel: row.service_label,
        serviceKey: row.service_key,
        location: row.location_text,
        bookingMode: row.booking_mode,
        bookingStatus: normalizedStatus,
        statusLabel: providerStatusLabel(row.booking_status),
        customerStatusLabel: customerStatusLabel(row.booking_status),
        bucket: toBucket(row.booking_status),
        scheduledDate: row.scheduled_date,
        scheduledStartTime: row.scheduled_start_time,
        scheduledEndTime: row.scheduled_end_time,
        schedule: formatDateTimeLabel(
          row.scheduled_date,
          row.scheduled_start_time,
          row.scheduled_end_time
        ),
        customerNote: row.customer_note ?? "",
        providerResponseNote: row.provider_response_note ?? "",
        declineReason: row.decline_reason ?? "",
        quotedAmount,
        baseAmount,
        paymentStatus:
          row.payment_records?.[0]?.status === "paid" ||
          row.payment_records?.[0]?.status === "failed" ||
          row.payment_records?.[0]?.status === "cancelled" ||
          row.payment_records?.[0]?.status === "refunded"
            ? row.payment_records[0].status
            : "pending",
        paymentOption,
        companyCommissionAmount,
        companyPaymentStatus:
          row.payment_records?.[0]?.company_payment_status === "paid"
            ? "paid"
            : row.payment_records?.[0]?.company_payment_status === "payment_process"
              ? "payment_process"
              : "pending",
        providerCompanyPaymentAmount:
          typeof row.payment_records?.[0]?.provider_company_payment_amount === "number"
            ? Number(row.payment_records[0]?.provider_company_payment_amount ?? 0)
            : 0,
        adminCompanyReceivedAmount:
          typeof row.payment_records?.[0]?.admin_company_received_amount === "number"
            ? Number(row.payment_records[0]?.admin_company_received_amount ?? 0)
            : 0,
        providerNetAmount,
        customerPaymentProofDataUrl: row.payment_records?.[0]?.customer_payment_proof_data_url ?? "",
        customerPaymentProofFileName: row.payment_records?.[0]?.customer_payment_proof_file_name ?? "",
        customerPaymentProofMimeType: row.payment_records?.[0]?.customer_payment_proof_mime_type ?? "",
        providerCompanyPaymentProofDataUrl: row.payment_records?.[0]?.provider_company_payment_proof_data_url ?? "",
        providerCompanyPaymentProofFileName: row.payment_records?.[0]?.provider_company_payment_proof_file_name ?? "",
        providerCompanyPaymentProofMimeType: row.payment_records?.[0]?.provider_company_payment_proof_mime_type ?? "",
        additionalCharge:
          Array.isArray(row.additional_charges)
            ? row.additional_charges.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0)
            : parsedAdjustment?.additionalCharge ?? 0,
        additionalChargeDescription: parsedAdjustment?.chargeDescription ?? "",
        paymentBreakdown:
          Array.isArray(row.payment_breakdown)
            ? row.payment_breakdown
                .filter((item) => typeof item?.description === "string" && typeof item?.amount === "number")
                .map((item) => ({ description: item.description ?? "", amount: Number(item.amount ?? 0) }))
            : parsedAdjustment?.rows ?? [],
        workFinishedImages: Array.isArray(row.work_finished_images) ? row.work_finished_images : [],
        cashPaymentProofImages: Array.isArray(row.cash_payment_proof_images) ? row.cash_payment_proof_images : [],
        userReviewStatus:
          row.user_review_status === "submitted" || row.user_review_status === "skipped"
            ? row.user_review_status
            : "pending",
        providerReviewStatus:
          row.provider_review_status === "submitted" || row.provider_review_status === "skipped"
            ? row.provider_review_status
            : "pending",
        paymentNote:
          row.payment_records?.[0]?.status === "paid"
            ? `Customer paid via ${row.payment_records?.[0]?.payment_method ?? "Cash"}.`
            : parsedAdjustment?.note ?? "",
        createdAt: row.created_at,
        acceptedAt: row.accepted_at ?? "",
        onTheWayAt: row.on_the_way_at ?? "",
        arrivedAt: row.arrived_at ?? "",
        workFinishedAt: row.work_finished_at ?? "",
        workConfirmedByUserAt: row.work_confirmed_by_user_at ?? "",
        paymentSentAt: row.payment_sent_at ?? "",
        cashPaidByUserAt: row.cash_paid_by_user_at ?? row.payment_records?.[0]?.paid_at ?? "",
        paymentReceivedByProviderAt: row.payment_received_by_provider_at ?? "",
        completedAt: row.completed_at ?? "",
        paidAt: row.cash_paid_by_user_at ?? row.payment_records?.[0]?.paid_at ?? "",
        providerReviewRating:
          typeof row.provider_review_records?.[0]?.rating === "number"
            ? Number(row.provider_review_records[0].rating ?? 0)
            : undefined,
        providerReviewComment: row.provider_review_records?.[0]?.comment ?? "",
        providerReviewedAt: row.provider_review_records?.[0]?.created_at ?? "",
      };
    }),
  });
}
