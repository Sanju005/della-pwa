import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "manager",
  "customer_care",
]);

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type AvailabilityRow = {
  id: string;
  day_of_week: string;
  time_mode: string | null;
  start_time: string | null;
  end_time: string | null;
};

type AvailabilityPayload = {
  enabled?: boolean;
  entries?: Array<{
    day?: string;
    startTime?: string;
    endTime?: string;
    timeMode?: string;
  }>;
};

function buildCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin === "https://admin.myswiper.my" ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
      ? origin
      : "https://admin.myswiper.my";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

function getAdminClient() {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyAdminRequest(request: Request) {
  const adminClient = getAdminClient();

  if (!adminClient) {
    return {
      error: NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 }),
    } as const;
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    } as const;
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    } as const;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !ALLOWED_ADMIN_ROLES.has(profile.role ?? "")) {
    return {
      error: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    } as const;
  }

  return { adminClient } as const;
}

function normalizeDay(value: string) {
  return value.trim().toLowerCase();
}

function labelDay(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
}

function sortRows(rows: AvailabilityRow[]) {
  return [...rows].sort(
    (left, right) =>
      DAY_ORDER.indexOf(normalizeDay(left.day_of_week) as (typeof DAY_ORDER)[number]) -
      DAY_ORDER.indexOf(normalizeDay(right.day_of_week) as (typeof DAY_ORDER)[number]),
  );
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin")),
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));
  const verified = await verifyAdminRequest(request);

  if ("error" in verified && verified.error) {
    const failureResponse = verified.error;
    Object.entries(corsHeaders).forEach(([key, value]) => {
      failureResponse.headers.set(key, value);
    });
    return failureResponse;
  }

  try {
    const { id } = await params;

    const [{ data: rows, error }, { data: listing }] = await Promise.all([
      verified.adminClient
        .from("provider_availability")
        .select("id, day_of_week, time_mode, start_time, end_time")
        .eq("provider_id", id),
      verified.adminClient
        .from("provider_profiles")
        .select("is_visible")
        .eq("id", id)
        .maybeSingle(),
    ]);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Unable to load provider availability." },
        { status: 500, headers: corsHeaders },
      );
    }

    const orderedRows = sortRows((rows ?? []) as AvailabilityRow[]);

    return NextResponse.json(
      {
        enabled: Boolean(listing?.is_visible ?? true),
        entries: orderedRows.map((row) => ({
          id: row.id,
          day: labelDay(row.day_of_week),
          dayKey: normalizeDay(row.day_of_week),
          timeMode: row.time_mode ?? "custom",
          startTime: row.start_time?.slice(0, 5) ?? "08:00",
          endTime: row.end_time?.slice(0, 5) ?? "20:00",
        })),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load provider availability." },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));
  const verified = await verifyAdminRequest(request);

  if ("error" in verified && verified.error) {
    const failureResponse = verified.error;
    Object.entries(corsHeaders).forEach(([key, value]) => {
      failureResponse.headers.set(key, value);
    });
    return failureResponse;
  }

  try {
    const { id } = await params;
    const payload = (await request.json()) as AvailabilityPayload;
    const enabled = Boolean(payload.enabled);
    const selectedEntries = (payload.entries ?? [])
      .map((entry) => ({
        day: normalizeDay(entry.day ?? ""),
        startTime: entry.startTime?.trim() || "08:00",
        endTime: entry.endTime?.trim() || "20:00",
        timeMode: entry.timeMode?.trim() || "custom",
      }))
      .filter(
        (entry): entry is {
          day: (typeof DAY_ORDER)[number];
          startTime: string;
          endTime: string;
          timeMode: string;
        } => DAY_ORDER.includes(entry.day as (typeof DAY_ORDER)[number]),
      );

    if (enabled && selectedEntries.length === 0) {
      return NextResponse.json(
        { error: "Select at least one day before saving availability." },
        { status: 400, headers: corsHeaders },
      );
    }

    const hasInvalidRange = selectedEntries.some((entry) => entry.startTime >= entry.endTime);

    if (enabled && hasInvalidRange) {
      return NextResponse.json(
        { error: "Each selected day must have an end time later than the start time." },
        { status: 400, headers: corsHeaders },
      );
    }

    const deleteExisting = await verified.adminClient
      .from("provider_availability")
      .delete()
      .eq("provider_id", id);

    if (deleteExisting.error) {
      return NextResponse.json(
        { error: deleteExisting.error.message || "Unable to clear previous availability." },
        { status: 500, headers: corsHeaders },
      );
    }

    if (enabled && selectedEntries.length > 0) {
      const insertRows = selectedEntries.map((entry) => ({
        provider_id: id,
        day_of_week: entry.day,
        time_mode: entry.timeMode,
        start_time: entry.startTime,
        end_time: entry.endTime,
      }));

      const insertResult = await verified.adminClient
        .from("provider_availability")
        .insert(insertRows);

      if (insertResult.error) {
        return NextResponse.json(
          { error: insertResult.error.message || "Unable to save availability." },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    const visibilityResult = await verified.adminClient
      .from("provider_profiles")
      .update({ is_visible: enabled })
      .eq("id", id);

    if (visibilityResult.error) {
      return NextResponse.json(
        { error: visibilityResult.error.message || "Availability saved, but visibility update failed." },
        { status: 500, headers: corsHeaders },
      );
    }

    return GET(request, { params: Promise.resolve({ id }) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save provider availability." },
      { status: 500, headers: corsHeaders },
    );
  }
}
