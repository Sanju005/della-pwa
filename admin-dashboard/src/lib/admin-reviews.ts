import { reviews as mockReviews } from "../data/mock-data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { ReviewRow } from "../types";

type LiveReviewRecord = {
  id: string;
  rating?: number | null;
  comment?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
  flagged?: boolean | null;
  is_hidden?: boolean | null;
};

type ProfileNameRow = {
  id: string;
  full_name?: string | null;
};

type ProviderNameRow = {
  id: string;
  marketing_name?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRating(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0.0";
  }

  return value.toFixed(1);
}

function mapStatus(row: LiveReviewRecord) {
  if (row.is_hidden) {
    return "Needs Review";
  }

  if (row.flagged) {
    return "Flagged";
  }

  return "Published";
}

async function fetchCustomerNames(ids: string[]) {
  if (!supabase || ids.length === 0) {
    return new Map<string, string>();
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map((data as ProfileNameRow[]).map((row) => [row.id, row.full_name?.trim() || "Customer"]));
}

async function fetchProviderNames(ids: string[]) {
  if (!supabase || ids.length === 0) {
    return new Map<string, string>();
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("provider_profiles")
    .select("id, marketing_name")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map(
    (data as ProviderNameRow[]).map((row) => [row.id, row.marketing_name?.trim() || "DELLA Provider"]),
  );
}

export async function listReviewsWithFallback() {
  if (!isSupabaseConfigured || !supabase) {
    return mockReviews;
  }

  const primary = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, customer_id, provider_id, flagged, is_hidden")
    .order("created_at", { ascending: false })
    .limit(100);

  let data = primary.data as LiveReviewRecord[] | null;
  let error = primary.error;

  if (error) {
    const fallback = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, customer_id, provider_id")
      .order("created_at", { ascending: false })
      .limit(100);

    data = fallback.data as LiveReviewRecord[] | null;
    error = fallback.error;
  }

  if (error || !data || data.length === 0) {
    return mockReviews;
  }

  const [customerNames, providerNames] = await Promise.all([
    fetchCustomerNames(data.map((row) => row.customer_id ?? "")),
    fetchProviderNames(data.map((row) => row.provider_id ?? "")),
  ]);

  return data.map((row) => ({
    id: row.id.startsWith("REV-") ? row.id : `REV-${row.id.slice(0, 8).toUpperCase()}`,
    customer: customerNames.get(row.customer_id ?? "") || "Customer",
    provider: providerNames.get(row.provider_id ?? "") || "DELLA Provider",
    rating: formatRating(row.rating),
    comment: row.comment?.trim() || "Shared feedback",
    status: mapStatus(row),
    date: formatDate(row.created_at),
  })) satisfies ReviewRow[];
}

export function buildReviewStats(rows: ReviewRow[]) {
  const publishedCount = rows.filter((row) => row.status.toLowerCase() === "published").length;
  const flaggedCount = rows.filter((row) => row.status.toLowerCase().includes("flag")).length;
  const average =
    rows.length > 0
      ? (
          rows.reduce((sum, row) => sum + (Number(row.rating) || 0), 0) / rows.length
        ).toFixed(2)
      : "0.00";

  return [
    {
      label: "Published",
      value: publishedCount.toLocaleString("en-MY"),
      note: "Visible marketplace reviews",
    },
    {
      label: "Flagged",
      value: flaggedCount.toLocaleString("en-MY"),
      note: "Awaiting moderation",
    },
    {
      label: "Average rating",
      value: average,
      note: "Live platform review score",
    },
  ];
}
