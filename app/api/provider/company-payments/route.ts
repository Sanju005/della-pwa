import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  role: string | null;
};

type SubmissionPayload = {
  proofDataUrl?: string;
  proofFileName?: string;
  proofMimeType?: string;
  depositedAmount?: number;
};

function isMissingCompanyPaymentSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column") ||
    normalized.includes("relation")
  ) && (
    normalized.includes("company_commission_amount") ||
    normalized.includes("company_payment_status") ||
    normalized.includes("company_payment_submission_id") ||
    normalized.includes("provider_company_payment_submissions")
  );
}

function isMissingCompanyPaymentSubmissionSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column") ||
    normalized.includes("relation")
  ) && (
    normalized.includes("provider_company_payment_submissions") ||
    normalized.includes("company_payment_submission_id")
  );
}

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

async function verifyProviderRequest(request: Request) {
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

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json({ error: "This account is not a provider account." }, { status: 403 }),
    };
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  };
}

function toCurrency(value: number | null | undefined) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

async function loadCompanyPaymentSummary(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerId: string,
) {
  let { data: paymentRows, error: paymentError } = await adminClient
    .from("payments")
    .select("id, company_commission_amount, company_payment_status, status")
    .eq("provider_id", providerId)
    .eq("status", "paid");

  if (paymentError && isMissingCompanyPaymentSchemaError(paymentError.message)) {
    const fallbackRead = await adminClient
      .from("payments")
      .select("id, status")
      .eq("provider_id", providerId)
      .eq("status", "paid");

    paymentRows = (fallbackRead.data ?? []).map((row) => ({
      ...row,
      company_commission_amount: 0,
      company_payment_status: null,
    }));
    paymentError = fallbackRead.error;
  }

  if (paymentError) {
    return { error: paymentError.message || "Unable to load company payable summary." };
  }

  const payableRows = (paymentRows ?? []).filter(
    (row) =>
      Number(row.company_commission_amount ?? 0) > 0 &&
      (row.company_payment_status === null || row.company_payment_status === "pending"),
  );
  const processingRows = (paymentRows ?? []).filter(
    (row) =>
      Number(row.company_commission_amount ?? 0) > 0 &&
      row.company_payment_status === "payment_process",
  );

  let { data: submissionRows, error: submissionError } = await adminClient
    .from("provider_company_payment_submissions")
    .select("id, payable_amount_snapshot, submitted_amount, admin_received_amount, status, proof_file_name, submitted_at, reviewed_at")
    .eq("provider_id", providerId)
    .order("submitted_at", { ascending: false })
    .limit(10);

  if (submissionError && !isMissingCompanyPaymentSubmissionSchemaError(submissionError.message)) {
    return { error: submissionError.message || "Unable to load company payment submissions." };
  }

  if (submissionError && isMissingCompanyPaymentSubmissionSchemaError(submissionError.message)) {
    submissionRows = [];
    submissionError = null;
  }

  const activeSubmission = (submissionRows ?? []).find((row) => row.status === "processing") ?? null;

  return {
    error: null,
    summary: {
      payableAmount: toCurrency(
        payableRows.reduce((sum, row) => sum + Number(row.company_commission_amount ?? 0), 0),
      ),
      processingAmount: activeSubmission
        ? toCurrency(activeSubmission.payable_amount_snapshot ?? activeSubmission.submitted_amount ?? 0)
        : toCurrency(
            processingRows.reduce((sum, row) => sum + Number(row.company_commission_amount ?? 0), 0),
          ),
      latestSubmission: activeSubmission
        ? {
            id: activeSubmission.id,
            payableAmountSnapshot: toCurrency(activeSubmission.payable_amount_snapshot ?? 0),
            submittedAmount: toCurrency(activeSubmission.submitted_amount ?? 0),
            adminReceivedAmount: toCurrency(activeSubmission.admin_received_amount ?? 0),
            status: activeSubmission.status,
            proofFileName: activeSubmission.proof_file_name ?? "",
            submittedAt: activeSubmission.submitted_at ?? "",
            reviewedAt: activeSubmission.reviewed_at ?? "",
          }
        : null,
    },
  };
}

export async function GET(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const summaryResult = await loadCompanyPaymentSummary(verified.adminClient, verified.profile.id);

  if (summaryResult.error) {
    return NextResponse.json({ error: summaryResult.error }, { status: 500 });
  }

  return NextResponse.json(summaryResult.summary);
}

export async function POST(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json().catch(() => ({}))) as SubmissionPayload;
  const depositedAmount = toCurrency(Number(payload.depositedAmount ?? 0));

  if (!payload.proofDataUrl?.trim() || !payload.proofFileName?.trim() || !payload.proofMimeType?.trim()) {
    return NextResponse.json(
      { error: "Payment slip is required before submitting company payment." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(depositedAmount) || depositedAmount <= 0) {
    return NextResponse.json({ error: "Deposited amount is required." }, { status: 400 });
  }

  const summaryResult = await loadCompanyPaymentSummary(verified.adminClient, verified.profile.id);

  if (summaryResult.error) {
    return NextResponse.json({ error: summaryResult.error }, { status: 500 });
  }

  const summary = summaryResult.summary;

  if ((summary?.latestSubmission?.status ?? "") === "processing") {
    return NextResponse.json(
      { error: "A company payment submission is already processing." },
      { status: 400 },
    );
  }

  if ((summary?.payableAmount ?? 0) <= 0) {
    return NextResponse.json(
      { error: "No company payable amount is available right now." },
      { status: 400 },
    );
  }

  if (depositedAmount !== toCurrency(summary?.payableAmount ?? 0)) {
    return NextResponse.json(
      {
        error: `Deposited amount must be exactly RM ${toCurrency(summary?.payableAmount ?? 0).toFixed(2)}.`,
      },
      { status: 400 },
    );
  }

  let { data: pendingPaymentRows, error: pendingPaymentError } = await verified.adminClient
    .from("payments")
    .select("id")
    .eq("provider_id", verified.profile.id)
    .eq("status", "paid")
    .or("company_payment_status.is.null,company_payment_status.eq.pending")
    .gt("company_commission_amount", 0);

  if (pendingPaymentError && isMissingCompanyPaymentSchemaError(pendingPaymentError.message)) {
    const fallbackRead = await verified.adminClient
      .from("payments")
      .select("id")
      .eq("provider_id", verified.profile.id)
      .eq("status", "paid");

    pendingPaymentRows = fallbackRead.data;
    pendingPaymentError = fallbackRead.error;
  }

  if (pendingPaymentError) {
    return NextResponse.json(
      { error: pendingPaymentError.message || "Unable to load payable company rows." },
      { status: 500 },
    );
  }

  if (!(pendingPaymentRows ?? []).length) {
    return NextResponse.json(
      { error: "No payable company amount is available right now." },
      { status: 400 },
    );
  }

  const { data: submission, error: submissionError } = await verified.adminClient
    .from("provider_company_payment_submissions")
    .insert({
      provider_id: verified.profile.id,
      payable_amount_snapshot: summary?.payableAmount ?? 0,
      submitted_amount: depositedAmount,
      status: "processing",
      proof_data_url: payload.proofDataUrl.trim(),
      proof_file_name: payload.proofFileName.trim(),
      proof_mime_type: payload.proofMimeType.trim(),
    })
    .select("id")
    .single();

  if (submissionError && isMissingCompanyPaymentSubmissionSchemaError(submissionError.message)) {
    const pendingPaymentIds = (pendingPaymentRows ?? []).map((row) => row.id);
    const { error: fallbackPaymentUpdateError } = await verified.adminClient
      .from("payments")
      .update({
        company_payment_status: "payment_process",
      })
      .in("id", pendingPaymentIds);

    if (fallbackPaymentUpdateError) {
      return NextResponse.json(
        { error: fallbackPaymentUpdateError.message || "Unable to move payable company rows into processing." },
        { status: 500 },
      );
    }

    const { data: adminProfiles } = await verified.adminClient
      .from("profiles")
      .select("id")
      .in("role", ["super_admin", "admin", "manager", "customer_care"]);

    if (adminProfiles?.length) {
      await verified.adminClient.from("notifications").insert(
        adminProfiles.map((admin) => ({
          user_id: admin.id,
          booking_id: null,
          notification_type: "company_payment_submitted",
          title: "Company payment submitted",
          body: `Provider submitted RM ${depositedAmount.toFixed(2)} for company payable review.`,
        })),
      );
    }

    return NextResponse.json({
      success: true,
      summary: {
        payableAmount: 0,
        processingAmount: summary?.payableAmount ?? 0,
        latestSubmission: null,
      },
    });
  }

  if (submissionError || !submission) {
    return NextResponse.json(
      { error: submissionError?.message || "Unable to create company payment submission." },
      { status: 500 },
    );
  }

  const pendingPaymentIds = (pendingPaymentRows ?? []).map((row) => row.id);
  let { error: paymentUpdateError } = await verified.adminClient
    .from("payments")
    .update({
      company_payment_status: "payment_process",
      company_payment_submission_id: submission.id,
    })
    .in("id", pendingPaymentIds);

  if (paymentUpdateError && isMissingCompanyPaymentSubmissionSchemaError(paymentUpdateError.message)) {
    const fallbackPaymentUpdate = await verified.adminClient
      .from("payments")
      .update({
        company_payment_status: "payment_process",
      })
      .in("id", pendingPaymentIds);

    paymentUpdateError = fallbackPaymentUpdate.error;
  }

  if (paymentUpdateError) {
    return NextResponse.json(
      { error: paymentUpdateError.message || "Unable to move payable company rows into processing." },
      { status: 500 },
    );
  }

  const { data: adminProfiles } = await verified.adminClient
    .from("profiles")
    .select("id")
    .in("role", ["super_admin", "admin", "manager", "customer_care"]);

  if (adminProfiles?.length) {
    await verified.adminClient.from("notifications").insert(
      adminProfiles.map((admin) => ({
        user_id: admin.id,
        booking_id: null,
        notification_type: "company_payment_submitted",
        title: "Company payment submitted",
        body: `Provider submitted RM ${depositedAmount.toFixed(2)} for company payable review.`,
      })),
    );
  }

  const refreshedSummary = await loadCompanyPaymentSummary(verified.adminClient, verified.profile.id);

  if (refreshedSummary.error) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true, summary: refreshedSummary.summary });
}
