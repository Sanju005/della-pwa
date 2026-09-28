import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import { isChallengeRecentlyVerified } from "@/lib/otp-verification";
import {
  authDebugLog,
  checkAndRecordRateLimit,
  findDevice,
  getVerifiedRecoveryEmail,
  hashPin,
  ipFromRequest,
  isDeviceCurrentlyTrusted,
  isValidPinFormat,
  markDeviceTrusted,
  recordSecurityEvent,
  resetRateLimit,
  touchDevice,
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

// Must match flutter_app/lib/core/utils/phone_number.dart's
// normalizePhoneNumber exactly — this is the lookup key for the account
// created at registration, which now normalizes the same way.
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

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

// Same complexity contract as the random password generated at registration
// time (lib usage in app/api/provider/register/route.ts's Flutter caller) —
// upper/lower/digit/symbol — since this value must satisfy Supabase's own
// password-strength rules when set via updateUserById.
function generateOneTimePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const pick = (source: string) =>
    source[Math.floor(Math.random() * source.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const combined = [...required, ...rest];

  for (let i = combined.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join("");
}

type LoginPhoneBody = {
  phoneCountryCode?: string;
  phoneNumber?: string;
  challengeId?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  fcmToken?: string;
  pin?: string;
  emailChallengeId?: string;
  newPin?: string;
};

async function issueSession(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
) {
  const password = generateOneTimePassword();
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
  authDebugLog("session_created", { success: !error });
  return { password, error };
}

// Phase 1 authentication security — same trust model as
// app/api/customer/login/phone/route.ts, applied to providers. Provider
// accounts hold identity documents, earnings, and booking data, so the
// "no PIN yet" gap matters at least as much here: phone OTP alone must
// never grant access to an existing provider account from an unknown
// device, even when that account predates the PIN system.
export async function POST(request: Request) {
  try {
    const adminClient = getAdminSupabaseClient();

    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 500 },
      );
    }

    const payload = (await request.json()) as LoginPhoneBody;
    const normalizedPhone = normalizePhone(
      payload.phoneCountryCode ?? "+60",
      payload.phoneNumber ?? "",
    );
    const deviceId = payload.deviceId?.trim() ?? "";
    const ipAddress = ipFromRequest(request);

    if (normalizedPhone.replace(/[^\d]/g, "").length < 8) {
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 },
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        { error: "A device identifier is required to sign in." },
        { status: 400 },
      );
    }

    const challengeId = payload.challengeId?.trim();
    const phoneVerified =
      Boolean(challengeId) &&
      (await isChallengeRecentlyVerified(adminClient, {
        challengeId: challengeId as string,
        purpose: "phone",
        target: normalizedPhone,
      }));

    if (!phoneVerified) {
      return NextResponse.json(
        { error: "Phone verification is required or has expired. Please request a new code." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, phone, email, pin_hash")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (profileError || !profile || !isProviderRole(profile.role)) {
      authDebugLog("account_lookup", { role: "provider", found: false });
      return NextResponse.json(
        { error: "No provider account was found for this phone number." },
        { status: 404 },
      );
    }

    const userId = profile.id as string;
    const existingDevice = await findDevice(adminClient, userId, deviceId);
    const deviceTrusted = isDeviceCurrentlyTrusted(existingDevice);
    const hasPin = Boolean(profile.pin_hash);

    authDebugLog("account_lookup", {
      role: "provider",
      found: true,
      deviceTrusted,
      hasPin,
    });

    // --- trusted device, has PIN: unchanged normal path ---
    if (deviceTrusted && hasPin) {
      await touchDevice(adminClient, {
        userId,
        deviceId,
        deviceName: payload.deviceName,
        platform: payload.platform,
        fcmToken: payload.fcmToken,
      });

      const { password, error: updateError } = await issueSession(adminClient, userId);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Unable to sign in right now." },
          { status: 500 },
        );
      }

      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "login_success",
        deviceId,
        ipAddress,
        metadata: { trustedDevice: true },
      });

      return NextResponse.json({ success: true, phone: normalizedPhone, password });
    }

    // --- Case A: trusted device, no PIN yet (legacy account) ---
    if (deviceTrusted && !hasPin) {
      await touchDevice(adminClient, {
        userId,
        deviceId,
        deviceName: payload.deviceName,
        platform: payload.platform,
        fcmToken: payload.fcmToken,
      });

      const { password, error: updateError } = await issueSession(adminClient, userId);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Unable to sign in right now." },
          { status: 500 },
        );
      }

      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "legacy_pin_setup_required",
        deviceId,
        ipAddress,
      });
      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "login_success",
        deviceId,
        ipAddress,
        metadata: { trustedDevice: true, pinSetupMandatory: true },
      });

      return NextResponse.json({
        success: true,
        phone: normalizedPhone,
        password,
        pinSetupRequired: true,
        pinSetupMandatory: true,
      });
    }

    // --- unknown device, has PIN: unchanged, rate-limited PIN gate ---
    if (!deviceTrusted && hasPin) {
      const suppliedPin = payload.pin?.trim() ?? "";

      if (!suppliedPin) {
        await recordSecurityEvent(adminClient, {
          userId,
          eventType: "new_device_detected",
          deviceId,
          ipAddress,
        });
        return NextResponse.json({ requiresPin: true, newDevice: true });
      }

      if (!isValidPinFormat(suppliedPin)) {
        return NextResponse.json({ error: "Enter your 6-digit Swiper PIN." }, { status: 400 });
      }

      const pinLockKey = `pin_verify:${userId}`;
      const pinRateLimit = await checkAndRecordRateLimit(adminClient, pinLockKey, {
        maxAttempts: 5,
        windowMinutes: 15,
        lockoutMinutes: 15,
      });

      if (!pinRateLimit.allowed) {
        await recordSecurityEvent(adminClient, {
          userId,
          eventType: "pin_locked",
          deviceId,
          ipAddress,
        });
        return NextResponse.json(
          {
            error: "Too many incorrect PIN attempts. Please try again later.",
            retryAfterSeconds: pinRateLimit.retryAfterSeconds,
          },
          { status: 429 },
        );
      }

      if (!verifyPin(suppliedPin, profile.pin_hash as string | null)) {
        await recordSecurityEvent(adminClient, {
          userId,
          eventType: "pin_failed",
          deviceId,
          ipAddress,
        });
        return NextResponse.json({ error: "Incorrect PIN.", pinFailed: true }, { status: 401 });
      }

      await resetRateLimit(adminClient, pinLockKey);
      await touchDevice(adminClient, {
        userId,
        deviceId,
        deviceName: payload.deviceName,
        platform: payload.platform,
        fcmToken: payload.fcmToken,
      });
      await markDeviceTrusted(adminClient, userId, deviceId);

      const { password, error: updateError } = await issueSession(adminClient, userId);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Unable to sign in right now." },
          { status: 500 },
        );
      }

      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "new_device_verified",
        deviceId,
        ipAddress,
      });
      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "login_success",
        deviceId,
        ipAddress,
        metadata: { trustedDevice: false, viaPinVerification: true },
      });

      return NextResponse.json({ success: true, phone: normalizedPhone, password });
    }

    // --- Case B: unknown device, no PIN yet ---
    const verifiedEmail = await getVerifiedRecoveryEmail(adminClient, {
      userId,
      role: profile.role,
      email: profile.email as string | null,
    });

    const emailChallengeId = payload.emailChallengeId?.trim() ?? "";
    const newPin = payload.newPin?.trim() ?? "";

    if (!emailChallengeId || !newPin) {
      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "account_recovery_required",
        deviceId,
        ipAddress,
        metadata: { hasVerifiedEmail: Boolean(verifiedEmail) },
      });

      if (!verifiedEmail) {
        await recordSecurityEvent(adminClient, {
          userId,
          eventType: "new_device_rejected",
          deviceId,
          ipAddress,
          metadata: { reason: "no_verified_recovery_email" },
        });
        return NextResponse.json({ accountRecoveryRequired: true }, { status: 409 });
      }

      return NextResponse.json(
        { accountRecoveryRequired: true, recoveryEmail: verifiedEmail },
        { status: 409 },
      );
    }

    if (!verifiedEmail) {
      return NextResponse.json({ accountRecoveryRequired: true }, { status: 409 });
    }

    if (!isValidPinFormat(newPin)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits." }, { status: 400 });
    }

    const recoveryLockKey = `account_recovery:${userId}`;
    const recoveryRateLimit = await checkAndRecordRateLimit(adminClient, recoveryLockKey, {
      maxAttempts: 5,
      windowMinutes: 30,
      lockoutMinutes: 30,
    });

    if (!recoveryRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const emailVerifiedNow = await isChallengeRecentlyVerified(adminClient, {
      challengeId: emailChallengeId,
      purpose: "email",
      target: verifiedEmail,
    });

    if (!emailVerifiedNow) {
      return NextResponse.json(
        { error: "Email verification is required or has expired. Please request a new code." },
        { status: 401 },
      );
    }

    await resetRateLimit(adminClient, recoveryLockKey);

    const { error: pinUpdateError } = await adminClient
      .from("profiles")
      .update({
        pin_hash: hashPin(newPin),
        pin_set_at: new Date().toISOString(),
        pin_failed_attempts: 0,
        pin_locked_until: null,
      })
      .eq("id", userId);

    if (pinUpdateError) {
      return NextResponse.json(
        { error: pinUpdateError.message || "Unable to complete account recovery." },
        { status: 500 },
      );
    }

    await touchDevice(adminClient, {
      userId,
      deviceId,
      deviceName: payload.deviceName,
      platform: payload.platform,
      fcmToken: payload.fcmToken,
    });
    await markDeviceTrusted(adminClient, userId, deviceId);

    const { password, error: updateError } = await issueSession(adminClient, userId);
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Unable to sign in right now." },
        { status: 500 },
      );
    }

    await recordSecurityEvent(adminClient, {
      userId,
      eventType: "new_device_verified",
      deviceId,
      ipAddress,
      metadata: { viaAccountRecovery: true },
    });
    await recordSecurityEvent(adminClient, {
      userId,
      eventType: "pin_created",
      deviceId,
      ipAddress,
      metadata: { viaAccountRecovery: true },
    });
    await recordSecurityEvent(adminClient, {
      userId,
      eventType: "login_success",
      deviceId,
      ipAddress,
      metadata: { trustedDevice: false, viaAccountRecovery: true },
    });

    return NextResponse.json({ success: true, phone: normalizedPhone, password });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to sign in right now.",
      },
      { status: 500 },
    );
  }
}
