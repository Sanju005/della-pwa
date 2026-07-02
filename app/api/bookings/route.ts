import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Booking } from "@/lib/profile-types";
import { normalizeBookingWorkflowStatus } from "@/lib/booking-workflow";
import { parsePaymentAdjustmentNote } from "@/lib/payment-adjustment";
import { sendPushNotificationToUser } from "@/lib/push-notifications";
import { buildProviderPortraitSrc, type ProviderCategoryKey } from "@/lib/provider-catalog";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

type BookingBody = {
  providerId?: string;
  providerName?: string;
  serviceKey?: string;
  serviceLabel?: string;
  location?: string;
  bookingMode?: "hourly" | "daily";
  dateLabel?: string;
  startTimeLabel?: string;
  endTimeLabel?: string;
  timeLabel?: string;
  durationHours?: number;
  notes?: string;
  hourlyRate?: number;
  dailyRate?: number;
  totalAmount?: number;
};

type CompleteBookingBody = {
  providerId: string;
  providerName: string;
  serviceKey: string;
  serviceLabel: string;
  location: string;
  bookingMode: "hourly" | "daily";
  dateLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  timeLabel: string;
  durationHours: number;
  notes: string;
  hourlyRate: number;
  dailyRate: number;
  totalAmount: number;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type ProviderProfileRow = {
  id: string;
  marketing_name: string | null;
};

type BookingRow = {
  id: string;
  provider_id: string;
  service_key: string;
  service_label: string;
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
};

type ProviderServiceRow = {
  id: string;
  service_type: string | null;
};

type ProviderAvailabilityRow = {
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
};

type ProviderBookingConflictRow = {
  id: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  booking_status: BookingRow["booking_status"];
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

function mapBookingSchemaError(message: string | null | undefined) {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("booking_mode") &&
    (normalized.includes("schema cache") || normalized.includes("could not find"))
  ) {
    return "Booking database schema is outdated. Apply `supabase/migrations/20260607_live_booking_workflow.sql` and refresh the Supabase schema cache.";
  }

  return message || null;
}

function isMissingTaskPathSchemaError(message: string | null | undefined) {
  const normalized = message?.toLowerCase() ?? "";
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

function isMissingPaymentSchemaError(message: string | null | undefined) {
  const normalized = message?.toLowerCase() ?? "";
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

const CUSTOMER_PAYMENT_RECORDS_SELECT_FULL = `
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

const CUSTOMER_PAYMENT_RECORDS_SELECT_FALLBACK = `
  amount,
  payment_method,
  payment_option,
  status,
  paid_at,
  created_at
`;

function isMissingNewBookingStatusError(message: string | null | undefined) {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("invalid input value for enum") && normalized.includes("booking_status");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidBody(value: BookingBody): value is CompleteBookingBody {
  return (
    typeof value.providerId === "string" &&
    typeof value.providerName === "string" &&
    typeof value.serviceKey === "string" &&
    typeof value.serviceLabel === "string" &&
    typeof value.location === "string" &&
    (value.bookingMode === "hourly" || value.bookingMode === "daily") &&
    typeof value.dateLabel === "string" &&
    typeof value.startTimeLabel === "string" &&
    typeof value.endTimeLabel === "string" &&
    typeof value.timeLabel === "string" &&
    typeof value.durationHours === "number" &&
    typeof value.notes === "string" &&
    typeof value.hourlyRate === "number" &&
    typeof value.dailyRate === "number" &&
    typeof value.totalAmount === "number"
  );
}

async function verifyCustomerRequest(request: Request) {
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
        { error: "Customer profile was not found." },
        { status: 404 }
      ),
    };
  }

  if (isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json(
        { error: "This account is a provider account." },
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

function parseDateLabel(value: string) {
  const parts = value.split(",").map((part) => part.trim());
  const datePart = parts.length >= 2 ? parts.slice(1).join(", ") : value.trim();
  const parsed = new Date(datePart);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeLabel(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  let hour24 = hour % 12;

  if (period === "PM") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function formatTimeValue(value: string) {
  const [rawHour, rawMinute] = value.slice(0, 5).split(":").map(Number);

  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) {
    return value;
  }

  const period = rawHour >= 12 ? "PM" : "AM";
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;

  return `${String(hour12).padStart(2, "0")}:${String(rawMinute).padStart(2, "0")} ${period}`;
}

function getWeekdayKeyFromIsoDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-MY", {
    weekday: "long",
  }).trim().toLowerCase();
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

async function validateProviderAvailabilityAndConflicts(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerId: string,
  scheduledDate: string,
  scheduledStartTime: string,
  scheduledEndTime: string,
) {
  const weekdayKey = getWeekdayKeyFromIsoDate(scheduledDate);

  const { data: availability, error: availabilityError } = await adminClient
    .from("provider_availability")
    .select("day_of_week, start_time, end_time")
    .eq("provider_id", providerId)
    .eq("day_of_week", weekdayKey)
    .maybeSingle();

  if (availabilityError) {
    return {
      error: availabilityError.message || "Unable to validate provider availability.",
      status: 500 as const,
    };
  }

  const availabilityRow = availability as ProviderAvailabilityRow | null;

  if (!availabilityRow?.start_time || !availabilityRow?.end_time) {
    return {
      error: "This provider is not available on the selected day. Please choose another date.",
      status: 400 as const,
    };
  }

  const availabilityStart = availabilityRow.start_time.slice(0, 8);
  const availabilityEnd = availabilityRow.end_time.slice(0, 8);

  if (
    scheduledStartTime < availabilityStart ||
    scheduledEndTime > availabilityEnd
  ) {
    return {
      error: `This provider works ${formatTimeValue(availabilityStart)} - ${formatTimeValue(availabilityEnd)} on the selected day. Please choose a time within that schedule.`,
      status: 400 as const,
    };
  }

  const { data: conflicts, error: conflictError } = await adminClient
    .from("bookings")
    .select("id, scheduled_start_time, scheduled_end_time, booking_status")
    .eq("provider_id", providerId)
    .eq("scheduled_date", scheduledDate)
    .not("booking_status", "in", '("declined","cancelled")')
    .lt("scheduled_start_time", scheduledEndTime)
    .gt("scheduled_end_time", scheduledStartTime)
    .limit(1);

  if (conflictError) {
    return {
      error: conflictError.message || "Unable to check for booking conflicts.",
      status: 500 as const,
    };
  }

  const conflict = (conflicts ?? [])[0] as ProviderBookingConflictRow | undefined;

  if (conflict) {
    return {
      error: `This provider already has a booking from ${formatTimeValue(conflict.scheduled_start_time)} to ${formatTimeValue(conflict.scheduled_end_time)} on that date. Please choose another time.`,
      status: 400 as const,
    };
  }

  return { error: null, status: null };
}

function getCurrentKualaLumpurDateTime() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const getValue = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${getValue("year")}-${getValue("month")}-${getValue("day")}`,
    time: `${getValue("hour")}:${getValue("minute")}:${getValue("second")}`,
  };
}

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

  return {
    schedule: `${dateLabel}, ${formatTime(start)} - ${formatTime(end)}`,
    timeOnly: `${formatTime(start)} - ${formatTime(end)}`,
  };
}

function isProviderCategoryKey(value: string): value is ProviderCategoryKey {
  return [
    "chef",
    "maid",
    "babysitter",
    "driver",
    "cleaner",
    "tutor",
    "plumber",
    "electrician",
  ].includes(value);
}

function userStatusLabel(status: BookingRow["booking_status"]) {
  switch (normalizeBookingWorkflowStatus(status)) {
    case "pending_provider_response":
      return "Booking Sent";
    case "declined_by_provider":
      return "Declined by Provider";
    case "accepted":
      return "Provider Accepted";
    case "on_the_way":
      return "Provider On The Way";
    case "arrived":
      return "Provider Arrived";
    case "work_finished_by_provider":
      return "Confirm Work Completion";
    case "work_confirmed_by_user":
      return "Waiting Final Payment";
    case "final_payment_sent":
      return "Payment Requested";
    case "cash_paid_by_user":
      return "Waiting Provider Payment Confirmation";
    case "payment_received_by_provider":
      return "Payment Received";
    case "completed":
      return "Task Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function toBookingTab(status: BookingRow["booking_status"]): Booking["status"] {
  const normalized = normalizeBookingWorkflowStatus(status);

  if (normalized === "declined_by_provider" || normalized === "cancelled") {
    return "cancelled";
  }

  if (normalized === "completed") {
    return "completed";
  }

  if (
    [
      "accepted",
      "on_the_way",
      "arrived",
      "work_finished_by_provider",
      "work_confirmed_by_user",
      "final_payment_sent",
      "cash_paid_by_user",
      "payment_received_by_provider",
    ].includes(normalized)
  ) {
    return "ongoing";
  }

  return "pending";
}

function toBadgeTone(status: BookingRow["booking_status"]): Booking["badgeTone"] {
  const normalized = normalizeBookingWorkflowStatus(status);

  if (normalized === "declined_by_provider" || normalized === "cancelled") {
    return "slate";
  }

  if (normalized === "pending_provider_response") {
    return "amber";
  }

  return "green";
}

function buildUserActivitySteps(status: BookingRow["booking_status"]): Booking["activitySteps"] {
  const stepOrder: string[] = [
    "pending_provider_response",
    "accepted",
    "on_the_way",
    "arrived",
    "work_finished_by_provider",
    "work_confirmed_by_user",
    "final_payment_sent",
    "cash_paid_by_user",
    "completed",
  ] as const;

  const labels = [
    "Booking Sent",
    "Provider Accepted",
    "Provider On The Way",
    "Provider Arrived",
    "Confirm Work Completion",
    "Waiting Final Payment",
    "Paid by Cash",
    "Task Completed",
  ];

  const currentIndex = stepOrder.indexOf(normalizeBookingWorkflowStatus(status));

  return labels.map((label, index) => ({
    label,
    status:
      currentIndex === -1
        ? index === 0
          ? "current"
          : "pending"
        : index < currentIndex
          ? "done"
          : index === currentIndex
            ? "current"
            : "pending",
  }));
}

function mapLiveBookingToUi(
  row: BookingRow,
  providerName: string
): Booking {
  const scheduleParts = formatDateTimeLabel(
    row.scheduled_date,
    row.scheduled_start_time,
    row.scheduled_end_time
  );

  const serviceKey = isProviderCategoryKey(row.service_key)
    ? row.service_key
    : "cleaner";
  const workflowStatus = normalizeBookingWorkflowStatus(row.booking_status);
  const paymentAdjustment = parsePaymentAdjustmentNote(row.provider_response_note);
  const paymentRecord = row.payment_records?.[0] ?? null;
  const paidAmount = typeof paymentRecord?.amount === "number"
    ? Number(paymentRecord.amount)
    : Number(row.final_amount ?? 0) || (paymentAdjustment?.finalAmount ?? Number(row.quoted_amount ?? 0));
  const paymentBreakdown =
    Array.isArray(row.payment_breakdown) && row.payment_breakdown.length > 0
      ? row.payment_breakdown
          .filter((item) => typeof item?.description === "string" && typeof item?.amount === "number")
          .map((item) => ({ description: item.description ?? "", amount: Number(item.amount ?? 0) }))
      : paymentAdjustment?.rows ?? [];
  const paymentMethod = paymentRecord?.payment_method?.trim()
    ? paymentRecord.payment_method
    : workflowStatus === "cash_paid_by_user" || workflowStatus === "payment_received_by_provider" || workflowStatus === "completed"
      ? "Cash"
      : "Cash";

  return {
    id: row.id,
    service: `${row.service_label} Service`,
    provider: providerName,
    schedule: scheduleParts.schedule,
    location: row.location_text,
    status: toBookingTab(row.booking_status),
    workflowStatus,
    statusLabel: userStatusLabel(row.booking_status),
    badgeTone: toBadgeTone(row.booking_status),
    thumbnail:
      serviceKey === "chef"
        ? "food"
        : serviceKey === "driver" || serviceKey === "plumber"
          ? "car"
          : "cleaning",
    imageSrc: buildProviderPortraitSrc({
      name: providerName,
      serviceKey,
    }),
    paymentAmount: paidAmount,
    paymentMethod,
    paymentOption: paymentRecord?.payment_option === "online" ? "online" : "cash",
    paymentStatus:
      paymentRecord?.status === "paid" ||
      paymentRecord?.status === "failed" ||
      paymentRecord?.status === "cancelled" ||
      paymentRecord?.status === "refunded"
        ? paymentRecord.status
        : "pending",
    companyCommissionAmount:
      typeof paymentRecord?.company_commission_amount === "number"
        ? Number(paymentRecord.company_commission_amount)
        : 0,
    providerNetAmount:
      typeof paymentRecord?.provider_net_amount === "number"
        ? Number(paymentRecord.provider_net_amount)
        : 0,
    companyPaymentStatus:
      paymentRecord?.company_payment_status === "paid"
        ? "paid"
        : paymentRecord?.company_payment_status === "payment_process"
          ? "payment_process"
          : "pending",
    customerPaymentProofDataUrl: paymentRecord?.customer_payment_proof_data_url ?? "",
    customerPaymentProofFileName: paymentRecord?.customer_payment_proof_file_name ?? "",
    customerPaymentProofMimeType: paymentRecord?.customer_payment_proof_mime_type ?? "",
    providerCompanyPaymentProofDataUrl: paymentRecord?.provider_company_payment_proof_data_url ?? "",
    providerCompanyPaymentProofFileName: paymentRecord?.provider_company_payment_proof_file_name ?? "",
    providerCompanyPaymentProofMimeType: paymentRecord?.provider_company_payment_proof_mime_type ?? "",
    baseAmount: Number(row.booking_price ?? 0) || paymentAdjustment?.baseAmount,
    additionalCharge:
      Array.isArray(row.additional_charges)
        ? row.additional_charges.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0)
        : paymentAdjustment?.additionalCharge,
    additionalChargeDescription: paymentAdjustment?.chargeDescription,
    paymentBreakdown,
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
    paymentNote: paymentAdjustment?.note,
    notes: row.customer_note ?? "",
    cancelledBy: workflowStatus === "declined_by_provider" ? "Service provider" : "User",
    cancellationReason: row.decline_reason ?? "",
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? "",
    onTheWayAt: row.on_the_way_at ?? "",
    arrivedAt: row.arrived_at ?? "",
    workFinishedAt: row.work_finished_at ?? "",
    workConfirmedByUserAt: row.work_confirmed_by_user_at ?? "",
    paymentSentAt: row.payment_sent_at ?? "",
    cashPaidByUserAt: row.cash_paid_by_user_at ?? paymentRecord?.paid_at ?? "",
    paymentReceivedByProviderAt: row.payment_received_by_provider_at ?? "",
    completedAt: row.completed_at ?? "",
    paidAt: row.cash_paid_by_user_at ?? paymentRecord?.paid_at ?? "",
    activitySteps: buildUserActivitySteps(row.booking_status),
  };
}

async function loadProviderNames(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerIds: string[]
) {
  if (providerIds.length === 0) {
    return new Map<string, string>();
  }

  const { data } = await adminClient
    .from("provider_profiles")
    .select("id, marketing_name")
    .in("id", providerIds);

  return new Map(
    ((data ?? []) as ProviderProfileRow[]).map((row) => [
      row.id,
      row.marketing_name?.trim() || "DELLA Provider",
    ])
  );
}

export async function GET(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  let { data, error } = await verified.adminClient
    .from("bookings")
    .select(`
      id,
      provider_id,
      service_key,
      service_label,
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
      payment_records:payments(${CUSTOMER_PAYMENT_RECORDS_SELECT_FULL})
    `)
    .eq("customer_id", verified.profile.id)
    .order("created_at", { ascending: false });

  if (error && (isMissingTaskPathSchemaError(error.message) || isMissingPaymentSchemaError(error.message))) {
    const fallbackRead = await verified.adminClient
      .from("bookings")
      .select(`
        id,
        provider_id,
        service_key,
        service_label,
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
        payment_records:payments(${CUSTOMER_PAYMENT_RECORDS_SELECT_FALLBACK})
      `)
      .eq("customer_id", verified.profile.id)
      .order("created_at", { ascending: false });

    data = fallbackRead.data as typeof data;
    error = fallbackRead.error;
  }

  if (error) {
    return NextResponse.json(
      { error: mapBookingSchemaError(error.message) || "Unable to load bookings." },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as BookingRow[];
  const providerNames = await loadProviderNames(
    verified.adminClient,
    [...new Set(rows.map((row) => row.provider_id))]
  );

  return NextResponse.json({
    bookings: rows.map((row) =>
      mapLiveBookingToUi(
        row,
        providerNames.get(row.provider_id) || "DELLA Provider"
      )
    ),
  });
}

export async function POST(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json()) as BookingBody;

  if (!isValidBody(payload)) {
    return NextResponse.json(
      { error: "Booking request is missing required fields." },
      { status: 400 }
    );
  }

  if (!isUuid(payload.providerId)) {
    return NextResponse.json(
      { error: "This provider listing is no longer available. Please refresh and choose a live provider." },
      { status: 400 }
    );
  }

  const scheduledDate = parseDateLabel(payload.dateLabel);
  const scheduledStartTime = parseTimeLabel(payload.startTimeLabel);
  const scheduledEndTime = parseTimeLabel(payload.endTimeLabel);

  if (!scheduledDate || !scheduledStartTime || !scheduledEndTime) {
    return NextResponse.json(
      { error: "Booking date or time format is invalid." },
      { status: 400 }
    );
  }

  if (scheduledEndTime <= scheduledStartTime) {
    return NextResponse.json(
      { error: "End time must be later than start time." },
      { status: 400 }
    );
  }

  const scheduledDay = startOfDay(new Date(`${scheduledDate}T00:00:00`));
  const today = startOfDay(new Date());
  const maxAdvanceDay = startOfDay(new Date());
  maxAdvanceDay.setDate(maxAdvanceDay.getDate() + 30);
  const nowInKl = getCurrentKualaLumpurDateTime();

  if (scheduledDay.getTime() < today.getTime()) {
    return NextResponse.json(
      { error: "Bookings must be scheduled for today or a future date." },
      { status: 400 }
    );
  }

  if (scheduledDay.getTime() > maxAdvanceDay.getTime()) {
    return NextResponse.json(
      { error: "Bookings can only be made up to 30 days in advance." },
      { status: 400 }
    );
  }

  if (scheduledDate === nowInKl.date && scheduledStartTime <= nowInKl.time) {
    return NextResponse.json(
      { error: "This time has already passed. Please choose a future time today." },
      { status: 400 }
    );
  }

  const availabilityValidation = await validateProviderAvailabilityAndConflicts(
    verified.adminClient,
    payload.providerId,
    scheduledDate,
    scheduledStartTime,
    scheduledEndTime,
  );

  if (availabilityValidation.error) {
    return NextResponse.json(
      { error: availabilityValidation.error },
      { status: availabilityValidation.status ?? 400 },
    );
  }

  const { data: providerService } = await verified.adminClient
    .from("provider_services")
    .select("id, service_type")
    .eq("provider_id", payload.providerId)
    .eq("service_type", payload.serviceKey)
    .maybeSingle();

  const providerServiceRow = providerService as ProviderServiceRow | null;

  const bookingInsertPayload = {
    customer_id: verified.profile.id,
    provider_id: payload.providerId,
    provider_service_id: providerServiceRow?.id ?? null,
    booking_status: "pending_provider_response",
    booking_mode: payload.bookingMode,
    service_key: payload.serviceKey,
    service_label: payload.serviceLabel,
    location_text: payload.location,
    scheduled_date: scheduledDate,
    scheduled_start_time: scheduledStartTime,
    scheduled_end_time: scheduledEndTime,
    duration_hours: payload.durationHours,
    customer_note: payload.notes,
    hourly_rate: payload.hourlyRate,
    daily_rate: payload.dailyRate,
    quoted_amount: payload.totalAmount,
    booking_price: payload.totalAmount,
    final_amount: payload.totalAmount,
  };

  let { data: insertedBooking, error: bookingError } = await verified.adminClient
    .from("bookings")
    .insert(bookingInsertPayload)
    .select(`
      id,
      provider_id,
      service_key,
      service_label,
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
      created_at
    `)
    .single();

  if (bookingError && (isMissingTaskPathSchemaError(bookingError.message) || isMissingNewBookingStatusError(bookingError.message))) {
    const fallbackPayload = {
      customer_id: bookingInsertPayload.customer_id,
      provider_id: bookingInsertPayload.provider_id,
      provider_service_id: bookingInsertPayload.provider_service_id,
      booking_status: "pending",
      booking_mode: bookingInsertPayload.booking_mode,
      service_key: bookingInsertPayload.service_key,
      service_label: bookingInsertPayload.service_label,
      location_text: bookingInsertPayload.location_text,
      scheduled_date: bookingInsertPayload.scheduled_date,
      scheduled_start_time: bookingInsertPayload.scheduled_start_time,
      scheduled_end_time: bookingInsertPayload.scheduled_end_time,
      duration_hours: bookingInsertPayload.duration_hours,
      customer_note: bookingInsertPayload.customer_note,
      hourly_rate: bookingInsertPayload.hourly_rate,
      daily_rate: bookingInsertPayload.daily_rate,
      quoted_amount: bookingInsertPayload.quoted_amount,
    };

    const fallbackInsert = await verified.adminClient
      .from("bookings")
      .insert(fallbackPayload)
      .select(`
        id,
        provider_id,
        service_key,
        service_label,
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
        created_at
      `)
      .single();

    insertedBooking = fallbackInsert.data as typeof insertedBooking;
    bookingError = fallbackInsert.error;
  }

  if (bookingError || !insertedBooking) {
    return NextResponse.json(
      {
        error:
          mapBookingSchemaError(bookingError?.message) ||
          "Unable to create booking right now.",
      },
      { status: 500 }
    );
  }

  if (payload.notes.trim()) {
    await verified.adminClient.from("booking_messages").insert({
      booking_id: insertedBooking.id,
      sender_id: verified.profile.id,
      sender_role: "customer",
      message_text: payload.notes.trim(),
    });
  }

  await verified.adminClient.from("notifications").insert({
    user_id: payload.providerId,
    booking_id: insertedBooking.id,
    notification_type: "booking_created",
    title: "New booking request",
    body: `${verified.profile.full_name?.trim() || "A customer"} requested ${payload.serviceLabel} service.`,
  });

  await sendPushNotificationToUser(payload.providerId, {
    title: "New booking request",
    body: `${verified.profile.full_name?.trim() || "A customer"} requested ${payload.serviceLabel} service.`,
    bookingId: insertedBooking.id,
    path: `/provider/dashboard?booking=${insertedBooking.id}`,
  });

  const booking = mapLiveBookingToUi(
    insertedBooking as BookingRow,
    payload.providerName
  );

  return NextResponse.json({ booking }, { status: 201 });
}
