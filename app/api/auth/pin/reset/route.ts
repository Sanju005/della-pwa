import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { isChallengeRecentlyVerified } from "@/lib/otp-verification";
import { sendPushNotificationToUser } from "@/lib/push-notifications";
import {
  checkAndRecordRateLimit,
  getVerifiedRecoveryEmail,
  hashPin,
  ipFromRequest,
  isValidPinFormat,
  recordSecurityEvent,
  resetRateLimit,
  revokeAllTrustedDevices,
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

type ResetPinBody = {
  phoneCountryCode?: string;
  phoneNumber?: string;
  phoneChallengeId?: string;
  emailChallengeId?: string;
  newPin?: string;
};

// "Forgot PIN" recovery. Requires BOTH a fresh phone OTP AND a fresh OTP
// sent to the account's own already-verified email — phone OTP alone must
// never be enough to reset the one thing that protects the account from a
// recycled-number takeover. If the account has no verified recovery email,
// this refuses outright (no insecure fallback) rather than resetting.
//
// Enumeration safety: "no account for this phone" and "account exists but
// has no verified recovery email" both return the same
// accountRecoveryRequired response with no further detail.
export async function POST(request: Request) {
  const adminClient = getAdminSupabaseClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const payload = (await request.json().catch(() => ({}))) as ResetPinBody;
  const normalizedPhone = normalizePhone(
    payload.phoneCountryCode ?? "+60",
    payload.phoneNumber ?? "",
  );
  const newPin = payload.newPin?.trim() ?? "";
  const ipAddress = ipFromRequest(request);

  if (!isValidPinFormat(newPin)) {
    return NextResponse.json({ error: "PIN must be exactly 6 digits." }, { status: 400 });
  }

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

  const userId = profile?.id as string | undefined;
  const verifiedEmail = profile
    ? await getVerifiedRecoveryEmail(adminClient, {
        userId: profile.id as string,
        role: profile.role as string | null,
        email: profile.email as string | null,
      })
    : "";

  if (!userId || !verifiedEmail) {
    if (userId) {
      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "account_recovery_started",
        ipAddress,
        metadata: { reason: "no_verified_recovery_email" },
      });
    }
    return NextResponse.json({ accountRecoveryRequired: true }, { status: 409 });
  }

  await recordSecurityEvent(adminClient, {
    userId,
    eventType: "pin_reset_started",
    ipAddress,
  });

  const rateLimitKey = `pin_reset:${userId}`;
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

  const emailChallengeId = payload.emailChallengeId?.trim() ?? "";
  const emailOk =
    Boolean(emailChallengeId) &&
    (await isChallengeRecentlyVerified(adminClient, {
      challengeId: emailChallengeId,
      purpose: "email",
      // Verified against the account's OWN stored, already-verified email —
      // never a client-supplied address — so an attacker can't reset the
      // PIN just by proving they own some unrelated email inbox.
      target: verifiedEmail,
    }));

  if (!emailOk) {
    return NextResponse.json(
      { error: "Email verification is required or has expired. Please request a new code." },
      { status: 401 },
    );
  }

  await resetRateLimit(adminClient, rateLimitKey);

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({
      pin_hash: hashPin(newPin),
      pin_set_at: new Date().toISOString(),
      pin_failed_attempts: 0,
      pin_locked_until: null,
    })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Unable to reset your PIN." },
      { status: 500 },
    );
  }

  // A PIN reset means the old PIN may have been compromised (or was simply
  // forgotten) — either way, every device trusted under it has to
  // re-establish trust under the new one. There is no session here to know
  // which device is "the real user's own," so this revokes all of them,
  // the conservative choice.
  await revokeAllTrustedDevices(adminClient, userId);

  await recordSecurityEvent(adminClient, {
    userId,
    eventType: "pin_reset_completed",
    ipAddress,
  });

  const title = "Swiper PIN reset";
  const body =
    "Your Swiper Security PIN was just reset and all devices were signed out for security. If this wasn't you, contact support immediately.";

  await adminClient.from("notifications").insert({
    user_id: userId,
    booking_id: null,
    notification_type: "pin_reset_completed",
    title,
    body,
  });

  try {
    await sendPushNotificationToUser(userId, {
      title,
      body,
      type: "booking",
      event: "pin_reset_completed",
    });
  } catch (pushError) {
    console.error("[PIN reset] Failed to send security-alert push notification:", pushError);
  }

  return NextResponse.json({ success: true });
}
