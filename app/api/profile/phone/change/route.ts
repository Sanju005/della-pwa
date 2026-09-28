import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { isChallengeRecentlyVerified } from "@/lib/otp-verification";
import {
  checkAndRecordRateLimit,
  getVerifiedRecoveryEmail,
  ipFromRequest,
  recordSecurityEvent,
  verifyPin,
} from "@/lib/auth-security";

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

type ChangePhoneBody = {
  pin?: string;
  currentPhoneChallengeId?: string;
  currentEmailChallengeId?: string;
  newPhoneCountryCode?: string;
  newPhoneNumber?: string;
  newPhoneChallengeId?: string;
};

// Deliberately NOT "verify the new number, replace the old one" — that
// would let anyone who receives one SMS on a new SIM take over a phone-
// number-keyed account. This requires all of: an authenticated session,
// the account's own Swiper PIN, proof of the CURRENT identity (a fresh OTP
// to the current phone, OR — for someone who's lost that phone — a fresh
// OTP to the account's own verified recovery email, never a client-
// supplied one), and a fresh OTP to the NEW phone (proves they now control
// it) — the database is only touched after every check passes. An account
// with no verified recovery email and no access to its current phone has
// no self-service path at all; that's handled by human support, not this
// route.
export async function POST(request: Request) {
  const adminClient = getAdminSupabaseClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const userId = await verifySession(adminClient, request);
  if (!userId) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as ChangePhoneBody;
  const pin = payload.pin?.trim() ?? "";
  const ipAddress = ipFromRequest(request);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, phone, pin_hash, role, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile was not found." }, { status: 404 });
  }

  if (!profile.pin_hash) {
    return NextResponse.json(
      { error: "Set up your Swiper PIN before changing your phone number." },
      { status: 400 },
    );
  }

  await recordSecurityEvent(adminClient, {
    userId,
    eventType: "phone_change_started",
    ipAddress,
  });

  const rateLimitKey = `phone_change:${userId}`;
  const rateLimit = await checkAndRecordRateLimit(adminClient, rateLimitKey, {
    maxAttempts: 5,
    windowMinutes: 30,
    lockoutMinutes: 30,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  if (!verifyPin(pin, profile.pin_hash as string)) {
    await recordSecurityEvent(adminClient, {
      userId,
      eventType: "pin_failed",
      ipAddress,
      metadata: { context: "phone_change" },
    });
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const currentPhone = (profile.phone as string | null)?.trim() ?? "";
  const currentPhoneChallengeId = payload.currentPhoneChallengeId?.trim() ?? "";
  const currentEmailChallengeId = payload.currentEmailChallengeId?.trim() ?? "";

  const currentPhoneOk =
    Boolean(currentPhone) &&
    Boolean(currentPhoneChallengeId) &&
    (await isChallengeRecentlyVerified(adminClient, {
      challengeId: currentPhoneChallengeId,
      purpose: "phone_change_current",
      target: currentPhone,
    }));

  let currentIdentityOk = currentPhoneOk;

  if (!currentIdentityOk && currentEmailChallengeId) {
    const verifiedEmail = await getVerifiedRecoveryEmail(adminClient, {
      userId,
      role: profile.role as string | null,
      email: profile.email as string | null,
    });

    currentIdentityOk =
      Boolean(verifiedEmail) &&
      (await isChallengeRecentlyVerified(adminClient, {
        challengeId: currentEmailChallengeId,
        purpose: "email",
        target: verifiedEmail,
      }));
  }

  if (!currentIdentityOk) {
    return NextResponse.json(
      { error: "Verify your current phone number or recovery email first." },
      { status: 401 },
    );
  }

  const newPhone = normalizePhone(
    payload.newPhoneCountryCode ?? "+60",
    payload.newPhoneNumber ?? "",
  );

  if (newPhone.replace(/[^\d]/g, "").length < 8) {
    return NextResponse.json({ error: "Enter a valid new phone number." }, { status: 400 });
  }

  if (newPhone === currentPhone) {
    return NextResponse.json(
      { error: "This is already your current phone number." },
      { status: 400 },
    );
  }

  const newPhoneChallengeId = payload.newPhoneChallengeId?.trim() ?? "";
  const newPhoneOk =
    Boolean(newPhoneChallengeId) &&
    (await isChallengeRecentlyVerified(adminClient, {
      challengeId: newPhoneChallengeId,
      purpose: "phone_change_new",
      target: newPhone,
    }));

  if (!newPhoneOk) {
    return NextResponse.json(
      { error: "Verify your new phone number first." },
      { status: 401 },
    );
  }

  const { data: conflictingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("phone", newPhone)
    .neq("id", userId)
    .maybeSingle();

  if (conflictingProfile) {
    return NextResponse.json(
      { error: "That phone number is already linked to another account." },
      { status: 409 },
    );
  }

  // Update Supabase Auth's own phone field first — if this fails, profiles
  // is never touched, so the two never disagree with each other.
  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
    phone: newPhone,
    phone_confirm: true,
  });

  if (authUpdateError) {
    return NextResponse.json(
      { error: authUpdateError.message || "Unable to update phone number." },
      { status: 500 },
    );
  }

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({ phone: newPhone })
    .eq("id", userId);

  if (profileUpdateError) {
    return NextResponse.json(
      { error: profileUpdateError.message || "Unable to update phone number." },
      { status: 500 },
    );
  }

  await recordSecurityEvent(adminClient, {
    userId,
    eventType: "phone_changed",
    ipAddress,
  });

  return NextResponse.json({ success: true, phone: newPhone });
}
