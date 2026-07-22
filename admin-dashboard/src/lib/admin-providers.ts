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
  residential_address?: string | null;
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
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string | null;
  emergency_contact?: string | null;
  emergency_contact_number?: string | null;
};

function isMissingColumnError(message?: string | null) {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("column") || normalized.includes("schema cache");
}

function cleanEditableValue(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed.toLowerCase() !== "not provided" ? trimmed : undefined;
}

function normalizeDateInput(value?: string) {
  const cleaned = cleanEditableValue(value)?.replace(/\s*\([^)]*\)\s*$/, "");

  if (!cleaned) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  const parsed = new Date(cleaned);

  if (Number.isNaN(parsed.getTime())) {
    return cleaned;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type ProviderRegistrationSnapshot = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  data?: {
    basicProfile?: {
      firstName?: string | null;
      lastName?: string | null;
      emergencyContact?: string | null;
      emergencyContactNumber?: string | null;
      avatarDataUrl?: string | null;
      unitNumber?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      postcode?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
    } | null;
    verification?: {
      documentType?: string | null;
      frontImageDataUrl?: string | null;
      backImageDataUrl?: string | null;
    } | null;
    serviceDetails?: Record<
      string,
      {
        imageDataUrls?: string[] | null;
        certificateDataUrls?: string[] | null;
      }
    > | null;
  } | null;
};

type ProviderAdminDebugPayload = {
  stored?: {
    authMetadata?: Record<string, unknown> | null;
    providerRegistrationSnapshot?: ProviderRegistrationSnapshot | null;
    profile?: ProviderAccountRow | null;
    providerProfile?: Omit<ProviderProfileRow, "provider_services" | "provider_verifications"> | null;
    providerVerification?:
      | {
          phone_verified?: boolean | null;
          email_verified?: boolean | null;
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
      | null;
    providerServices?:
      | Array<{
          id?: string | null;
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
  } | null;
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
  booking_id?: string | null;
  rating?: number | null;
  comment?: string | null;
  photos?: string[] | null;
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

const APP_BASE_URL =
  (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim() ||
  "https://app.dellaapp.com";

const providerProfileSelectWithAddress = `
  id,
  marketing_name,
  sex,
  date_of_birth,
  residential_address,
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
  residential_address,
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

function createEmptyProviderDetail(providerId: string, name?: string | null, email?: string | null): ProviderDetailRecord {
  return {
    providerId,
    name: name?.trim() || "DELLA Provider",
    email: email?.trim() || "No email",
    status: "Pending",
    roleBadge: "Provider",
    joinedAt: "Recently joined",
    lastLogin: "No recent login",
    serviceType: "Service",
    serviceArea: "Malaysia",
    rating: "0.0",
    ratingNote: "(0 reviews)",
    phone: "Not provided",
    dob: "Not provided",
    gender: "Not provided",
    language: "Not provided",
    nationalId: "Not provided",
    emergencyContact: "Not provided",
    address: "Not provided",
    about: "Provider profile details are still syncing from registration.",
    approvalStatus: "Pending",
    backgroundCheck: "Pending",
    kycStatus: "Pending",
    memberSince: "Recently",
    device: "Not available",
    completedJobs: "0",
    cancellationRate: "0.0%",
    responseRate: "0.0%",
    averageRating: "0.0",
    totalReviews: "0",
    onTimeRate: "0.0%",
    repeatCustomers: "0.0%",
    workingDays: "Not set",
    workingHours: "Not set",
    totalTasks: "0",
    completedTasks: "0",
    upcomingTasks: "0",
    activeTime: "0h 0m",
    areaCount: "1",
    totalEarnings: "RM0.00",
    withdrawn: "RM0.00",
    reviewsCount: "0",
    metrics: [
      { id: "live-pm-1", label: "Total Tasks", value: "0", note: "View all tasks", tone: "emerald" },
      { id: "live-pm-2", label: "Completed Tasks", value: "0", note: "0.0%", tone: "emerald" },
      { id: "live-pm-3", label: "Upcoming Tasks", value: "0", note: "Next 7 days", tone: "violet" },
      { id: "live-pm-4", label: "Active Time", value: "0h 0m", note: "Total logged hours", tone: "sky" },
      { id: "live-pm-5", label: "Service Areas", value: "1", note: "Areas covered", tone: "amber" },
      { id: "live-pm-6", label: "Total Earnings", value: "RM0.00", note: "All time", tone: "emerald" },
      { id: "live-pm-7", label: "Withdrawn", value: "RM0.00", note: "Total withdrawn", tone: "violet" },
      { id: "live-pm-8", label: "Reviews", value: "0", note: "0.0 average", tone: "amber" },
    ],
    serviceAreas: [],
    skills: [],
    documents: [],
    completedTaskRows: [],
    upcomingTaskRows: [],
    payoutRows: [],
    commissionRows: [],
    recentActions: [],
    activityLog: [],
  };
}

function buildSnapshotResidentialAddress(snapshot?: ProviderRegistrationSnapshot | null) {
  const basicProfile = snapshot?.data?.basicProfile;

  if (!basicProfile) {
    return "";
  }

  return [
    basicProfile.unitNumber,
    basicProfile.addressLine1,
    basicProfile.addressLine2,
    basicProfile.postcode,
    basicProfile.city,
    basicProfile.state,
    basicProfile.country,
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(", ");
}

function buildProviderAddressLabel(
  profile: ProviderProfileRow,
  snapshot?: ProviderRegistrationSnapshot | null,
) {
  const directAddress = [
    profile.residential_address,
    profile.formatted_address,
    [profile.house_number, profile.road, profile.suburb].map((value) => value?.trim() || "").filter(Boolean).join(", "),
    [profile.postcode, profile.city, profile.state, profile.country].map((value) => value?.trim() || "").filter(Boolean).join(", "),
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(", ");

  if (directAddress) {
    return directAddress;
  }

  return buildSnapshotResidentialAddress(snapshot);
}

function metadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function joinNameParts(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function buildProviderPersonName(
  account?: ProviderAccountRow | null,
  snapshot?: ProviderRegistrationSnapshot | null,
  authMetadata?: Record<string, unknown> | null,
) {
  const snapshotProfile = snapshot?.data?.basicProfile;
  const profileName = joinNameParts(account?.first_name, account?.last_name);
  const snapshotName = joinNameParts(snapshotProfile?.firstName, snapshotProfile?.lastName);
  const metadataName = joinNameParts(
    metadataText(authMetadata, "first_name"),
    metadataText(authMetadata, "last_name"),
  );

  return (
    profileName ||
    snapshotName ||
    metadataName ||
    account?.full_name?.trim() ||
    metadataText(authMetadata, "full_name")
  );
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

  const primary = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name, email, role, status, phone, created_at, avatar_url, emergency_contact, emergency_contact_number")
    .eq("id", providerId)
    .maybeSingle();

  if (!primary.error && primary.data) {
    return primary.data as ProviderAccountRow;
  }

  const fallback = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, phone, created_at, avatar_url")
    .eq("id", providerId)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    return null;
  }

  return fallback.data as ProviderAccountRow;
}

async function fetchProviderRegistrationSnapshot(providerId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("provider_registration_submissions")
    .select("id, created_at, updated_at, status, data")
    .eq("id", providerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ProviderRegistrationSnapshot;
}

async function fetchProviderAdminDebugPayload(providerId: string) {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  let response: Response;

  try {
    response = await fetch(`${APP_BASE_URL}/api/admin/provider-registration-debug/${providerId}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ProviderAdminDebugPayload;
}

async function fetchLatestTaskDatesByProvider(providerIds: string[]) {
  if (!supabase || providerIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("provider_id, scheduled_date, scheduled_start_time, created_at")
    .in("provider_id", providerIds)
    .order("scheduled_date", { ascending: false })
    .limit(500);

  if (error || !data) {
    return new Map<string, string>();
  }

  const latest = new Map<string, string>();

  (data as Array<{ provider_id?: string | null; scheduled_date?: string | null; scheduled_start_time?: string | null; created_at?: string | null }>).forEach((row) => {
    const providerId = row.provider_id?.trim();
    const timestamp = row.scheduled_date
      ? `${row.scheduled_date}T${row.scheduled_start_time || "00:00"}`
      : row.created_at ?? "";

    if (!providerId || !timestamp) {
      return;
    }

    const current = latest.get(providerId);

    if (!current || new Date(timestamp).getTime() > new Date(current).getTime()) {
      latest.set(providerId, timestamp);
    }
  });

  return latest;
}

function mapProviderRow(
  liveProfile: ProviderProfileRow,
  liveAccount: ProviderAccountRow | null,
  latestTaskDates: Map<string, string> = new Map(),
): ProviderRow {
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
    registeredAt: liveAccount?.created_at ?? "",
    latestTaskAt: latestTaskDates.get(liveProfile.id) ?? "",
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
    .select("id, booking_id, rating, comment, photos, created_at, customer_id, provider_id")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    return null;
  }

  return data as LiveReviewRow[];
}

async function tryFetchProviderGivenReviews(providerId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("provider_customer_reviews")
    .select("id, booking_id, rating, comment, photos, created_at, customer_id, provider_id")
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
        rawId: row.id,
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
        rawId: row.id,
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
  | "review-images"
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return "";
  }

  const response = await fetch(`${APP_BASE_URL}/api/admin/media-sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      bucket,
      path: trimmed,
      expiresInSeconds: 60 * 60,
    }),
  });

  const result = (await response.json()) as {
    signedUrl?: string;
    error?: string;
  };

  if (!response.ok || !result.signedUrl) {
    return "";
  }

  return result.signedUrl;
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

async function buildProviderMediaItemsFromServices(
  services:
    | Array<{
        service_type?: string | null;
        image_data_urls?: string[] | null;
        image_captions?: string[] | null;
        certificate_data_urls?: string[] | null;
        certificate_captions?: string[] | null;
      }>
    | null
    | undefined,
  kind: "work" | "certificate",
): Promise<ProviderMediaItem[]> {
  const items = (services ?? []).flatMap((service, serviceIndex) => {
    const values =
      kind === "work"
        ? service.image_data_urls ?? []
        : service.certificate_data_urls ?? [];
    const captions =
      kind === "work"
        ? service.image_captions ?? []
        : service.certificate_captions ?? [];
    const serviceLabel = humanizeService(service.service_type);

    return values
      .map((value, index) => {
        const trimmed = value?.trim() ?? "";

        if (!trimmed) {
          return null;
        }

        return {
          id: `${kind}-${serviceIndex + 1}-${index + 1}`,
          label:
            captions[index]?.trim() ||
            `${serviceLabel} ${kind === "work" ? "Work Image" : "Certificate"} ${index + 1}`,
          fileName: toMediaFileName(
            trimmed,
            `${kind}-${serviceIndex + 1}-${index + 1}`,
          ),
          rawValue: trimmed,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  });

  const bucket = kind === "work" ? "provider-work-images" : "certificates";
  const visibility = kind === "work" ? "public" : "private";

  const resolved = await Promise.all(
    items.map(async (item) => ({
      id: item.id,
      label: item.label,
      fileName: item.fileName,
      previewUrl: await resolveAdminMediaUrl(bucket, item.rawValue, visibility),
    })),
  );

  return resolved.filter((item) => Boolean(item.previewUrl));
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

async function buildReviewRows(
  liveReviews: LiveReviewRow[],
  customerNames: Map<string, string>,
  direction: "received" | "given",
): Promise<UserReviewItem[]> {
  return Promise.all(
    liveReviews.slice(0, 12).map(async (row) => {
      const photos = await Promise.all(
        (Array.isArray(row.photos) ? row.photos : []).map((photo) =>
          resolveAdminMediaUrl("review-images", photo, "public"),
        ),
      );

      return {
        id: row.id,
        provider: customerNames.get(row.customer_id ?? "") || "Customer",
        rating: Math.max(1, Math.min(5, Math.round(row.rating ?? 5))),
        review: row.comment?.trim() || "Shared feedback",
        date: formatDate(row.created_at),
        taskId: row.booking_id ? `#${row.booking_id.slice(0, 8).toUpperCase()}` : "-",
        photos: photos.filter(Boolean),
        direction,
      };
    }),
  );
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
  const latestTaskDates = await fetchLatestTaskDatesByProvider(liveProfiles.map((profile) => profile.id));
  const liveRows = liveProfiles.map((profile, index) => mapProviderRow(profile, liveAccounts[index] ?? null, latestTaskDates));
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
  const initialLiveProfile = await fetchProviderProfileById(providerId);

  if (!initialLiveProfile) {
    const debugPayload = await fetchProviderAdminDebugPayload(providerId);
    const debugProfile = debugPayload?.stored?.providerProfile;

    if (!debugProfile) {
      const fallback = providerDetailRecords[providerId] ?? null;
      return { detail: fallback };
    }
  }

  const liveAccount = await fetchProviderAccountById(providerId);
  const [registrationSnapshot, debugPayload] = await Promise.all([
    fetchProviderRegistrationSnapshot(providerId),
    fetchProviderAdminDebugPayload(providerId),
  ]);
  const debugRegistrationSnapshot =
    debugPayload?.stored?.providerRegistrationSnapshot ?? null;
  const authMetadata = debugPayload?.stored?.authMetadata ?? null;
  const debugProfile = debugPayload?.stored?.providerProfile ?? null;
  const debugVerification = debugPayload?.stored?.providerVerification ?? null;
  const debugServices = debugPayload?.stored?.providerServices ?? null;
  const liveProfile = initialLiveProfile
    ? {
        ...initialLiveProfile,
        provider_services: initialLiveProfile.provider_services?.length
          ? initialLiveProfile.provider_services
          : debugServices,
        provider_verifications: debugVerification
          ? [debugVerification]
          : initialLiveProfile.provider_verifications,
      }
    : debugProfile
      ? {
          ...debugProfile,
          provider_services: debugServices,
          provider_verifications: debugVerification ? [debugVerification] : null,
        }
      : null;
  const effectiveLiveAccount = liveAccount ?? debugPayload?.stored?.profile ?? null;
  const effectiveRegistrationSnapshot = registrationSnapshot ?? debugRegistrationSnapshot;

  if (!liveProfile) {
    const fallback = providerDetailRecords[providerId] ?? null;
    return { detail: fallback };
  }
  const fallback =
    findMockProviderDetail(providerId, liveProfile.marketing_name ?? effectiveLiveAccount?.full_name, effectiveLiveAccount?.email) ??
    createEmptyProviderDetail(providerId, liveProfile.marketing_name ?? effectiveLiveAccount?.full_name, effectiveLiveAccount?.email);
  const personName =
    buildProviderPersonName(effectiveLiveAccount, effectiveRegistrationSnapshot, authMetadata) ||
    liveProfile.marketing_name?.trim() ||
    fallback.name;

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
  const liveGivenReviews = await tryFetchProviderGivenReviews(providerId);
  const customerNames = await fetchProfileNameMap([
    ...(liveTasks?.map((row) => row.customer_id) ?? []),
    ...(liveReviews?.map((row) => row.customer_id) ?? []),
    ...(liveGivenReviews?.map((row) => row.customer_id) ?? []),
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
    effectiveRegistrationSnapshot?.data?.verification?.documentType?.trim() ||
    (typeof authMetadata?.identity_document_type === "string" ? authMetadata.identity_document_type.trim() : "") ||
    verification?.document_type?.trim() ||
    "";
  const identityFrontValue =
    verification?.identity_front_image_url?.trim() ||
    effectiveRegistrationSnapshot?.data?.verification?.frontImageDataUrl?.trim() ||
    verification?.document_front_url?.trim() ||
    "";
  const identityBackValue =
    verification?.identity_back_image_url?.trim() ||
    effectiveRegistrationSnapshot?.data?.verification?.backImageDataUrl?.trim() ||
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
  const workGallery = await buildProviderMediaItemsFromServices(
    liveProfile.provider_services,
    "work",
  );
  const certificates = await buildProviderMediaItemsFromServices(
    liveProfile.provider_services,
    "certificate",
  );
  const snapshotServiceDetails = effectiveRegistrationSnapshot?.data?.serviceDetails ?? null;
  const emergencyContact =
    effectiveLiveAccount?.emergency_contact_number?.trim() ||
    effectiveLiveAccount?.emergency_contact?.trim() ||
    (typeof authMetadata?.emergency_contact_number === "string" ? authMetadata.emergency_contact_number.trim() : "") ||
    (typeof authMetadata?.emergency_contact === "string" ? authMetadata.emergency_contact.trim() : "") ||
    effectiveRegistrationSnapshot?.data?.basicProfile?.emergencyContactNumber?.trim() ||
    effectiveRegistrationSnapshot?.data?.basicProfile?.emergencyContact?.trim() ||
    fallback.emergencyContact;
  const reviewsReceived = liveReviews?.length
    ? await buildReviewRows(liveReviews, customerNames, "received")
    : getMockProviderReviews(fallback.name).length
      ? getMockProviderReviews(fallback.name)
      : [];
  const reviewsGiven = liveGivenReviews?.length
    ? await buildReviewRows(liveGivenReviews, customerNames, "given")
    : [];
  const reviewRows = reviewsReceived;
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
    name: personName,
    email: effectiveLiveAccount?.email?.trim() || fallback.email,
    profileImageUrl: profileImageUrl || fallback.profileImageUrl,
    status,
    joinedAt: formatDateTime(effectiveLiveAccount?.created_at) || fallback.joinedAt,
    lastLogin: fallback.lastLogin,
    serviceType: humanizeService(firstService?.service_type),
    serviceArea: buildProviderAreaLabel(liveProfile) || fallback.serviceArea,
    rating: typeof liveProfile.average_rating === "number" ? liveProfile.average_rating.toFixed(1) : fallback.rating,
    ratingNote: `(${liveProfile.total_reviews ?? (Number(fallback.totalReviews) || 0)} reviews)`,
    phone: effectiveLiveAccount?.phone?.trim() || fallback.phone,
    emergencyContact,
    address: buildProviderAddressLabel(liveProfile, effectiveRegistrationSnapshot) || fallback.address,
    dob: formatDateOfBirth(liveProfile.date_of_birth) || fallback.dob,
    gender:
      liveProfile.sex === "Male" || liveProfile.sex === "Female"
        ? liveProfile.sex
        : fallback.gender,
    about: liveProfile.bio?.trim() || fallback.about,
    approvalStatus: formatStatus(liveProfile.approval_status),
    backgroundCheck: verification?.background_check_verified ? "Verified" : fallback.backgroundCheck,
    kycStatus: verification?.kyc_verified || verification?.identity_verified ? "Verified" : fallback.kycStatus,
    memberSince: formatDate(effectiveLiveAccount?.created_at) || fallback.memberSince,
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
    skills:
      (liveProfile.provider_services ?? [])
        .flatMap((service) => [
          service.service_type ? { id: `skill-service-${service.service_type}`, label: humanizeService(service.service_type) } : null,
          ...(service.provider_service_specialties ?? []).map((specialty, index) =>
            specialty.specialty?.trim()
              ? { id: `skill-specialty-${service.service_type ?? "service"}-${index + 1}`, label: specialty.specialty.trim() }
              : null,
          ),
        ])
        .filter((item): item is { id: string; label: string } => Boolean(item))
        .slice(0, 8),
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
    workGallery:
      workGallery.length
        ? workGallery
        : await (async () => {
            const items = Object.entries(snapshotServiceDetails ?? {}).flatMap(([service, details]) =>
              (details?.imageDataUrls ?? []).map((value, index) => ({
                id: `snapshot-work-${service}-${index + 1}`,
                label: `${humanizeService(service)} Work ${index + 1}`,
                fileName: toMediaFileName(value, `${service}-work-${index + 1}`),
                previewUrl: value,
              })),
            );
            return items.filter((item) => item.previewUrl);
          })().then((items) => (items.length ? items : fallback.workGallery)),
    certificates:
      certificates.length
        ? certificates
        : await (async () => {
            const items = Object.entries(snapshotServiceDetails ?? {}).flatMap(([service, details]) =>
              (details?.certificateDataUrls ?? []).map((value, index) => ({
                id: `snapshot-certificate-${service}-${index + 1}`,
                label: `${humanizeService(service)} Certificate ${index + 1}`,
                fileName: toMediaFileName(value, `${service}-certificate-${index + 1}`),
                previewUrl: value,
              })),
            );
            return items.filter((item) => item.previewUrl);
          })().then((items) => (items.length ? items : fallback.certificates)),
    completedTaskRows: taskRows?.completedTaskRows.length ? taskRows.completedTaskRows : fallback.completedTaskRows,
    upcomingTaskRows: taskRows?.upcomingTaskRows.length ? taskRows.upcomingTaskRows : fallback.upcomingTaskRows,
    payoutRows,
    commissionRows,
    providerReviewsReceived: reviewRows,
    providerReviewsGiven: reviewsGiven,
  };

  if (reviewRows.length || reviewsGiven.length) {
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
    emergency_contact?: string;
    date_of_birth?: string;
    gender?: string;
    language?: string;
    national_id?: string;
    address?: string;
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
      emergency_contact: updates.emergency_contact,
      emergency_contact_number: updates.emergency_contact,
    }).map(([key, value]) => [key, cleanEditableValue(value)])
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
  );

  const providerPayload = Object.fromEntries(
    Object.entries({
      marketing_name: updates.marketing_name,
      service_location: updates.service_location,
      date_of_birth: normalizeDateInput(updates.date_of_birth),
      sex: updates.gender,
      languages: updates.language,
      national_id: updates.national_id,
      residential_address: updates.address,
      formatted_address: updates.address,
      bio: updates.bio,
    }).map(([key, value]) => [key, cleanEditableValue(value)])
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
  );

  if (Object.keys(profilePayload).length) {
    const { error } = await supabase.from("profiles").update(profilePayload).eq("id", providerId);
    if (error) {
      return { error: error.message || "Unable to update provider profile." };
    }
  }

  if (Object.keys(providerPayload).length) {
    const { error } = await supabase.from("provider_profiles").update(providerPayload).eq("id", providerId);
    if (error && isMissingColumnError(error.message)) {
      const safeProviderPayload = Object.fromEntries(
        Object.entries({
          marketing_name: updates.marketing_name,
          service_location: updates.service_location,
          date_of_birth: normalizeDateInput(updates.date_of_birth),
          sex: updates.gender,
          residential_address: updates.address,
          formatted_address: updates.address,
          bio: updates.bio,
        }).map(([key, value]) => [key, cleanEditableValue(value)])
          .filter(([, value]) => typeof value === "string" && value.trim() !== "")
      );
      const fallback = await supabase.from("provider_profiles").update(safeProviderPayload).eq("id", providerId);

      if (fallback.error) {
        return { error: fallback.error.message || "Unable to update provider listing." };
      }
    } else if (error) {
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

type IdentityDocumentSide = "front" | "back";

async function postProviderIdentityDocumentAction(
  providerId: string,
  payload: {
    action: "upload" | "delete" | "verify";
    side?: IdentityDocumentSide;
    dataUrl?: string;
    fileName?: string;
    documentType?: string;
    verified?: boolean;
    note?: string;
  },
) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { error: "Admin session is required." };
  }

  try {
    const response = await fetch(`${APP_BASE_URL}/api/admin/provider-identity-documents/${providerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      return { error: result.error || "Unable to update identity document." };
    }

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to update identity document.",
    };
  }
}

export async function setProviderIdentityVerified(
  providerId: string,
  verified: boolean,
  documentType?: string,
  note?: string,
) {
  return postProviderIdentityDocumentAction(providerId, {
    action: "verify",
    verified,
    documentType,
    note,
  });
}

export async function uploadProviderIdentityDocument(
  providerId: string,
  side: IdentityDocumentSide,
  dataUrl: string,
  fileName: string,
  documentType?: string,
) {
  return postProviderIdentityDocumentAction(providerId, {
    action: "upload",
    side,
    dataUrl,
    fileName,
    documentType,
  });
}

export async function deleteProviderIdentityDocument(
  providerId: string,
  side: IdentityDocumentSide,
  documentType?: string,
) {
  return postProviderIdentityDocumentAction(providerId, {
    action: "delete",
    side,
    documentType,
  });
}

type ProviderMediaKind = "profile" | "work" | "certificate";

async function postProviderMediaAction(
  providerId: string,
  payload: {
    action: "upload" | "delete";
    kind: ProviderMediaKind;
    dataUrl?: string;
    fileName?: string;
    mediaId?: string;
  },
) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { error: "Admin session is required." };
  }

  try {
    const response = await fetch(`${APP_BASE_URL}/api/admin/provider-media/${providerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      return { error: result.error || "Unable to update provider media." };
    }

    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to update provider media.",
    };
  }
}

export async function uploadProviderMedia(
  providerId: string,
  kind: ProviderMediaKind,
  dataUrl: string,
  fileName: string,
) {
  return postProviderMediaAction(providerId, {
    action: "upload",
    kind,
    dataUrl,
    fileName,
  });
}

export async function deleteProviderMedia(
  providerId: string,
  kind: ProviderMediaKind,
  mediaId?: string,
) {
  return postProviderMediaAction(providerId, {
    action: "delete",
    kind,
    mediaId,
  });
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
