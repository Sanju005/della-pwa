import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { uploadStoredMedia } from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  role: string | null;
};

type CommissionProofPayload = {
  proofDataUrl?: string;
  proofFileName?: string;
  proofMimeType?: string;
  depositedAmount?: number;
};

function isMissingCommissionPaymentSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column")
  ) && (
    normalized.includes("provider_company_payment_amount") ||
    normalized.includes("admin_company_received_amount") ||
    normalized.includes("company_payment_requested_at")
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json().catch(() => ({}))) as CommissionProofPayload;
  const params = await context.params;
  const depositedAmount = Number(payload.depositedAmount ?? 0);
  const storedProofDataUrl = payload.proofDataUrl?.trim()
    ? await uploadStoredMedia(verified.adminClient, {
        bucket: "payment-proofs",
        dataUrl: payload.proofDataUrl,
        ownerId: verified.profile.id,
        pathParts: [params.id, "provider-company-payment-proof"],
        fileName: payload.proofFileName || "provider-company-payment-proof.jpg",
        upsert: true,
        visibility: "private",
      })
    : "";

  if (!payload.proofDataUrl?.trim() || !payload.proofFileName?.trim() || !payload.proofMimeType?.trim()) {
    return NextResponse.json(
      { error: "Payment slip is required before submitting company payment." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(depositedAmount) || depositedAmount <= 0) {
    return NextResponse.json(
      { error: "Deposited amount is required." },
      { status: 400 },
    );
  }

  const { data: paymentRecord, error: paymentLookupError } = await verified.adminClient
    .from("payments")
    .select("id, status")
    .eq("booking_id", params.id)
    .eq("provider_id", verified.profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentLookupError || !paymentRecord) {
    return NextResponse.json(
      { error: paymentLookupError?.message || "No payment record was found for this booking." },
      { status: 404 },
    );
  }

  if (paymentRecord.status !== "paid") {
    return NextResponse.json(
      { error: "Customer cash payment must be marked as paid before company payment submission." },
      { status: 400 },
    );
  }

  const fullUpdatePayload = {
    company_payment_status: "payment_process",
    company_payment_requested_at: new Date().toISOString(),
    provider_company_payment_amount: depositedAmount,
    provider_company_payment_proof_data_url: storedProofDataUrl || null,
    provider_company_payment_proof_file_name: payload.proofFileName?.trim() || null,
    provider_company_payment_proof_mime_type: payload.proofMimeType?.trim() || null,
  };
  const fallbackUpdatePayload = {
    company_payment_status: "payment_process",
    provider_company_payment_proof_data_url: storedProofDataUrl || null,
    provider_company_payment_proof_file_name: payload.proofFileName?.trim() || null,
    provider_company_payment_proof_mime_type: payload.proofMimeType?.trim() || null,
  };

  let { error } = await verified.adminClient
    .from("payments")
    .update(fullUpdatePayload)
    .eq("id", paymentRecord.id);

  if (error && isMissingCommissionPaymentSchemaError(error.message)) {
    const fallbackUpdate = await verified.adminClient
      .from("payments")
      .update(fallbackUpdatePayload)
      .eq("id", paymentRecord.id);

    error = fallbackUpdate.error;
  }

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to settle company commission." },
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
        booking_id: params.id,
        notification_type: "company_payment_submitted",
        title: "Company payment submitted",
        body: `Provider uploaded a payment slip and submitted RM ${depositedAmount.toFixed(2)} for company commission review.`,
      })),
    );
  }

  return NextResponse.json({ success: true });
}
