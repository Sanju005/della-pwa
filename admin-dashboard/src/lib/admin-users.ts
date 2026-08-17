import { bookings, payments, users } from "../data/mock-data";
import { userDetailRecords } from "../data/user-detail-mocks";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { DashboardBooking, PaymentRow, UserAddress, UserDetailRecord, UserMetric, UserRow } from "../types";

type ProfileRelation =
  | {
      date_of_birth?: string | null;
      sex?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      marketing_name?: string | null;
      service_location?: string | null;
      approval_status?: string | null;
    }
  | Array<{
      date_of_birth?: string | null;
      sex?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      marketing_name?: string | null;
      service_location?: string | null;
      approval_status?: string | null;
    }>
  | null;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  phone?: string | null;
  created_at?: string | null;
  avatar_url?: string | null;
  customer_profiles?: ProfileRelation;
  provider_profiles?: ProfileRelation;
};

type UserProfilePayload = {
  detail: UserDetailRecord | null;
  relatedBookings: DashboardBooking[];
  relatedPayments: PaymentRow[];
};

type UserProfileUpdateInput = {
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
};

type ProfileNameRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type LiveBookingRow = {
  id: string;
  booking_status?: string | null;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  total_amount?: number | null;
  booking_price?: number | null;
  final_amount?: number | null;
  provider_response_note?: string | null;
  work_finished_images?: string[] | null;
  additional_charges?: Array<{
    description?: string | null;
    amount?: number | null;
  }> | null;
  payment_breakdown?: Array<{
    description?: string | null;
    amount?: number | null;
  }> | null;
  customer_id?: string | null;
  provider_id?: string | null;
  provider_profiles?: ProfileRelation;
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
};

type LiveReviewRow = {
  id: string;
  rating?: number | null;
  comment?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
  provider_profiles?: ProfileRelation;
};

type AddressRow = {
  id: string;
  label: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  is_default: boolean | null;
};

type ProfileNameMap = Map<string, string>;

type AdminCustomerStatusPayload = {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerificationStatus: "pending" | "processing" | "verified" | "rejected";
  emailVerifiedAt: string;
  phoneVerifiedAt: string;
  kycVerifiedAt: string;
};

const APP_BASE_URL =
  (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim() ||
  "https://app.myswiper.my";

function relationNode(value?: ProfileRelation) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function formatVerificationDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function fetchAdminCustomerStatus(userId: string) {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  try {
    const response = await fetch(`${APP_BASE_URL}/api/admin/customer-status/${userId}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = (await response.json()) as
      | {
          status?: {
            emailVerified?: boolean;
            phoneVerified?: boolean;
            identityVerificationStatus?: "pending" | "processing" | "verified" | "rejected";
            emailVerifiedAt?: string | null;
            phoneVerifiedAt?: string | null;
            kycVerifiedAt?: string | null;
          };
        }
      | { error?: string };

    if (!response.ok || !("status" in result) || !result.status) {
      return null;
    }

    return {
      emailVerified: Boolean(result.status.emailVerified),
      phoneVerified: Boolean(result.status.phoneVerified),
      identityVerificationStatus: result.status.identityVerificationStatus ?? "pending",
      emailVerifiedAt: formatVerificationDate(result.status.emailVerifiedAt) || "",
      phoneVerifiedAt: formatVerificationDate(result.status.phoneVerifiedAt) || "",
      kycVerifiedAt: formatVerificationDate(result.status.kycVerifiedAt) || "",
    } satisfies AdminCustomerStatusPayload;
  } catch {
    return null;
  }
}

async function resolveAdminMediaUrl(
  bucket: "profile-images",
  value?: string | null,
) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || isDataUrl(trimmed) || isHttpUrl(trimmed) || !supabase) {
    return trimmed;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(trimmed);
  return data.publicUrl;
}

async function resolveCompletionImageUrl(value?: string | null) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || isDataUrl(trimmed) || isHttpUrl(trimmed) || !supabase) {
    return trimmed;
  }

  const signed = await supabase.storage
    .from("job-completion-images")
    .createSignedUrl(trimmed, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return "";
  }

  return signed.data.signedUrl;
}

function relationItem<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
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
      row.full_name?.trim() ||
        row.email?.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) ||
        "User",
    ])
  );
}

async function fetchRelatedProfileNamesForUser(userId: string, role: string) {
  if (!supabase) {
    return new Map<string, string>();
  }

  const column = role === "provider" ? "provider_id" : "customer_id";

  const [bookingsResult, paymentsResult, reviewsResult] = await Promise.all([
    supabase.from("bookings").select("customer_id, provider_id").eq(column, userId).limit(24),
    supabase.from("payments").select("customer_id, provider_id").eq(column, userId).limit(24),
    supabase.from("reviews").select("customer_id, provider_id").eq(column, userId).limit(24),
  ]);

  return fetchProfileNameMap([
    userId,
    ...((bookingsResult.data ?? []).flatMap((row) => [row.customer_id, row.provider_id])),
    ...((paymentsResult.data ?? []).flatMap((row) => [row.customer_id, row.provider_id])),
    ...((reviewsResult.data ?? []).flatMap((row) => [row.customer_id, row.provider_id])),
  ]);
}

function toTitleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function formatStatus(value: string | null | undefined, role?: string | null) {
  if (value?.trim()) {
    return toTitleCase(value);
  }

  return role === "provider" ? "Verified" : "Active";
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
    return "Upcoming booking";
  }

  const date = new Date(`${dateValue}T${timeValue ?? "09:00:00"}`);
  if (Number.isNaN(date.getTime())) {
    return "Upcoming booking";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function extractName(profile: ProfileRow) {
  const providerProfile = relationNode(profile.provider_profiles);

  if (profile.full_name?.trim()) {
    return profile.full_name.trim();
  }

  if (providerProfile?.marketing_name?.trim()) {
    return providerProfile.marketing_name.trim();
  }

  if (profile.email?.trim()) {
    return (profile.email.split("@")[0] ?? "")
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return `User ${profile.id.slice(0, 8)}`;
}

function extractCity(profile: ProfileRow) {
  const customerProfile = relationNode(profile.customer_profiles);
  const providerProfile = relationNode(profile.provider_profiles);

  const customerCity = [customerProfile?.city, customerProfile?.state, customerProfile?.country]
    .filter(Boolean)
    .join(", ");

  if (customerCity) {
    return customerCity;
  }

  if (providerProfile?.service_location?.trim()) {
    return providerProfile.service_location.trim();
  }

  return "Malaysia";
}

function buildProfileFallbackAddress(profile: ProfileRow): UserAddress[] {
  const customerProfile = relationNode(profile.customer_profiles);
  const parts = [
    customerProfile?.city?.trim(),
    customerProfile?.state?.trim(),
    customerProfile?.country?.trim(),
  ].filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  return [
    {
      id: `${profile.id}-registration-address`,
      label: "Registration Address",
      line1: parts[0] ?? "Malaysia",
      line2: parts.slice(1).join(", "),
      tag: "Default",
    },
  ];
}

function mapSavedAddress(row: AddressRow): UserAddress {
  return {
    id: row.id,
    label: row.label?.trim() || "Address",
    line1: row.address_line_1?.trim() || [row.city?.trim(), row.state?.trim()].filter(Boolean).join(", ") || "Malaysia",
    line2: [row.address_line_2?.trim(), row.postcode?.trim(), row.city?.trim(), row.state?.trim(), row.country?.trim()]
      .filter(Boolean)
      .join(", "),
    tag: row.is_default ? "Default" : undefined,
  };
}

async function fetchSavedAddressesForUser(userId: string) {
  if (!supabase) {
    return [] satisfies UserAddress[];
  }

  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, address_line_1, address_line_2, city, state, postcode, country, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [] satisfies UserAddress[];
  }

  return (data as AddressRow[]).map(mapSavedAddress);
}

function findMockDetailByUser(profile: Pick<ProfileRow, "id" | "email" | "full_name">) {
  const direct = userDetailRecords[profile.id];
  if (direct) {
    return direct;
  }

  const email = profile.email?.trim().toLowerCase();
  const fullName = profile.full_name?.trim().toLowerCase();

  return Object.values(userDetailRecords).find((record) => {
    if (email && record.email.trim().toLowerCase() === email) {
      return true;
    }

    if (fullName && record.name.trim().toLowerCase() === fullName) {
      return true;
    }

    return false;
  });
}

function findMockUserByProfile(profile: Pick<ProfileRow, "id" | "email" | "full_name">) {
  const email = profile.email?.trim().toLowerCase();
  const fullName = profile.full_name?.trim().toLowerCase();

  return users.find((row) => {
    if (row.id === profile.id) {
      return true;
    }

    if (email && row.email.trim().toLowerCase() === email) {
      return true;
    }

    if (fullName && row.name.trim().toLowerCase() === fullName) {
      return true;
    }

    return false;
  });
}

function getMockBookings(name: string, role: string) {
  const normalizedName = name.trim().toLowerCase();

  return bookings.filter((booking) =>
    role === "provider"
      ? booking.provider.trim().toLowerCase() === normalizedName
      : booking.customer.trim().toLowerCase() === normalizedName
  );
}

function getMockPayments(name: string, role: string) {
  const normalizedName = name.trim().toLowerCase();

  return payments.filter((payment) =>
    role === "provider"
      ? payment.provider.trim().toLowerCase() === normalizedName
      : payment.customer.trim().toLowerCase() === normalizedName
  );
}

function humanizeServiceType(serviceType?: string | null) {
  if (!serviceType?.trim()) {
    return "Service";
  }

  return toTitleCase(serviceType);
}

function mapBookingStatus(status?: string | null) {
  if (!status?.trim()) {
    return "Pending";
  }

  const normalized = status.trim().toLowerCase();

  if (normalized === "in_progress") {
    return "In Progress";
  }

  return toTitleCase(normalized);
}

async function tryFetchLiveBookings(userId: string, role: string, profileNames: ProfileNameMap) {
  if (!supabase) {
    return null;
  }

  const column = role === "provider" ? "provider_id" : "customer_id";

  const primaryRead = await supabase
    .from("bookings")
    .select(`
      id,
      booking_status,
      scheduled_date,
      scheduled_start_time,
      total_amount,
      booking_price,
      final_amount,
      provider_response_note,
      work_finished_images,
      additional_charges,
      payment_breakdown,
      customer_id,
      provider_id,
      provider_profiles (
        marketing_name
      ),
      provider_services (
        service_type
      )
    `)
    .eq(column, userId)
    .order("scheduled_date", { ascending: false })
    .limit(12);

  let data = primaryRead.data as LiveBookingRow[] | null;
  let error = primaryRead.error;

  if (error) {
    const fallbackRead = await supabase
      .from("bookings")
      .select(`
        id,
        booking_status,
        scheduled_date,
        scheduled_start_time,
        total_amount,
        customer_id,
        provider_id,
        provider_profiles (
          marketing_name
        ),
        provider_services (
          service_type
        )
      `)
      .eq(column, userId)
      .order("scheduled_date", { ascending: false })
      .limit(12);

    data = fallbackRead.data as LiveBookingRow[] | null;
    error = fallbackRead.error;
  }

  if (error || !data) {
    return null;
  }

  return Promise.all((data as LiveBookingRow[]).map(async (row) => {
    const providerProfile = relationNode(row.provider_profiles);
    const providerService = relationItem(row.provider_services);
    const customerName = profileNames.get(row.customer_id ?? "");
    const providerName = providerProfile?.marketing_name?.trim() || profileNames.get(row.provider_id ?? "");
    const fixedAmount = Number(row.booking_price ?? row.total_amount ?? 0);
    const additionalAmount = Array.isArray(row.additional_charges)
      ? row.additional_charges.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0)
      : 0;
    const totalAmount = Number(row.final_amount ?? row.total_amount ?? fixedAmount + additionalAmount);
    const completionImages = await Promise.all(
      (Array.isArray(row.work_finished_images) ? row.work_finished_images : []).map((image) =>
        resolveCompletionImageUrl(image),
      ),
    );

    return {
      id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
      service: humanizeServiceType(providerService?.service_type),
      provider: providerName || "DELLA Provider",
      customer: customerName || "Customer",
      status: mapBookingStatus(row.booking_status),
      amount: formatCurrency(totalAmount),
      schedule: formatSchedule(row.scheduled_date, row.scheduled_start_time),
      fixedAmount: formatCurrency(fixedAmount),
      additionalAmount: formatCurrency(additionalAmount),
      totalAmount: formatCurrency(totalAmount),
      description: row.provider_response_note?.trim() || "",
      completionImages: completionImages.filter(Boolean),
    } satisfies DashboardBooking;
  }));
}

async function tryFetchLivePayments(userId: string, role: string, profileNames: ProfileNameMap) {
  if (!supabase) {
    return null;
  }

  const column = role === "provider" ? "provider_id" : "customer_id";

  const { data, error } = await supabase
    .from("payments")
    .select(`
      id,
      status,
      amount,
      payment_method,
      created_at,
      customer_id,
      provider_id
    `)
    .eq(column, userId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data) {
    return null;
  }

  return (data as LivePaymentRow[]).map((row) => {
    const customerName = profileNames.get(row.customer_id ?? "");
    const providerName = profileNames.get(row.provider_id ?? "");

    return {
      id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
      customer: customerName || "Customer",
      provider: providerName || "Provider",
      amount: formatCurrency(row.amount ?? 0),
      method: row.payment_method?.trim() || "Online",
      status: mapBookingStatus(row.status),
      date: formatDate(row.created_at),
    };
  });
}

async function tryFetchLiveReviews(userId: string, role: string, profileNames: ProfileNameMap) {
  if (!supabase) {
    return null;
  }

  const column = role === "provider" ? "provider_id" : "customer_id";

  const { data, error } = await supabase
    .from("reviews")
    .select(`
      id,
      rating,
      comment,
      created_at,
      customer_id,
      provider_id,
      provider_profiles (
        marketing_name
      )
    `)
    .eq(column, userId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data) {
    return null;
  }

  return (data as LiveReviewRow[]).map((row) => {
    const providerProfile = relationNode(row.provider_profiles);
    const reviewerName = profileNames.get(row.customer_id ?? "");

    return {
      id: row.id,
      provider:
        role === "provider"
          ? reviewerName || "Customer Review"
          : providerProfile?.marketing_name?.trim() || profileNames.get(row.provider_id ?? "") || "DELLA Provider",
      rating: Math.max(1, Math.min(5, Math.round(row.rating ?? 5))),
      review: row.comment?.trim() || "Shared feedback",
      date: formatDate(row.created_at),
    };
  });
}

function buildMetrics(
  role: string,
  relatedBookings: DashboardBooking[],
  relatedPayments: PaymentRow[],
  fallbackMetrics: UserMetric[]
) {
  if (!relatedBookings.length && !relatedPayments.length) {
    return fallbackMetrics;
  }

  const completedCount = relatedBookings.filter((booking) =>
    ["completed", "confirmed"].includes(booking.status.trim().toLowerCase())
  ).length;
  const cancelledCount = relatedBookings.filter((booking) =>
    ["cancelled", "canceled"].includes(booking.status.trim().toLowerCase())
  ).length;
  const totalAmount = relatedPayments.reduce((sum, payment) => {
    const numeric = Number(payment.amount.replace(/[^0-9.]/g, ""));
    return Number.isNaN(numeric) ? sum : sum + numeric;
  }, 0);
  const totalBookings = relatedBookings.length;
  const completionRate = totalBookings > 0 ? `${((completedCount / totalBookings) * 100).toFixed(1)}%` : "0.0%";
  const cancellationRate = totalBookings > 0 ? `${((cancelledCount / totalBookings) * 100).toFixed(1)}%` : "0.0%";

  if (role === "provider") {
    return [
      { id: "live-1", label: "Total Jobs", value: String(totalBookings), note: "Provider bookings", tone: "emerald" },
      { id: "live-2", label: "Completed", value: String(completedCount), note: completionRate, tone: "emerald" },
      { id: "live-3", label: "Cancelled", value: String(cancelledCount), note: cancellationRate, tone: "rose" },
      { id: "live-4", label: "Lifetime Earnings", value: formatCurrency(totalAmount), note: "All time", tone: "violet" },
      fallbackMetrics[4] ?? { id: "live-5", label: "Wallet Balance", value: "RM0.00", note: "Available", tone: "amber" },
      fallbackMetrics[5] ?? { id: "live-6", label: "Reviews", value: "0", note: "Average: 0.0", tone: "sky" },
      fallbackMetrics[6] ?? { id: "live-7", label: "Reports", value: "0", note: "No issues", tone: "amber" },
    ] satisfies UserMetric[];
  }

  return [
    { id: "live-1", label: "Total Bookings", value: String(totalBookings), note: "View all bookings", tone: "emerald" },
    { id: "live-2", label: "Completed Bookings", value: String(completedCount), note: completionRate, tone: "emerald" },
    { id: "live-3", label: "Cancelled Bookings", value: String(cancelledCount), note: cancellationRate, tone: "rose" },
    { id: "live-4", label: "Total Spent", value: formatCurrency(totalAmount), note: "All time", tone: "violet" },
    fallbackMetrics[4] ?? { id: "live-5", label: "Wallet Balance", value: "RM0.00", note: "Available", tone: "amber" },
    fallbackMetrics[5] ?? { id: "live-6", label: "Reviews Given", value: "0", note: "Average: 0.0", tone: "sky" },
    fallbackMetrics[6] ?? { id: "live-7", label: "Reports Submitted", value: "0", note: "No reports", tone: "amber" },
  ] satisfies UserMetric[];
}

function mapProfileToUserRow(profile: ProfileRow): UserRow {
  const mockRow = findMockUserByProfile(profile);
  const role = profile.role?.trim() || mockRow?.role || "customer";

  return {
    id: profile.id,
    name: extractName(profile),
    email: profile.email?.trim() || mockRow?.email || "No email",
    role,
    status: formatStatus(profile.status, role),
    city: extractCity(profile) || mockRow?.city || "Malaysia",
    joined: formatDate(profile.created_at) || mockRow?.joined || "Recently",
  };
}

async function fetchProfiles() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      role,
      status,
      phone,
      created_at,
      avatar_url,
      customer_profiles (
        date_of_birth,
        sex,
        city,
        state,
        country
      ),
      provider_profiles (
        marketing_name,
        service_location,
        approval_status
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data?.length) {
    return null;
  }

  return data as ProfileRow[];
}

async function fetchProfileById(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      role,
      status,
      phone,
      created_at,
      avatar_url,
      customer_profiles (
        date_of_birth,
        sex,
        city,
        state,
        country
      ),
      provider_profiles (
        marketing_name,
        service_location,
        approval_status
      )
    `)
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ProfileRow;
}

export async function listUsersWithFallback() {
  const liveProfiles = await fetchProfiles();

  if (!liveProfiles?.length) {
    return users;
  }

  const liveRows = liveProfiles.map(mapProfileToUserRow);
  const seen = new Set(
    liveRows.flatMap((row) => [row.id.trim().toLowerCase(), row.email.trim().toLowerCase()])
  );

  const mockRemainder = users.filter(
    (row) => !seen.has(row.id.trim().toLowerCase()) && !seen.has(row.email.trim().toLowerCase())
  );

  return [...liveRows, ...mockRemainder];
}

export function buildUserStats(rows: UserRow[]) {
  const activeCount = rows.filter((row) => ["active", "verified"].includes(row.status.toLowerCase())).length;
  const customerCount = rows.filter((row) => row.role.toLowerCase() === "customer").length;
  const providerCount = rows.filter((row) => row.role.toLowerCase() === "provider").length;

  return [
    {
      label: "Active users",
      value: activeCount.toLocaleString("en-MY"),
      note: `${rows.length.toLocaleString("en-MY")} total accounts`,
    },
    {
      label: "Customers",
      value: customerCount.toLocaleString("en-MY"),
      note: "Registered marketplace customers",
    },
    {
      label: "Providers",
      value: providerCount.toLocaleString("en-MY"),
      note: "Service providers in the ecosystem",
    },
  ];
}

export async function getUserProfileWithFallback(userId: string): Promise<UserProfilePayload> {
  const mockDetail = findMockDetailByUser({ id: userId, email: null, full_name: null }) ?? userDetailRecords[userId] ?? null;

  const liveProfile = await fetchProfileById(userId);

  if (!liveProfile) {
    if (!mockDetail) {
      return {
        detail: null,
        relatedBookings: [],
        relatedPayments: [],
      };
    }

    return {
      detail: mockDetail,
      relatedBookings: getMockBookings(mockDetail.name, mockDetail.role),
      relatedPayments: getMockPayments(mockDetail.name, mockDetail.role),
    };
  }

  const name = extractName(liveProfile);
  const email = liveProfile.email?.trim() || mockDetail?.email || "No email";
  const role = liveProfile.role?.trim() || mockDetail?.role || "customer";
  const status = formatStatus(liveProfile.status, role);
  const city = extractCity(liveProfile) || mockDetail?.city || "Malaysia";
  const customerProfile = relationNode(liveProfile.customer_profiles);
  const profileNames = await fetchRelatedProfileNamesForUser(userId, role);
  const liveBookings = await tryFetchLiveBookings(userId, role, profileNames);
  const livePayments = await tryFetchLivePayments(userId, role, profileNames);
  const liveReviews = await tryFetchLiveReviews(userId, role, profileNames);
  const savedAddresses = role === "provider" ? [] : await fetchSavedAddressesForUser(userId);
  const customerStatus = role === "provider" ? null : await fetchAdminCustomerStatus(userId);
  const relatedBookings = liveBookings?.length ? liveBookings : getMockBookings(name, role);
  const relatedPayments = livePayments?.length ? livePayments : getMockPayments(name, role);
  const defaultDetail = Object.values(userDetailRecords)[0]!;
  const profileImageUrl = await resolveAdminMediaUrl("profile-images", liveProfile.avatar_url);

  const baseDetail =
    mockDetail ??
    Object.values(userDetailRecords).find((record) => record.role === role) ??
    defaultDetail;

  const metrics = buildMetrics(role, relatedBookings, relatedPayments, baseDetail.metrics);

  return {
    detail: {
      ...baseDetail,
      userId: liveProfile.id,
      name,
      email,
      profileImageUrl: profileImageUrl || baseDetail.profileImageUrl,
      role,
      status,
      phone: liveProfile.phone?.trim() || baseDetail.phone,
      emailVerified: role === "provider" ? baseDetail.emailVerified ?? true : customerStatus?.emailVerified ?? false,
      phoneVerified: role === "provider" ? baseDetail.phoneVerified ?? true : customerStatus?.phoneVerified ?? false,
      identityVerificationStatus:
        role === "provider"
          ? baseDetail.identityVerificationStatus ?? "verified"
          : customerStatus?.identityVerificationStatus ?? "pending",
      dob: formatDateOfBirth(customerProfile?.date_of_birth) || baseDetail.dob,
      gender:
        customerProfile?.sex === "Male" || customerProfile?.sex === "Female"
          ? customerProfile.sex
          : baseDetail.gender,
      city,
      addresses:
        savedAddresses.length > 0
          ? savedAddresses
          : buildProfileFallbackAddress(liveProfile).length > 0
            ? buildProfileFallbackAddress(liveProfile)
            : baseDetail.addresses,
      joined: formatDate(liveProfile.created_at),
      registeredAt: formatDateTime(liveProfile.created_at),
      lastLogin: baseDetail.lastLogin,
      accountType: toTitleCase(role),
      emailVerifiedAt: role === "provider" ? baseDetail.emailVerifiedAt : customerStatus?.emailVerifiedAt ?? "",
      phoneVerifiedAt: role === "provider" ? baseDetail.phoneVerifiedAt : customerStatus?.phoneVerifiedAt ?? "",
      kycVerifiedAt: role === "provider" ? baseDetail.kycVerifiedAt : customerStatus?.kycVerifiedAt ?? "",
      recentReviews: role === "provider" ? baseDetail.recentReviews : liveReviews ?? [],
      metrics,
    },
    relatedBookings,
    relatedPayments,
  };
}

export async function updateUserProfile(userId: string, updates: UserProfileUpdateInput) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const payload = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => typeof value === "string" && value.trim() !== "")
  );

  if (Object.keys(payload).length === 0) {
    return { error: "Nothing to update." };
  }

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);

  if (error) {
    return { error: error.message || "Unable to update user." };
  }

  return { error: null };
}

export async function setUserSuspended(userId: string, suspended: boolean) {
  return updateUserProfile(userId, {
    status: suspended ? "suspended" : "active",
  });
}

export async function deleteUserRecord(userId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const customerDelete = await supabase.from("customer_profiles").delete().eq("id", userId);
  const providerDelete = await supabase.from("provider_profiles").delete().eq("id", userId);
  const profileDelete = await supabase.from("profiles").delete().eq("id", userId);

  if (!profileDelete.error) {
    return { error: null, mode: "deleted" as const };
  }

  const softDelete = await supabase
    .from("profiles")
    .update({ status: "deleted" })
    .eq("id", userId);

  if (softDelete.error) {
    return {
      error:
        profileDelete.error.message ||
        customerDelete.error?.message ||
        providerDelete.error?.message ||
        "Unable to delete user.",
      mode: "failed" as const,
    };
  }

  return { error: null, mode: "soft-deleted" as const };
}
