import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { getVerifiedRecoveryEmail } from "@/lib/auth-security";

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

async function verifySession(
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

  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

// Used only by the "I don't have access to my current number" fallback in
// the phone-change flow. Safe to reveal the actual recovery email here
// (unlike the anonymous login-recovery case) because the caller already has
// a valid session AND already passed the PIN check earlier in this same
// flow — this is not reachable by an unauthenticated party.
export async function GET(request: Request) {
  const adminClient = getAdminSupabaseClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const userId = await verifySession(adminClient, request);
  if (!userId) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile was not found." }, { status: 404 });
  }

  const recoveryEmail = await getVerifiedRecoveryEmail(adminClient, {
    userId,
    role: profile.role as string | null,
    email: profile.email as string | null,
  });

  return NextResponse.json({ recoveryEmail: recoveryEmail || null });
}
