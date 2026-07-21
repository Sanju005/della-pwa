import { bookings as mockBookings } from "../data/mock-data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { DashboardBooking } from "../types";

type LiveBookingRecord = {
  id: string;
  booking_status?: string | null;
  booking_mode?: string | null;
  service_label?: string | null;
  location_text?: string | null;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  duration_hours?: number | null;
  total_amount?: number | null;
  booking_price?: number | null;
  final_amount?: number | null;
  quoted_amount?: number | null;
  hourly_rate?: number | null;
  daily_rate?: number | null;
  customer_note?: string | null;
  provider_response_note?: string | null;
  decline_reason?: string | null;
  work_finished_images?: string[] | null;
  cash_payment_proof_images?: string[] | null;
  accepted_at?: string | null;
  on_the_way_at?: string | null;
  arrived_at?: string | null;
  work_finished_at?: string | null;
  work_confirmed_by_user_at?: string | null;
  payment_sent_at?: string | null;
  cash_paid_by_user_at?: string | null;
  payment_received_by_provider_at?: string | null;
  completed_at?: string | null;
  review_requested_at?: string | null;
  reviewed_at?: string | null;
  cancelled_at?: string | null;
  additional_charges?: Array<{ amount?: number | null; description?: string | null }> | null;
  customer_id?: string | null;
  provider_id?: string | null;
  provider_profiles?: { marketing_name?: string | null }[] | { marketing_name?: string | null } | null;
  provider_services?: { service_type?: string | null }[] | { service_type?: string | null } | null;
};

type ProfileNameRow = {
  id: string;
  full_name?: string | null;
};

type PaymentDetailRow = {
  booking_id?: string | null;
  amount?: number | null;
  status?: string | null;
  payment_method?: string | null;
  payment_option?: string | null;
  customer_payment_proof_data_url?: string | null;
  customer_payment_proof_file_name?: string | null;
  customer_payment_proof_mime_type?: string | null;
  provider_company_payment_proof_data_url?: string | null;
  provider_company_payment_proof_file_name?: string | null;
  provider_company_payment_proof_mime_type?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

type ReviewDetailRow = {
  booking_id?: string | null;
  rating?: number | null;
  comment?: string | null;
  photos?: string[] | null;
  tags?: string[] | null;
  recommend?: boolean | null;
  created_at?: string | null;
};

function relationItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function resolveStorageUrl(
  bucket: "job-completion-images" | "payment-proofs" | "review-images",
  value?: string | null,
  visibility: "public" | "private" = "private",
) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || isDataUrl(trimmed) || isHttpUrl(trimmed) || !supabase) {
    return trimmed;
  }

  if (visibility === "public") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(trimmed);
    return data.publicUrl;
  }

  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(trimmed, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return "";
  }

  return signed.data.signedUrl;
}

async function resolveCompletionImageUrl(value?: string | null) {
  return resolveStorageUrl("job-completion-images", value, "private");
}

async function resolvePaymentProofUrl(value?: string | null) {
  return resolveStorageUrl("payment-proofs", value, "private");
}

async function resolveReviewImageUrl(value?: string | null) {
  return resolveStorageUrl("review-images", value, "public");
}

function formatCurrency(value: number) {
  return `RM${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(date?: string | null, time?: string | null) {
  if (!date || !time) return "-";
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "Pending";
  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function humanizeService(value?: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "Service";
  return normalized
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

async function fetchProfileNames(ids: string[]) {
  if (!supabase || ids.length === 0) return new Map<string, string>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", uniqueIds);
  if (error || !data) return new Map<string, string>();
  return new Map((data as ProfileNameRow[]).map((row) => [row.id, row.full_name?.trim() || ""]));
}

function buildTaskPath(row: LiveBookingRecord) {
  const steps = [
    ["created", "Booking Created", row.scheduled_date ? `${formatDate(row.scheduled_date)} ${formatTime(row.scheduled_date, row.scheduled_start_time)}` : ""],
    ["accepted", "Provider Accepted", row.accepted_at],
    ["on_the_way", "Provider On The Way", row.on_the_way_at],
    ["arrived", "Provider Arrived", row.arrived_at],
    ["work_finished", "Work Finished", row.work_finished_at],
    ["confirmed", "User Confirmed Work", row.work_confirmed_by_user_at],
    ["payment_sent", "Final Payment Sent", row.payment_sent_at],
    ["cash_paid", "Cash Paid By User", row.cash_paid_by_user_at],
    ["payment_received", "Payment Received By Provider", row.payment_received_by_provider_at],
    ["completed", "Task Completed", row.completed_at],
    ["review_requested", "Review Requested", row.review_requested_at],
    ["reviewed", "Reviewed", row.reviewed_at],
    ["cancelled", "Cancelled", row.cancelled_at],
  ] as const;

  return steps.map(([key, label, value]) => ({
    key,
    label,
    value: key === "created" ? value || "-" : formatDateTime(value),
    done: Boolean(value),
  }));
}

async function mapReview(row?: ReviewDetailRow | null, includeRecommend = true) {
  if (!row) {
    return undefined;
  }

  const photos = await Promise.all(
    (Array.isArray(row.photos) ? row.photos : []).map((image) => resolveReviewImageUrl(image)),
  );

  return {
    rating: Number(row.rating ?? 0).toFixed(1),
    comment: row.comment?.trim() || "No review comment provided.",
    date: formatDateTime(row.created_at),
    photos: photos.filter(Boolean),
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    recommend: includeRecommend ? row.recommend === false ? "No" : "Yes" : "",
  };
}

async function mapBookingRow(
  row: LiveBookingRecord,
  names: Map<string, string>,
  payment?: PaymentDetailRow | null,
  customerReview?: ReviewDetailRow | null,
  providerReview?: ReviewDetailRow | null,
): Promise<DashboardBooking> {
  const providerProfile = relationItem(row.provider_profiles);
  const providerService = relationItem(row.provider_services);
  const fixedAmount = Number(row.booking_price ?? row.quoted_amount ?? row.total_amount ?? 0);
  const additionalAmount = Array.isArray(row.additional_charges)
    ? row.additional_charges.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0)
    : 0;
  const totalAmount = Number(row.final_amount ?? row.total_amount ?? fixedAmount + additionalAmount);
  const completionImages = await Promise.all(
    (Array.isArray(row.work_finished_images) ? row.work_finished_images : []).map((image) =>
      resolveCompletionImageUrl(image),
    ),
  );
  const bookingPaymentProofImages = await Promise.all(
    (Array.isArray(row.cash_payment_proof_images) ? row.cash_payment_proof_images : []).map((image) =>
      resolvePaymentProofUrl(image),
    ),
  );
  const paymentProofImage = await resolvePaymentProofUrl(payment?.customer_payment_proof_data_url);
  const companyPaymentProofUrl = await resolvePaymentProofUrl(payment?.provider_company_payment_proof_data_url);
  const paymentProofImages = [
    ...bookingPaymentProofImages,
    paymentProofImage,
  ].filter(Boolean);

  return {
    id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
    rawId: row.id,
    service: row.service_label?.trim() || humanizeService(providerService?.service_type),
    provider: providerProfile?.marketing_name?.trim() || names.get(row.provider_id ?? "") || "Provider",
    providerId: row.provider_id ?? "",
    customer: names.get(row.customer_id ?? "") || "Customer",
    customerId: row.customer_id ?? "",
    status: formatStatus(row.booking_status),
    amount: formatCurrency(totalAmount),
    schedule: `${formatDate(row.scheduled_date)} ${formatTime(row.scheduled_date, row.scheduled_start_time)}`,
    bookingDate: formatDate(row.scheduled_date),
    bookingTime: formatTime(row.scheduled_date, row.scheduled_start_time),
    fixedAmount: formatCurrency(fixedAmount),
    additionalAmount: formatCurrency(additionalAmount),
    totalAmount: formatCurrency(totalAmount),
    description: row.provider_response_note?.trim() || "",
    completionImages: completionImages.filter(Boolean),
    location: row.location_text?.trim() || "No location stored.",
    bookingMode: formatStatus(row.booking_mode),
    customerNote: row.customer_note?.trim() || "",
    providerNote: row.provider_response_note?.trim() || "",
    declineReason: row.decline_reason?.trim() || "",
    hourlyRate: formatCurrency(row.hourly_rate ?? 0),
    dailyRate: formatCurrency(row.daily_rate ?? 0),
    durationHours: row.duration_hours ? `${row.duration_hours} hour${row.duration_hours === 1 ? "" : "s"}` : "-",
    taskPath: buildTaskPath(row),
    paymentProofImages,
    companyPaymentProofUrl,
    companyPaymentProofName: payment?.provider_company_payment_proof_file_name?.trim() || "",
    customerReview: await mapReview(customerReview, true),
    providerReview: await mapReview(providerReview, false),
  };
}

export async function listBookingsWithFallback() {
  if (!isSupabaseConfigured || !supabase) {
    return mockBookings;
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_status,
      booking_mode,
      service_label,
      location_text,
      scheduled_date,
      scheduled_start_time,
      scheduled_end_time,
      duration_hours,
      total_amount,
      booking_price,
      final_amount,
      quoted_amount,
      hourly_rate,
      daily_rate,
      customer_note,
      provider_response_note,
      decline_reason,
      work_finished_images,
      cash_payment_proof_images,
      accepted_at,
      on_the_way_at,
      arrived_at,
      work_finished_at,
      work_confirmed_by_user_at,
      payment_sent_at,
      cash_paid_by_user_at,
      payment_received_by_provider_at,
      completed_at,
      review_requested_at,
      reviewed_at,
      cancelled_at,
      additional_charges,
      customer_id,
      provider_id,
      provider_profiles (
        marketing_name
      ),
      provider_services (
        service_type
      )
    `)
    .order("scheduled_date", { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) {
    return mockBookings;
  }

  const rows = data as LiveBookingRecord[];
  const names = await fetchProfileNames([
    ...rows.map((row) => row.customer_id ?? ""),
    ...rows.map((row) => row.provider_id ?? ""),
  ]);

  return Promise.all(rows.map((row) => mapBookingRow(row, names)));
}

async function fetchPaymentForBooking(bookingId: string) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("payments")
    .select("booking_id, amount, status, payment_method, payment_option, customer_payment_proof_data_url, customer_payment_proof_file_name, customer_payment_proof_mime_type, provider_company_payment_proof_data_url, provider_company_payment_proof_file_name, provider_company_payment_proof_mime_type, paid_at, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as PaymentDetailRow;
}

async function fetchCustomerReviewForBooking(bookingId: string) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("reviews")
    .select("booking_id, rating, comment, photos, tags, recommend, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ReviewDetailRow;
}

async function fetchProviderReviewForBooking(bookingId: string) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("provider_customer_reviews")
    .select("booking_id, rating, comment, photos, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ReviewDetailRow;
}

async function fetchBookingDetail(bookingId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_status,
      booking_mode,
      service_label,
      location_text,
      scheduled_date,
      scheduled_start_time,
      scheduled_end_time,
      duration_hours,
      total_amount,
      booking_price,
      final_amount,
      quoted_amount,
      hourly_rate,
      daily_rate,
      customer_note,
      provider_response_note,
      decline_reason,
      work_finished_images,
      cash_payment_proof_images,
      accepted_at,
      on_the_way_at,
      arrived_at,
      work_finished_at,
      work_confirmed_by_user_at,
      payment_sent_at,
      cash_paid_by_user_at,
      payment_received_by_provider_at,
      completed_at,
      review_requested_at,
      reviewed_at,
      cancelled_at,
      additional_charges,
      customer_id,
      provider_id,
      provider_profiles (
        marketing_name
      ),
      provider_services (
        service_type
      )
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as LiveBookingRecord;
  const [names, payment, customerReview, providerReview] = await Promise.all([
    fetchProfileNames([row.customer_id ?? "", row.provider_id ?? ""]),
    fetchPaymentForBooking(row.id),
    fetchCustomerReviewForBooking(row.id),
    fetchProviderReviewForBooking(row.id),
  ]);

  return mapBookingRow(row, names, payment, customerReview, providerReview);
}

export async function getBookingDetailWithFallback(bookingId: string) {
  const liveDetail = await fetchBookingDetail(bookingId);

  if (liveDetail) {
    return liveDetail;
  }

  const all = await listBookingsWithFallback();
  return all.find((row) => row.rawId === bookingId || row.id === bookingId) ?? null;
}
