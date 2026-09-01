import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { createOtpChallenge, type OtpPurpose } from "@/lib/otp-verification";

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

type SendPayload = { purpose?: OtpPurpose; target?: string };

export async function POST(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const payload = (await request.json().catch(() => ({}))) as SendPayload;
  const purpose = payload.purpose;
  const target = payload.target?.trim() ?? "";

  if (purpose !== "phone" && purpose !== "email") {
    return NextResponse.json({ error: "Invalid verification purpose." }, { status: 400 });
  }

  if (!target) {
    return NextResponse.json(
      { error: "A phone number or email is required." },
      { status: 400 },
    );
  }

  const userId = await resolveOptionalUserId(adminClient, request);
  const result = await createOtpChallenge(adminClient, { purpose, target, userId });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
