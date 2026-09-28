import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Swiper uses only super_admin/provider/customer as real roles today — admin,
// manager, and customer_care were never assigned to any live account and
// have been removed from every authorization check (see
// SWIPER_CRITICAL_SECURITY_REMEDIATION.md).
const ALLOWED_ADMIN_ROLES = new Set(["super_admin"]);

function buildCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin === "https://admin.myswiper.my" ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
      ? origin
      : "https://admin.myswiper.my";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

type MarkPaidBody = {
  providerId?: string;
  receivedAmount?: number;
};

// Marks a provider's company-payment submission as received. Previously
// done as two direct writes from the admin dashboard's own browser session
// straight to `payments`/`provider_company_payment_submissions` — but a
// September 2026 migration (20260908_lock_down_bookings_payments_direct_
// writes.sql) revoked UPDATE on `payments` from the `authenticated` role
// with no carve-out, so that path has been failing on every real approval
// since (it would mark the submission paid, then fail updating the linked
// payments row, leaving `company_payment_status` stuck at "payment_process"
// forever). Moved here to go through the service-role client instead, with
// an explicit already-paid check so a double-click/replay can't silently
// overwrite a previously recorded amount.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  const cors = buildCorsHeaders(origin);

  const verified = await verifyAdminRequest(request);
  if ("error" in verified && verified.error) {
    const failureResponse = verified.error;
    Object.entries(cors).forEach(([key, value]) => {
      failureResponse.headers.set(key, value);
    });
    return failureResponse;
  }
  const { adminClient } = verified as { adminClient: NonNullable<ReturnType<typeof getAdminClient>> };

  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as MarkPaidBody;
  const providerId = payload.providerId?.trim() ?? "";
  const receivedAmount = Number(payload.receivedAmount);

  if (!providerId) {
    return NextResponse.json({ error: "Provider id is required." }, { status: 400, headers: cors });
  }
  if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) {
    return NextResponse.json({ error: "Received amount is required." }, { status: 400, headers: cors });
  }

  const nowIso = new Date().toISOString();

  if (id.startsWith("payment:")) {
    const paymentId = id.slice("payment:".length).trim();

    if (!paymentId) {
      return NextResponse.json({ error: "Company payment reference is invalid." }, { status: 400, headers: cors });
    }

    const { data: paymentRow, error: paymentReadError } = await adminClient
      .from("payments")
      .select("id, provider_id, company_payment_submission_id, company_payment_status")
      .eq("id", paymentId)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (paymentReadError || !paymentRow) {
      return NextResponse.json(
        { error: paymentReadError?.message || "Company payment row was not found." },
        { status: 404, headers: cors },
      );
    }

    if (paymentRow.company_payment_status === "paid") {
      return NextResponse.json(
        { error: "This payment has already been marked as received." },
        { status: 409, headers: cors },
      );
    }

    const { error: paymentUpdateError } = await adminClient
      .from("payments")
      .update({
        company_payment_status: "paid",
        admin_company_received_amount: receivedAmount,
        company_paid_at: nowIso,
      })
      .eq("id", paymentId)
      .eq("provider_id", providerId)
      .neq("company_payment_status", "paid");

    if (paymentUpdateError) {
      return NextResponse.json(
        { error: paymentUpdateError.message || "Unable to mark company payment as received." },
        { status: 500, headers: cors },
      );
    }

    const linkedSubmissionId = paymentRow.company_payment_submission_id as string | null;

    if (linkedSubmissionId) {
      const { error: linkedSubmissionUpdateError } = await adminClient
        .from("provider_company_payment_submissions")
        .update({
          status: "paid",
          admin_received_amount: receivedAmount,
          reviewed_at: nowIso,
        })
        .eq("id", linkedSubmissionId)
        .eq("provider_id", providerId);

      if (linkedSubmissionUpdateError) {
        return NextResponse.json(
          {
            error:
              linkedSubmissionUpdateError.message ||
              "Payment was recorded but the linked submission could not be updated.",
          },
          { status: 500, headers: cors },
        );
      }
    }

    await adminClient.from("notifications").insert({
      user_id: providerId,
      booking_id: null,
      notification_type: "company_payment_received",
      title: "Company payment approved",
      body: `Admin recorded RM ${receivedAmount.toFixed(2)} and marked your company payment as received.`,
    });

    return NextResponse.json({ success: true }, { headers: cors });
  }

  const { data: submissionRow, error: submissionReadError } = await adminClient
    .from("provider_company_payment_submissions")
    .select("id, provider_id, status")
    .eq("id", id)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (submissionReadError || !submissionRow) {
    return NextResponse.json(
      { error: submissionReadError?.message || "Company payment submission was not found." },
      { status: 404, headers: cors },
    );
  }

  if (submissionRow.status === "paid") {
    return NextResponse.json(
      { error: "This payment has already been marked as received." },
      { status: 409, headers: cors },
    );
  }

  const { error: submissionUpdateError } = await adminClient
    .from("provider_company_payment_submissions")
    .update({
      status: "paid",
      admin_received_amount: receivedAmount,
      reviewed_at: nowIso,
    })
    .eq("id", id)
    .eq("provider_id", providerId)
    .neq("status", "paid");

  if (submissionUpdateError) {
    return NextResponse.json(
      { error: submissionUpdateError.message || "Unable to mark company payment as received." },
      { status: 500, headers: cors },
    );
  }

  const { error: paymentUpdateError } = await adminClient
    .from("payments")
    .update({ company_payment_status: "paid" })
    .eq("provider_id", providerId)
    .eq("company_payment_submission_id", id);

  if (paymentUpdateError) {
    return NextResponse.json(
      { error: paymentUpdateError.message || "Submission saved but linked payable rows could not be updated." },
      { status: 500, headers: cors },
    );
  }

  await adminClient.from("notifications").insert({
    user_id: providerId,
    booking_id: null,
    notification_type: "company_payment_received",
    title: "Company payment approved",
    body: `Admin recorded RM ${receivedAmount.toFixed(2)} and marked your company payment as received.`,
  });

  return NextResponse.json({ success: true }, { headers: cors });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(request.headers.get("origin")) });
}
