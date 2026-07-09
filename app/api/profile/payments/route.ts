import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { PaymentHistoryItem } from "@/lib/profile-types";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  role: string | null;
};

type PaymentRow = {
  id: string;
  booking_id?: string | null;
  provider_id: string | null;
  service_title: string | null;
  amount: number | null;
  payment_method: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
};

type BookingPaymentFallbackRow = {
  id: string;
  provider_id: string | null;
  service_label: string | null;
  booking_status: string | null;
  final_amount: number | null;
  quoted_amount: number | null;
  booking_price: number | null;
  cash_paid_by_user_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type ProviderProfileRow = {
  id: string;
  marketing_name: string | null;
};

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

async function retrySupabaseRequest<T>(operation: () => PromiseLike<T>, attempts = 3) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  throw lastError;
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

  let userId = "";

  try {
    const claimsResult = await retrySupabaseRequest(() => adminClient.auth.getClaims(token));

    if (claimsResult.error || !claimsResult.data?.claims?.sub) {
      return {
        error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
      };
    }

    userId = String(claimsResult.data.claims.sub);
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to verify session." },
        { status: 503 },
      ),
    };
  }

  let profileResult: { data: unknown; error: { message?: string } | null };

  try {
    profileResult = await retrySupabaseRequest(() =>
      adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle()
    );
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to load customer profile." },
        { status: 503 },
      ),
    };
  }

  const { data: profile, error: profileError } = profileResult;

  if (profileError || !profile) {
    return {
      error: NextResponse.json({ error: "Customer profile was not found." }, { status: 404 }),
    };
  }

  if (isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json({ error: "This account is a provider account." }, { status: 403 }),
    };
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  };
}

async function loadProviderNames(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerIds: string[],
) {
  if (providerIds.length === 0) {
    return new Map<string, string>();
  }

  const { data } = await retrySupabaseRequest(() =>
    adminClient
      .from("provider_profiles")
      .select("id, marketing_name")
      .in("id", providerIds)
  );

  return new Map(
    ((data ?? []) as ProviderProfileRow[]).map((row) => [
      row.id,
      row.marketing_name?.trim() || "DELLA Provider",
    ]),
  );
}

function isCompletedBookingStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase() ?? "";
  return (
    normalized === "completed" ||
    normalized === "paid" ||
    normalized === "review_requested" ||
    normalized === "reviewed"
  );
}

function toPaymentHistoryItem(
  row: PaymentRow,
  providerName: string,
): PaymentHistoryItem | null {
  const normalizedStatus = row.status?.trim().toLowerCase();
  if (normalizedStatus !== "paid" && normalizedStatus !== "refunded") {
    return null;
  }

  const paidAt = row.paid_at?.trim() || row.created_at?.trim() || null;
  if (!paidAt) {
    return null;
  }

  return {
    id: row.id,
    serviceCategory: "Service",
    serviceTitle: row.service_title?.trim() || "Service Payment",
    provider: providerName,
    amount: typeof row.amount === "number" ? Number(row.amount) : 0,
    paidAt,
    paymentMethod: row.payment_method?.trim() || "Cash",
    status: normalizedStatus,
  };
}

function toFallbackPaymentHistoryItem(
  row: BookingPaymentFallbackRow,
  providerName: string,
): PaymentHistoryItem | null {
  if (!isCompletedBookingStatus(row.booking_status)) {
    return null;
  }

  const paidAt = row.cash_paid_by_user_at?.trim() || row.completed_at?.trim() || row.created_at?.trim() || null;
  if (!paidAt) {
    return null;
  }

  return {
    id: `booking-${row.id}`,
    serviceCategory: "Service",
    serviceTitle: `${row.service_label?.trim() || "Service"} Service`,
    provider: providerName,
    amount: Number(row.final_amount ?? row.quoted_amount ?? row.booking_price ?? 0),
    paidAt,
    paymentMethod: "Cash",
    status: "paid",
  };
}

export async function GET(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const { data, error } = await retrySupabaseRequest(() =>
    verified.adminClient
      .from("payments")
      .select("id, booking_id, provider_id, service_title, amount, payment_method, status, paid_at, created_at")
      .eq("customer_id", verified.profile.id)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(200)
  );

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to load payments." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as PaymentRow[];
  const paidBookingIds = new Set(rows.map((row) => row.booking_id).filter(Boolean));
  const { data: fallbackBookingRows, error: fallbackError } = await retrySupabaseRequest(() =>
    verified.adminClient
      .from("bookings")
      .select("id, provider_id, service_label, booking_status, final_amount, quoted_amount, booking_price, cash_paid_by_user_at, completed_at, created_at")
      .eq("customer_id", verified.profile.id)
      .in("booking_status", ["completed", "paid", "review_requested", "reviewed"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(200)
  );

  if (fallbackError) {
    return NextResponse.json(
      { error: fallbackError.message || "Unable to load payments." },
      { status: 500 },
    );
  }

  const fallbackRows = ((fallbackBookingRows ?? []) as BookingPaymentFallbackRow[]).filter(
    (row) => !paidBookingIds.has(row.id),
  );
  const providerNames = await loadProviderNames(
    verified.adminClient,
    [
      ...new Set(
        [...rows.map((row) => row.provider_id), ...fallbackRows.map((row) => row.provider_id)]
          .filter((value): value is string => Boolean(value)),
      ),
    ],
  );

  const payments = [
    ...rows
      .map((row) => toPaymentHistoryItem(row, providerNames.get(row.provider_id ?? "") || "DELLA Provider"))
      .filter((item): item is PaymentHistoryItem => item !== null),
    ...fallbackRows
      .map((row) => toFallbackPaymentHistoryItem(row, providerNames.get(row.provider_id ?? "") || "DELLA Provider"))
      .filter((item): item is PaymentHistoryItem => item !== null),
  ].sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime());

  return NextResponse.json({ payments });
}
