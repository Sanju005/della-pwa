import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createIssueReport, listIssueReports } from "@/lib/issue-reports-storage";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const reports = await listIssueReports();
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load reports." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const adminClient = getAdminClient();

  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const payload = (await request.json().catch(() => ({}))) as {
    bookingId?: string;
    bookingTitle?: string;
    providerName?: string;
    schedule?: string;
    location?: string;
    paymentAmount?: number;
    paymentMethod?: string;
    message?: string;
  };

  if (!payload.bookingId || !payload.message?.trim()) {
    return NextResponse.json(
      { error: "Booking and issue details are required." },
      { status: 400 },
    );
  }

  const reporterName =
    profile?.full_name?.trim() ||
    user.email ||
    "Customer";

  try {
    const report = await createIssueReport({
      bookingId: payload.bookingId,
      bookingTitle: payload.bookingTitle?.trim() || "Booking Issue",
      providerName: payload.providerName?.trim() || "Unknown Provider",
      schedule: payload.schedule?.trim() || "",
      location: payload.location?.trim() || "",
      paymentAmount: Number(payload.paymentAmount ?? 0),
      paymentMethod: payload.paymentMethod?.trim() || "Cash",
      reporterUserId: user.id,
      reporterEmail: profile?.email?.trim() || user.email || "",
      reporterName,
      message: payload.message.trim(),
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit report." },
      { status: 500 },
    );
  }
}
