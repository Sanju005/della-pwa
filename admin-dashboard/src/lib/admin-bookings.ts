import { bookings as mockBookings } from "../data/mock-data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { DashboardBooking } from "../types";

type LiveBookingRecord = {
  id: string;
  booking_status?: string | null;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  total_amount?: number | null;
  booking_price?: number | null;
  final_amount?: number | null;
  provider_response_note?: string | null;
  work_finished_images?: string[] | null;
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

function relationItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
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

async function mapBookingRow(row: LiveBookingRecord, names: Map<string, string>): Promise<DashboardBooking> {
  const providerProfile = relationItem(row.provider_profiles);
  const providerService = relationItem(row.provider_services);
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
    rawId: row.id,
    service: humanizeService(providerService?.service_type),
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
      scheduled_date,
      scheduled_start_time,
      total_amount,
      booking_price,
      final_amount,
      provider_response_note,
      work_finished_images,
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

export async function getBookingDetailWithFallback(bookingId: string) {
  const all = await listBookingsWithFallback();
  return all.find((row) => row.rawId === bookingId || row.id === bookingId) ?? null;
}
