import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { verifyOtpChallenge, type OtpPurpose } from "@/lib/otp-verification";

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

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

type VerifyPayload = { purpose?: OtpPurpose; target?: string; code?: string };

// Marks the caller's own profile verified server-side as a direct side
// effect of a correct code — the client never gets to assert
// emailVerified/phoneVerified itself (see the matching lockdown in
// app/api/profile/me/route.ts's PATCH handler, which now ignores those
// fields entirely). Only runs when a valid customer Bearer token is present;
// during registration (no session yet) the caller instead redeems the
// returned challengeId via isChallengeRecentlyVerified in the register route.
async function markOwnProfileVerified(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  request: Request,
  purpose: OtpPurpose,
) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return { attempted: false, warning: null as string | null };
  }

  try {
    const { data: claims } = await adminClient.auth.getClaims(token);
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

    if (!userId) {
      return { attempted: false, warning: null };
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || isProviderRole(profile.role)) {
      return { attempted: false, warning: null };
    }

    const { data: userData } = await adminClient.auth.admin.getUserById(userId);
    const currentMetadata =
      userData?.user?.user_metadata && typeof userData.user.user_metadata === "object"
        ? (userData.user.user_metadata as Record<string, unknown>)
        : {};

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMetadata,
        ...(purpose === "phone" ? { phone_verified: true } : { email_verified: true }),
      },
    });

    if (updateError) {
      return {
        attempted: true,
        warning: "Verified, but the profile could not be updated yet. Please refresh.",
      };
    }

    return { attempted: true, warning: null };
  } catch {
    return {
      attempted: true,
      warning: "Verified, but the profile could not be updated yet. Please refresh.",
    };
  }
}

export async function POST(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const payload = (await request.json().catch(() => ({}))) as VerifyPayload;
  const purpose = payload.purpose;
  const target = payload.target?.trim() ?? "";
  const code = payload.code?.trim() ?? "";

  if (purpose !== "phone" && purpose !== "email") {
    return NextResponse.json({ error: "Invalid verification purpose." }, { status: 400 });
  }

  if (!target || code.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const result = await verifyOtpChallenge(adminClient, { purpose, target, code });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const profileUpdate = await markOwnProfileVerified(adminClient, request, purpose);

  return NextResponse.json({
    verified: true,
    challengeId: result.challengeId,
    ...(profileUpdate.warning ? { warning: profileUpdate.warning } : {}),
  });
}
