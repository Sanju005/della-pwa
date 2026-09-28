import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { isChallengeRecentlyVerified } from "@/lib/otp-verification";
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

function normalizePhone(countryCode: string, phoneNumber: string) {
  const countryDigits =
    (countryCode.trim() || "+60").replace(/[^\d]/g, "") || "60";
  let subscriber = phoneNumber.replace(/[^\d]/g, "");

  if (!subscriber) {
    return `+${countryDigits}`;
  }

  if (subscriber.startsWith(countryDigits)) {
    subscriber = subscriber.slice(countryDigits.length);
  } else if (countryDigits === "60" && subscriber.startsWith("0")) {
    subscriber = subscriber.slice(1);
  }

  return `+${countryDigits}${subscriber}`;
}

type LookupBody = {
  phoneCountryCode?: string;
  phoneNumber?: string;
  phoneChallengeId?: string;
};

// Step 2 of "forgot PIN": once the phone OTP is verified, reveals the
// account's own verified recovery email so the app can send a second OTP
// there. Re-verifies the phone challenge itself server-side (never trusts
// a client-supplied "phone is verified" boolean).
//
// Enumeration safety: "no account for this phone" and "account exists but
// has no verified recovery email" return the IDENTICAL response
// (accountRecoveryRequired, no further detail) — an attacker who somehow
// has SMS access to a number (the only way to reach this route at all,
// since it requires a real completed phone OTP) learns nothing about
// whether an account exists beyond what receiving that SMS already implied
// (if no account exists, no OTP challenge for that number would resolve
// as "recently verified" in a way that matters — this route still refuses
// identically either way).
export async function POST(request: Request) {
  const adminClient = getAdminSupabaseClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const payload = (await request.json().catch(() => ({}))) as LookupBody;
  const normalizedPhone = normalizePhone(
    payload.phoneCountryCode ?? "+60",
    payload.phoneNumber ?? "",
  );
  const phoneChallengeId = payload.phoneChallengeId?.trim() ?? "";

  const phoneOk =
    Boolean(phoneChallengeId) &&
    (await isChallengeRecentlyVerified(adminClient, {
      challengeId: phoneChallengeId,
      purpose: "phone",
      target: normalizedPhone,
    }));

  if (!phoneOk) {
    return NextResponse.json(
      { error: "Phone verification is required or has expired. Please request a new code." },
      { status: 401 },
    );
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, email")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  const verifiedEmail = profile
    ? await getVerifiedRecoveryEmail(adminClient, {
        userId: profile.id as string,
        role: profile.role as string | null,
        email: profile.email as string | null,
      })
    : "";

  if (!verifiedEmail) {
    return NextResponse.json({ accountRecoveryRequired: true }, { status: 409 });
  }

  return NextResponse.json({ email: verifiedEmail });
}
