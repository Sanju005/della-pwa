import { bookings, payments, providers as mockProviders, reviews as mockReviews } from "../data/mock-data";
import { providerDetailRecords } from "../data/provider-detail-mocks";
import { isSupabaseConfigured, supabase } from "./supabase";
import type {
  ProviderCommissionRow,
  ProviderDetailRecord,
  ProviderDocumentItem,
  ProviderIdentityDocument,
  ProviderMediaItem,
  ProviderPayoutRow,
  ProviderRow,
  ProviderTaskRow,
  ProviderUpcomingTaskRow,
  UserMetric,
  UserReviewItem,
} from "../types";

type ProviderProfileRow = {
  id: string;
  marketing_name?: string | null;
  sex?: string | null;
  date_of_birth?: string | null;
  service_location?: string | null;
  formatted_address?: string | null;
  road?: string | null;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  house_number?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  service_radius_km?: number | null;
  bio?: string | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  approval_status?: string | null;
  is_visible?: boolean | null;
  provider_services?:
      | Array<{
        service_type?: string | null;
        years_experience?: string | null;
        hourly_rate?: number | null;
        daily_rate?: number | null;
        image_data_urls?: string[] | null;
        image_captions?: string[] | null;
        certificate_data_urls?: string[] | null;
        certificate_captions?: string[] | null;
        provider_service_specialties?: Array<{ specialty?: string | null }> | null;
      }>
    | null;
  provider_verifications?:
    | {
        phone_verified?: boolean | null;
        identity_verified?: boolean | null;
        kyc_verified?: boolean | null;
        background_check_verified?: boolean | null;
        document_type?: string | null;
        document_front_url?: string | null;
        document_back_url?: string | null;
        identity_document_type?: string | null;
        identity_front_image_url?: string | null;
        identity_back_image_url?: string | null;
        created_at?: string | null;
        reviewed_at?: string | null;
        last_reviewed_at?: string | null;
      }
    | Array<{
        phone_verified?: boolean | null;
        identity_verified?: boolean | null;
        kyc_verified?: boolean | null;
        background_check_verified?: boolean | null;
        document_type?: string | null;
        document_front_url?: string | null;
        document_back_url?: string | null;
        identity_document_type?: string | null;
        identity_front_image_url?: string | null;
        identity_back_image_url?: string | null;
        created_at?: string | null;
        reviewed_at?: string | null;
        last_reviewed_at?: string | null;
      }>
    | null;
};

type ProviderAccountRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

type LiveBookingRow = {
  id: string;
  booking_status?: string | null;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  total_amount?: number | null;
  customer_id?: string | null;
  provider_id?: string | null;
  provider_services?:
    | {
        service_type?: string | null;
      }
    | Array<{
        service_type?: string | null;
      }>
    | null;
};

type LivePaymentRow = {
  id: string;
  status?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
  booking_id?: string | null;
  company_commission_amount?: number | null;
  company_payment_status?: "pending" | "payment_process" | "paid" | null;
  provider_company_payment_amount?: number | null;
  admin_company_received_amount?: number | null;
  provider_company_payment_proof_data_url?: string | null;
  provider_company_payment_proof_file_name?: string | null;
  provider_company_payment_proof_mime_type?: string | null;
  company_payment_requested_at?: string | null;
};

type LiveCompanyPaymentSubmissionRow = {
  id: string;
  provider_id?: string | null;
  payable_amount_snapshot?: number | null;
  submitted_amount?: number | null;
  admin_received_amount?: number | null;
  status?: "processing" | "paid" | null;
  proof_data_url?: string | null;
  proof_file_name?: string | null;
  proof_mime_type?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
};

type LiveReviewRow = {
  id: string;
  rating?: number | null;
  comment?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
};

type ProviderProfilePayload = {
  detail: ProviderDetailRecord | null;
};

type ProfileNameRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const providerProfileSelectWithAddress = `
  id,
  marketing_name,
  sex,
  date_of_birth,
  service_location,
  formatted_address,
  road,
  suburb,
  city,
  state,
  postcode,
  country,
  house_number,
  latitude,
  longitude,
  service_radius_km,
  bio,
  average_rating,
  total_reviews,
  approval_status,
  is_visible,
  provider_services (
    service_type,
    years_experience,
    hourly_rate,
    daily_rate,
    image_data_urls,
    image_captions,
    certificate_data_urls,
    certificate_captions,
    provider_service_specialties (
      specialty
    )
  ),
  provider_verifications (
    phone_verified,
    identity_verified,
    kyc_verified,
    background_check_verified,
    document_type,
    document_front_url,
    document_back_url,
    identity_document_type,
    identity_front_image_url,
    identity_back_image_url,
    created_at,
    reviewed_at,
    last_reviewed_at
  )
`;

const providerProfileSelectBase = `
  id,
  marketing_name,
  sex,
  date_of_birth,
  service_location,
  service_radius_km,
  bio,
  average_rating,
  total_reviews,
  approval_status,
  is_visible,
  provider_services (
    service_type,
    years_experience,
    hourly_rate,
    daily_rate,
    image_data_urls,
    image_captions,
    certificate_data_urls,
    certificate_captions,
    provider_service_specialties (
      specialty
    )
  ),
  provider_verifications (
    phone_verified,
    identity_verified,
    kyc_verified,
    background_check_verified,
    document_type,
    document_front_url,
    document_back_url,
    identity_document_type,
    identity_front_image_url,
    identity_back_image_url,
    created_at,
    reviewed_at,
    last_reviewed_at
  )
`;

function relationItem<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toTitleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function formatStatus(value: string | null | undefined) {
  if (!value?.trim()) {
    return "Active";
  }

  return toTitleCase(value);
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "RM0.00";
  }

  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Recently active";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently active";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateOfBirth(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  return age >= 0 ? `${dateLabel} (${age} years)` : dateLabel;
}

function formatSchedule(dateValue?: string | null, timeValue?: string | null) {
  if (!dateValue) {
    return "Upcoming task";
  }

  const date = new Date(`${dateValue}T${timeValue ?? "09:00:00"}`);
  if (Number.isNaN(date.getTime())) {
    return "Upcoming task";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function humanizeService(value?: string | null) {
  if (!value?.trim()) {
    return "Service";
  }

  return toTitleCase(value);
}

function buildProviderAreaLabel(profile: ProviderProfileRow) {
  const cityStateCountry = [profile.city, profile.state, profile.country]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(", ");

  if (cityStateCountry) {
    return cityStateCountry;
  }

  if (profile.formatted_address?.trim()) {
    return profile.formatted_address.trim();
  }

  if (profile.service_location?.trim()) {
    return profile.service_location.trim();
  }

  return "Malaysia";
}

function mapTaskStatus(value?: string | null) {
  if (!value?.trim()) {
    return "Pending";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "in_progress") {
    return "In Progress";
  }

  if (normalized === "scheduled") {
    return "Confirmed";
  }

  return toTitleCase(normalized);
}

function findMockProviderRowByIdOrName(id: string, name?: string | null, email?: string | null) {
  const normalizedName = name?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();

  return mockProviders.find((row) => {
    if (row.id === id) {
      return true;
    }

    if (normalizedName && row.provider.trim().toLowerCase() === normalizedName) {
      return true;
    }

    if (normalizedEmail && row.provider.trim().toLowerCase() === normalizedEmail.split("@")[0]) {
      return true;
    }

    return false;
  });
}

function findMockProviderDetail(id: string, name?: string | null, email?: string | null) {
  const direct = providerDetailRecords[id];
  if (direct) {
    return direct;
  }

  const normalizedName = name?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();

  return Object.values(providerDetailRecords).find((record) => {
    if (normalizedName && record.name.trim().toLowerCase() === normalizedName) {
      return true;
    }

    if (normalizedEmail && record.email.trim().toLowerCase() === normalizedEmail) {
      return true;
    }

    return false;
  });
}

function getMockTasks(name: string) {
  const normalized = name.trim().toLowerCase();

  return bookings.filter((booking) => booking.provider.trim().toLowerCase() === normalized);
}

function getMockProviderPayments(name: string) {
  const normalized = name.trim().toLowerCase();

  return payments.filter((payment) => payment.provider.trim().toLowerCase() === normalized);
}

function getMockProviderReviews(name: string) {
  const normalized = name.trim().toLowerCase();

  return mockReviews
    .filter((review) => review.provider.trim().toLowerCase() === normalized)
    .map((review) => ({
      id: review.id,
      provider: review.customer,
      rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
      review: review.comment,
      date: review.date,
    })) satisfies UserReviewItem[];
}

async function fetchProfileNameMap(ids: Array<string | null | undefined>) {
  if (!supabase) {
    return new Map<string, string>();
  }

  const uniqueIds = [...new Set(ids.filter((value): value is string => Boolean(value?.trim())))];

  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map(
    (data as ProfileNameRow[]).map((row) => [
      row.id,
      row.full_name?.trim() || row.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Customer",
    ])
  );
}

async function fetchProviderProfiles() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const primary = await supabase
    .from("provider_profiles")
    .select(providerProfileSelectWithAddress)
    .order("average_rating", { ascending: false })
    .limit(200);

  if (!primary.error && primary.data?.length) {
    return primary.data as ProviderProfileRow[];
  }

  const fallback = await supabase
    .from("provider_profiles")
    .select(providerProfileSelectBase)
    .order("average_rating", { ascending: false })
    .limit(200);

  if (fallback.error || !fallback.data?.length) {
    return null;
  }

  return fallback.data as ProviderProfileRow[];
}

async function fetchProviderProfileById(providerId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const primary = await supabase
    .from("provider_profiles")
    .select(providerProfileSelectWithAddress)
    .eq("id", providerId)
    .maybeSingle();

  if (!primary.error && primary.data) {
    return primary.data as ProviderProfileRow;
  }

  const fallback = await supabase
    .from("provider_profiles")
    .select(providerProfileSelectBase)
    .eq("id", providerId)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    return null;
  }

  return fallback.data as ProviderProfileRow;
}

async function fetchProviderAccountById(providerId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, phone, created_at, avatar_url")
    .eq("id", providerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ProviderAccountRow;
}

function mapProviderRow(liveProfile: ProviderProfileRow, liveAccount: ProviderAccountRow | null): ProviderRow {
  const mockRow = findMockProviderRowByIdOrName(
    liveProfile.id,
    liveProfile.marketing_name ?? liveAccount?.full_name,
    liveAccount?.email
  );
  const firstService = relationItem(liveProfile.provider_services);

  return {
    id: liveProfile.id,
    provider: liveProfile.marketing_name?.trim() || liveAccount?.full_name?.trim() || mockRow?.provider || "DELLA Provider",
    service: humanizeService(firstService?.service_type) || mockRow?.service || "Service",
    rating:
      typeof liveProfile.average_rating === "number"
        ? Number(liveProfile.average_rating).toFixed(1)
        : mockRow?.rating || "0.0",
    status: formatStatus(liveAccount?.status ?? (liveProfile.is_visible === false ? "paused" : "active")),
    zone: buildProviderAreaLabel(liveProfile) || mockRow?.zone || "Malaysia",
    verification: formatStatus(liveProfile.approval_status) || mockRow?.verification || "Pending",
  };
}

async function tryFetchProviderTasks(providerId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_status,
      scheduled_date,
      scheduled_start_time,
      total_amount,
      customer_id,
      provider_id,
      provider_services (
        service_type
      )
    `)
    .eq("provider_id", providerId)
    .order("scheduled_date", { ascending: false })
    .limit(30);

  if (error || !data) {
    return null;
  }

  return data as LiveBookingRow[];
}

async function tryFetchProviderPayments(providerId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("payments")
    .select("id, booking_id, status, amount, payment_method, created_at, provider_id, company_commission_amount, company_payment_status, provider_company_payment_amount, admin_company_received_amount, provider_company_payment_proof_data_url, provider_company_payment_proof_file_name, provider_company_payment_proof_mime_type, company_payment_requested_at")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    return null;
  }

  return data as LivePaymentRow[];
}

async function tryFetchProviderCompanyPaymentSubmissions(providerId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("provider_company_payment_submissions")
    .select("id, provider_id, payable_amount_snapshot, submitted_amount, admin_received_amount, status, proof_data_url, proof_file_name, proof_mime_type, submitted_at, reviewed_at")
    .eq("provider_id", providerId)
    .order("submitted_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    return null;
  }

  return data as LiveCompanyPaymentSubmissionRow[];
}

async function tryFetchProviderReviews(providerId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, provider_id")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    return null;
  }

  return data as LiveReviewRow[];
}

function buildTaskRows(liveRows: LiveBookingRow[], customerNames: Map<string, string>): {
  completedTaskRows: ProviderTaskRow[];
  upcomingTaskRows: ProviderUpcomingTaskRow[];
} {
  const completedTaskRows = liveRows
    .filter((row) => ["completed"].includes((row.booking_status ?? "").toLowerCase()))
    .slice(0, 5)
    .map((row) => {
      const service = relationItem(row.provider_services);
      return {
        id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
        service: humanizeService(service?.service_type),
        customer: customerNames.get(row.customer_id ?? "") || "Customer",
        date: formatDate(row.scheduled_date),
        amount: formatCurrency(row.total_amount ?? 0),
        status: mapTaskStatus(row.booking_status),
      };
    });

  const upcomingTaskRows = liveRows
    .filter((row) => !["completed", "cancelled", "canceled"].includes((row.booking_status ?? "").toLowerCase()))
    .slice(0, 5)
    .map((row) => {
      const service = relationItem(row.provider_services);
      return {
        id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
        service: humanizeService(service?.service_type),
        customer: customerNames.get(row.customer_id ?? "") || "Customer",
        schedule: formatSchedule(row.scheduled_date, row.scheduled_start_time),
        amount: formatCurrency(row.total_amount ?? 0),
        status: mapTaskStatus(row.booking_status),
      };
    });

  return { completedTaskRows, upcomingTaskRows };
}

function buildPayoutRows(livePayments: LivePaymentRow[]): ProviderPayoutRow[] {
  return livePayments.slice(0, 5).map((row) => ({
    id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
    type: row.payment_method?.trim() || "Payment",
    amount: formatCurrency(row.amount ?? 0),
    date: formatDate(row.created_at),
    status: formatStatus(row.status),
  }));
}

function buildCommissionRows(
  liveSubmissions: LiveCompanyPaymentSubmissionRow[],
): Promise<ProviderCommissionRow[]> {
  return Promise.all(
    liveSubmissions.map(async (row) => ({
      submissionId: row.id,
      payableAmount: formatCurrency(row.payable_amount_snapshot ?? 0),
      depositedAmount: formatCurrency(row.submitted_amount ?? 0),
      adminReceivedAmount: formatCurrency(row.admin_received_amount ?? 0),
      submittedAt: formatDateTime(row.submitted_at ?? row.reviewed_at),
      status: row.status === "paid" ? "paid" : "processing",
      proofName: row.proof_file_name?.trim() || "No slip uploaded",
      proofUrl: await resolveAdminPaymentProofUrl(row.proof_data_url),
      proofMimeType: row.proof_mime_type?.trim() || undefined,
    })),
  );
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function resolveAdminPaymentProofUrl(value?: string | null) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || isDataUrl(trimmed) || isHttpUrl(trimmed) || !supabase) {
    return trimmed;
  }

  const signed = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(trimmed, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return "";
  }

  return signed.data.signedUrl;
}

type AdminMediaBucket =
  | "profile-images"
  | "provider-work-images"
  | "job-completion-images"
  | "payment-proofs"
  | "certificates"
  | "identity-documents";

async function resolveAdminMediaUrl(
  bucket: AdminMediaBucket,
  value?: string | null,
  visibility: "public" | "private" = "public",
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

function toMediaFileName(value?: string | null, fallback = "file") {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return fallback;
  }

  const parts = trimmed.split("/");
  return parts[parts.length - 1] || fallback;
}

async function buildProviderMediaItems(
  values: string[] | null | undefined,
  captions: string[] | null | undefined,
  bucket: AdminMediaBucket,
  visibility: "public" | "private",
  prefix: string,
): Promise<ProviderMediaItem[]> {
  const items = (values ?? []).map((item) => item?.trim() ?? "").filter(Boolean);

  return Promise.all(
    items.map(async (item, index) => ({
      id: `${prefix}-${index + 1}`,
      label: captions?.[index]?.trim() || `${toTitleCase(prefix)} ${index + 1}`,
      fileName: toMediaFileName(item, `${prefix}-${index + 1}`),
      previewUrl: await resolveAdminMediaUrl(bucket, item, visibility),
    })),
  );
}

async function buildCommissionRowsFromPayments(
  livePayments: LivePaymentRow[],
): Promise<ProviderCommissionRow[]> {
  return Promise.all(
    livePayments
      .filter((row) =>
      Number(row.company_commission_amount ?? 0) > 0 &&
      (row.company_payment_status === "payment_process" || row.company_payment_status === "paid")
    )
      .map(async (row) => ({
        submissionId: `payment:${row.id}`,
        payableAmount: formatCurrency(row.company_commission_amount ?? 0),
        depositedAmount: formatCurrency(
          row.provider_company_payment_amount ?? row.company_commission_amount ?? 0,
        ),
        adminReceivedAmount: formatCurrency(row.admin_company_received_amount ?? 0),
        submittedAt: formatDateTime(row.company_payment_requested_at ?? row.created_at),
        status: row.company_payment_status === "paid" ? "paid" : "processing",
        proofName: row.provider_company_payment_proof_file_name?.trim() || "No slip uploaded",
        proofUrl: await resolveAdminPaymentProofUrl(row.provider_company_payment_proof_data_url),
        proofMimeType: row.provider_company_payment_proof_mime_type?.trim() || undefined,
      })),
  );
}

function buildReviewRows(liveReviews: LiveReviewRow[], customerNames: Map<string, string>): UserReviewItem[] {
  return liveReviews.slice(0, 7).map((row) => ({
    id: row.id,
    provider: customerNames.get(row.customer_id ?? "") || "Customer Review",
    rating: Math.max(1, Math.min(5, Math.round(row.rating ?? 5))),
    review: row.comment?.trim() || "Shared feedback",
    date: formatDate(row.created_at),
  }));
}

function buildMetrics(
  fallbackMetrics: UserMetric[],
  taskRows: LiveBookingRow[] | null,
  paymentRows: LivePaymentRow[] | null,
  serviceAreaCount: number,
  averageRating: number | null | undefined,
  reviewCount: number | null | undefined
) {
  if (!taskRows?.length && !paymentRows?.length) {
    return fallbackMetrics;
  }

  const totalTasks = taskRows?.length ?? 0;
  const completedTasks = taskRows?.filter((row) => (row.booking_status ?? "").toLowerCase() === "completed").length ?? 0;
  const upcomingTasks =
    taskRows?.filter((row) => !["completed", "cancelled", "canceled"].includes((row.booking_status ?? "").toLowerCase())).length ?? 0;
  const totalEarnings = paymentRows?.reduce((sum, row) => sum + (row.amount ?? 0), 0) ?? 0;
  const completionRate = totalTasks > 0 ? `${((completedTasks / totalTasks) * 100).toFixed(1)}%` : "0.0%";

  return [
    { id: "lpm-1", label: "Total Tasks", value: String(totalTasks), note: "View all tasks", tone: "emerald" },
    { id: "lpm-2", label: "Completed Tasks", value: String(completedTasks), note: completionRate, tone: "emerald" },
    { id: "lpm-3", label: "Upcoming Tasks", value: String(upcomingTasks), note: "Next 7 days", tone: "violet" },
    fallbackMetrics[3] ?? { id: "lpm-4", label: "Active Time", value: "0h 0m", note: "Total logged hours", tone: "sky" },
    { id: "lpm-5", label: "Service Areas", value: String(serviceAreaCount || 1), note: "Areas covered", tone: "amber" },
    { id: "lpm-6", label: "Total Earnings", value: formatCurrency(totalEarnings), note: "All time", tone: "emerald" },
    fallbackMetrics[6] ?? { id: "lpm-7", label: "Withdrawn", value: "RM0.00", note: "Total withdrawn", tone: "violet" },
    {
      id: "lpm-8",
      label: "Reviews",
      value: String(reviewCount ?? 0),
      note: `${Number(averageRating ?? 0).toFixed(1)} average`,
      tone: "amber",
    },
  ] satisfies UserMetric[];
}

export async function listProvidersWithFallback() {
  const liveProfiles = await fetchProviderProfiles();

  if (!liveProfiles?.length) {
    return mockProviders;
  }

  const liveAccounts = await Promise.all(liveProfiles.map((profile) => fetchProviderAccountById(profile.id)));
  const liveRows = liveProfiles.map((profile, index) => mapProviderRow(profile, liveAccounts[index] ?? null));
  const seen = new Set(liveRows.flatMap((row) => [row.id.trim().toLowerCase(), row.provider.trim().toLowerCase()]));
  const mockRemainder = mockProviders.filter(
    (row) => !seen.has(row.id.trim().toLowerCase()) && !seen.has(row.provider.trim().toLowerCase())
  );

  return [...liveRows, ...mockRemainder];
}

export function buildProviderStats(rows: ProviderRow[]) {
  const activeCount = rows.filter((row) => ["active", "approved", "verified"].includes(row.status.toLowerCase())).length;
  const approvedCount = rows.filter((row) => row.verification.toLowerCase().includes("approved") || row.verification.toLowerCase().includes("verified")).length;
  const pausedCount = rows.filter((row) => ["paused", "suspended", "pending"].includes(row.status.toLowerCase())).length;

  return [
    {
      label: "Active providers",
      value: activeCount.toLocaleString("en-MY"),
      note: `${rows.length.toLocaleString("en-MY")} total provider accounts`,
    },
    {
      label: "Approved",
      value: approvedCount.toLocaleString("en-MY"),
      note: "Ready for marketplace visibility",
    },
    {
      label: "Needs review",
      value: pausedCount.toLocaleString("en-MY"),
      note: "Paused, pending, or suspended providers",
    },
  ];
}

export async function getProviderProfileWithFallback(providerId: string): Promise<ProviderProfilePayload> {
  const liveProfile = await fetchProviderProfileById(providerId);

  if (!liveProfile) {
    const fallback = providerDetailRecords[providerId] ?? null;
    return { detail: fallback };
  }

  const liveAccount = await fetchProviderAccountById(providerId);
  const fallback =
    findMockProviderDetail(providerId, liveProfile.marketing_name ?? liveAccount?.full_name, liveAccount?.email) ??
    providerDetailRecords["PRV-2034"]!;

  const firstService = relationItem(liveProfile.provider_services);
  const verification = relationItem(liveProfile.provider_verifications);
  const serviceAreas = fallback.serviceAreas.length
    ? fallback.serviceAreas.map((area, index) => ({
        ...area,
        label: index === 0 ? buildProviderAreaLabel(liveProfile) || area.label : area.label,
      }))
    : [{ id: "live-sa-1", label: buildProviderAreaLabel(liveProfile), tag: "Primary" }];

  const liveTasks = await tryFetchProviderTasks(providerId);
  const livePayments = await tryFetchProviderPayments(providerId);
  const liveCompanyPaymentSubmissions = await tryFetchProviderCompanyPaymentSubmissions(providerId);
  const liveReviews = await tryFetchProviderReviews(providerId);
  const customerNames = await fetchProfileNameMap([
    ...(liveTasks?.map((row) => row.customer_id) ?? []),
    ...(liveReviews?.map((row) => row.customer_id) ?? []),
  ]);
  const taskRows = liveTasks?.length ? buildTaskRows(liveTasks, customerNames) : null;
  const payoutRows = livePayments?.length ? buildPayoutRows(livePayments) : fallback.payoutRows;
  const paymentCommissionRows = livePayments?.length
    ? await buildCommissionRowsFromPayments(livePayments)
    : [];
  const commissionRows = paymentCommissionRows.length
    ? paymentCommissionRows
    : liveCompanyPaymentSubmissions?.length
      ? await buildCommissionRows(liveCompanyPaymentSubmissions)
      : [];
  const profileImageUrl = await resolveAdminMediaUrl("profile-images", liveAccount?.avatar_url, "public");
  const identityDocumentType =
    verification?.identity_document_type?.trim() ||
    verification?.document_type?.trim() ||
    "";
  const identityFrontValue =
    verification?.identity_front_image_url?.trim() ||
    verification?.document_front_url?.trim() ||
    "";
  const identityBackValue =
    verification?.identity_back_image_url?.trim() ||
    verification?.document_back_url?.trim() ||
    "";
  const identityDocuments = (
    await Promise.all([
      identityFrontValue
        ? (async () => ({
            id: "identity-front",
            label:
              identityDocumentType === "passport"
                ? "Passport Main Page"
                : "IC Front",
            fileName: toMediaFileName(
              identityFrontValue,
              identityDocumentType === "passport" ? "passport-main" : "ic-front",
            ),
            previewUrl: await resolveAdminMediaUrl(
              "identity-documents",
              identityFrontValue,
              "private",
            ),
          }))()
        : null,
      identityBackValue
        ? (async () => ({
            id: "identity-back",
            label:
              identityDocumentType === "passport"
                ? "Passport Supporting Page"
                : "IC Back",
            fileName: toMediaFileName(
              identityBackValue,
              identityDocumentType === "passport" ? "passport-supporting" : "ic-back",
            ),
            previewUrl: await resolveAdminMediaUrl(
              "identity-documents",
              identityBackValue,
              "private",
            ),
          }))()
        : null,
    ])
  ).filter((item): item is ProviderIdentityDocument => Boolean(item?.previewUrl));
  const workGallery = await buildProviderMediaItems(
    firstService?.image_data_urls,
    firstService?.image_captions,
    "provider-work-images",
    "public",
    "work image",
  );
  const certificates = await buildProviderMediaItems(
    firstService?.certificate_data_urls,
    firstService?.certificate_captions,
    "certificates",
    "private",
    "certificate",
  );
  const reviewRows = liveReviews?.length
    ? buildReviewRows(liveReviews, customerNames)
    : getMockProviderReviews(fallback.name).length
      ? getMockProviderReviews(fallback.name)
      : [];
  const metrics = buildMetrics(
    fallback.metrics,
    liveTasks,
    livePayments,
    serviceAreas.length,
    liveProfile.average_rating,
    liveProfile.total_reviews
  );
  const identitySubmittedAt =
    verification?.last_reviewed_at || verification?.reviewed_at || verification?.created_at
      ? formatDateTime(verification.last_reviewed_at ?? verification.reviewed_at ?? verification.created_at)
      : "";

  const status = formatStatus(liveAccount?.status ?? (liveProfile.is_visible === false ? "paused" : "active"));

  const detail: ProviderDetailRecord = {
    ...fallback,
    providerId,
    name: liveProfile.marketing_name?.trim() || liveAccount?.full_name?.trim() || fallback.name,
    email: liveAccount?.email?.trim() || fallback.email,
    profileImageUrl: profileImageUrl || fallback.profileImageUrl,
    status,
    joinedAt: formatDateTime(liveAccount?.created_at) || fallback.joinedAt,
    lastLogin: fallback.lastLogin,
    serviceType: humanizeService(firstService?.service_type),
    serviceArea: buildProviderAreaLabel(liveProfile) || fallback.serviceArea,
    rating: typeof liveProfile.average_rating === "number" ? liveProfile.average_rating.toFixed(1) : fallback.rating,
    ratingNote: `(${liveProfile.total_reviews ?? (Number(fallback.totalReviews) || 0)} reviews)`,
    phone: liveAccount?.phone?.trim() || fallback.phone,
    dob: formatDateOfBirth(liveProfile.date_of_birth) || fallback.dob,
    gender:
      liveProfile.sex === "Male" || liveProfile.sex === "Female"
        ? liveProfile.sex
        : fallback.gender,
    about: liveProfile.bio?.trim() || fallback.about,
    approvalStatus: formatStatus(liveProfile.approval_status),
    backgroundCheck: verification?.background_check_verified ? "Verified" : fallback.backgroundCheck,
    kycStatus: verification?.kyc_verified || verification?.identity_verified ? "Verified" : fallback.kycStatus,
    memberSince: formatDate(liveAccount?.created_at) || fallback.memberSince,
    completedJobs:
      taskRows?.completedTaskRows.length ? String(taskRows.completedTaskRows.length) : fallback.completedJobs,
    cancellationRate:
      liveTasks?.length
        ? `${(
            (liveTasks.filter((row) => ["cancelled", "canceled"].includes((row.booking_status ?? "").toLowerCase())).length /
              liveTasks.length) *
            100
          ).toFixed(1)}%`
        : fallback.cancellationRate,
    averageRating: typeof liveProfile.average_rating === "number" ? liveProfile.average_rating.toFixed(1) : fallback.averageRating,
    totalReviews: String(liveProfile.total_reviews ?? (Number(fallback.totalReviews) || 0)),
    totalTasks: liveTasks?.length ? String(liveTasks.length) : fallback.totalTasks,
    completedTasks: taskRows?.completedTaskRows.length ? String(taskRows.completedTaskRows.length) : fallback.completedTasks,
    upcomingTasks: taskRows?.upcomingTaskRows.length ? String(taskRows.upcomingTaskRows.length) : fallback.upcomingTasks,
    areaCount: String(serviceAreas.length),
    totalEarnings:
      livePayments?.length
        ? formatCurrency(livePayments.reduce((sum, row) => sum + (row.amount ?? 0), 0))
        : fallback.totalEarnings,
    reviewsCount: String(liveProfile.total_reviews ?? (Number(fallback.reviewsCount) || 0)),
    identityVerificationStatus: verification?.identity_verified
      ? "Verified"
      : identityDocuments.length > 0
        ? "Processing"
        : "Pending",
    identityDocumentType:
      identityDocumentType === "passport" ? "Passport" : "IC / Passport",
    identitySubmittedAt,
    metrics,
    serviceAreas,
    documents: [
      {
        id: "live-doc-1",
        label: "Phone Verification",
        status: verification?.phone_verified ? "Verified" : "Pending",
      },
      {
        id: "live-doc-2",
        label: "Identity Verification",
        status: verification?.identity_verified ? "Verified" : identityDocuments.length > 0 ? "Processing" : "Pending",
        note: identityDocuments.length > 0 ? `${identityDocuments.length} document image${identityDocuments.length > 1 ? "s" : ""} submitted` : undefined,
      },
      ...fallback.documents.slice(2),
    ] satisfies ProviderDocumentItem[],
    identityDocuments,
    workGallery: workGallery.length ? workGallery : fallback.workGallery,
    certificates: certificates.length ? certificates : fallback.certificates,
    completedTaskRows: taskRows?.completedTaskRows.length ? taskRows.completedTaskRows : fallback.completedTaskRows,
    upcomingTaskRows: taskRows?.upcomingTaskRows.length ? taskRows.upcomingTaskRows : fallback.upcomingTaskRows,
    payoutRows,
    commissionRows,
  };

  if (reviewRows.length) {
    detail.reviewsCount = String(reviewRows.length);
  }

  return { detail };
}

export async function updateProviderProfile(
  providerId: string,
  updates: {
    full_name?: string;
    email?: string;
    phone?: string;
    status?: string;
    marketing_name?: string;
    service_location?: string;
    bio?: string;
  }
) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const profilePayload = Object.fromEntries(
    Object.entries({
      full_name: updates.full_name,
      email: updates.email,
      phone: updates.phone,
      status: updates.status,
    }).filter(([, value]) => typeof value === "string" && value.trim() !== "")
  );

  const providerPayload = Object.fromEntries(
    Object.entries({
      marketing_name: updates.marketing_name,
      service_location: updates.service_location,
      bio: updates.bio,
    }).filter(([, value]) => typeof value === "string" && value.trim() !== "")
  );

  if (Object.keys(profilePayload).length) {
    const { error } = await supabase.from("profiles").update(profilePayload).eq("id", providerId);
    if (error) {
      return { error: error.message || "Unable to update provider profile." };
    }
  }

  if (Object.keys(providerPayload).length) {
    const { error } = await supabase.from("provider_profiles").update(providerPayload).eq("id", providerId);
    if (error) {
      return { error: error.message || "Unable to update provider listing." };
    }
  }

  return { error: null };
}

export async function setProviderSuspended(providerId: string, suspended: boolean) {
  return updateProviderProfile(providerId, {
    status: suspended ? "suspended" : "active",
  });
}

export async function setProviderVisibility(providerId: string, active: boolean) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const { error } = await supabase
    .from("provider_profiles")
    .update({ is_visible: active })
    .eq("id", providerId);

  if (error) {
    return { error: error.message || "Unable to update provider visibility." };
  }

  return { error: null };
}

export async function setProviderIdentityVerified(providerId: string, verified: boolean) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const now = new Date().toISOString();
  const payload = {
    identity_verified: verified,
    kyc_verified: verified,
    updated_at: now,
  };

  const { data: existingRow, error: readError } = await supabase
    .from("provider_verifications")
    .select("id, provider_id")
    .or(`provider_id.eq.${providerId},id.eq.${providerId}`)
    .limit(1)
    .maybeSingle();

  if (readError) {
    return { error: readError.message || "Unable to load identity verification record." };
  }

  if (existingRow) {
    const identifierColumn = existingRow.provider_id ? "provider_id" : "id";
    const identifierValue = existingRow.provider_id ?? existingRow.id;

    const { error } = await supabase
      .from("provider_verifications")
      .update(payload)
      .eq(identifierColumn, identifierValue);

    if (error) {
      return { error: error.message || "Unable to update identity verification." };
    }
  } else {
    const { error } = await supabase.from("provider_verifications").insert({
      provider_id: providerId,
      ...payload,
      created_at: now,
    });

    if (error) {
      return { error: error.message || "Unable to create identity verification record." };
    }
  }

  await supabase.from("notifications").insert({
    user_id: providerId,
    booking_id: null,
    notification_type: verified ? "identity_verified" : "identity_review_pending",
    title: verified ? "Identity verified" : "Identity review updated",
    body: verified
      ? "Admin has approved your identity verification documents."
      : "Admin changed your identity verification status back to pending review.",
  });

  return { error: null };
}

export async function markCompanyPaymentReceived(
  submissionId: string,
  receivedAmount: number,
  providerId: string,
) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const safeAmount = Number(receivedAmount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return { error: "Received amount is required." };
  }

  if (submissionId.startsWith("payment:")) {
    const paymentId = submissionId.slice("payment:".length).trim();

    if (!paymentId) {
      return { error: "Company payment reference is invalid." };
    }

    const { data: paymentRow, error: paymentReadError } = await supabase
      .from("payments")
      .select("id, provider_id")
      .eq("id", paymentId)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (paymentReadError || !paymentRow) {
      return { error: paymentReadError?.message || "Company payment row was not found." };
    }

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        company_payment_status: "paid",
        admin_company_received_amount: safeAmount,
        company_paid_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .eq("provider_id", providerId);

    if (paymentUpdateError) {
      return { error: paymentUpdateError.message || "Unable to mark company payment as received." };
    }

    await supabase.from("notifications").insert({
      user_id: providerId,
      booking_id: null,
      notification_type: "company_payment_received",
      title: "Company payment approved",
      body: `Admin recorded RM ${safeAmount.toFixed(2)} and marked your company payment as received.`,
    });

    return { error: null };
  }

  const { data: submissionRow, error: submissionReadError } = await supabase
    .from("provider_company_payment_submissions")
    .select("id, provider_id")
    .eq("id", submissionId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (submissionReadError || !submissionRow) {
    return { error: submissionReadError?.message || "Company payment submission was not found." };
  }

  const { error: submissionUpdateError } = await supabase
    .from("provider_company_payment_submissions")
    .update({
      status: "paid",
      admin_received_amount: safeAmount,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("provider_id", providerId);

  if (submissionUpdateError) {
    return { error: submissionUpdateError.message || "Unable to mark company payment as received." };
  }

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      company_payment_status: "paid",
    })
    .eq("provider_id", providerId)
    .eq("company_payment_submission_id", submissionId);

  if (paymentUpdateError) {
    return { error: paymentUpdateError.message || "Submission saved but linked payable rows could not be updated." };
  }

  await supabase.from("notifications").insert({
    user_id: providerId,
    booking_id: null,
    notification_type: "company_payment_received",
    title: "Company payment approved",
    body: `Admin recorded RM ${safeAmount.toFixed(2)} and marked your company payment as received.`,
  });

  return { error: null };
}
