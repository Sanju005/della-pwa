import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { createOtpChallenge, type OtpPurpose } from "@/lib/otp-verification";
import { checkAndRecordRateLimit } from "@/lib/auth-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// Optional — present when an already-logged-in customer is re-verifying
// their phone/email from the profile screens; absent during registration,
// where no session exists yet. Either way this is only used to tag the
// challenge row for traceability, never to authorize the send itself.
async function resolveOptionalUserId(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  request: Request,
) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return null;
  }

  try {
    const { data } = await adminClient.auth.getClaims(token);
    return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch {
    return null;
  }
}

type SendPayload = { purpose?: OtpPurpose; target?: string; context?: string };

export async function POST(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const payload = (await request.json().catch(() => ({}))) as SendPayload;
  const purpose = payload.purpose;
  const target = payload.target?.trim() ?? "";

  const validPurposes: OtpPurpose[] = ["phone", "email", "phone_change_current", "phone_change_new"];
  if (!purpose || !validPurposes.includes(purpose)) {
    return NextResponse.json({ error: "Invalid verification purpose." }, { status: 400 });
  }

  if (!target) {
    return NextResponse.json(
      { error: "A phone number or email is required." },
      { status: 400 },
    );
  }

  const userId = await resolveOptionalUserId(adminClient, request);

  if (payload.context === "register" && purpose === "phone") {
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone", target)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "An account already exists with this phone number. Try logging in instead." },
        { status: 409 },
      );
    }
  }

  // "phone_change_new" only ever means "prove control of the number I want
  // to switch to" — unlike plain "phone", this purpose is never shared with
  // login/registration, so it's safe to always check here (no separate
  // context flag needed). Same conflict check /api/profile/phone/change
  // does at the end, just surfaced before wasting an OTP send.
  if (purpose === "phone_change_new") {
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone", target)
      .maybeSingle();

    if (existingProfile && existingProfile.id !== userId) {
      return NextResponse.json(
        { error: "That phone number is already linked to another account." },
        { status: 409 },
      );
    }
  }

  const rateLimit = await checkAndRecordRateLimit(adminClient, `otp_send:${purpose}:${target}`, {
    maxAttempts: 5,
    windowMinutes: 15,
    lockoutMinutes: 15,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many verification codes requested. Please try again later." },
      { status: 429 },
    );
  }

  const result = await createOtpChallenge(adminClient, { purpose, target, userId });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
