import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import {
  checkAndRecordRateLimit,
  hashPin,
  ipFromRequest,
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

type CreatePinBody = {
  pin?: string;
  currentPin?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  fcmToken?: string;
};

// Creates the Swiper Security PIN for the first time, or changes an
// existing one. This is the ONLY place pin_hash is ever written from a
// direct user action (see the PIN reset route for the email-recovery
// path). Requires an authenticated session — a PIN can never be set for an
// account the caller isn't already signed into.
//
// When deviceId is supplied (registration and the Phase-1 login bootstrap
// both pass it), the current device is marked trusted ONLY after the PIN
// is successfully saved — never before. This is what "current device
// marked trusted only after PIN setup succeeds" means concretely: trust
// and PIN creation happen in the same request, in that order, and if the
// PIN write fails the device is never touched.
export async function POST(request: Request) {
  const adminClient = getAdminSupabaseClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
  }

  const userId = await verifySession(adminClient, request);
  if (!userId) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as CreatePinBody;
  const newPin = payload.pin?.trim() ?? "";
  const currentPin = payload.currentPin?.trim() ?? "";
  const ipAddress = ipFromRequest(request);

  if (!isValidPinFormat(newPin)) {
    return NextResponse.json({ error: "PIN must be exactly 6 digits." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, pin_hash")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile was not found." }, { status: 404 });
  }

  // Changing an existing PIN requires proving the current one first — this
  // is not the "forgot PIN" path (see /api/auth/pin/reset), just a
  // deliberate change while already fully signed in.
  if (profile.pin_hash) {
    const rateLimitKey = `pin_change:${userId}`;
    const rateLimit = await checkAndRecordRateLimit(adminClient, rateLimitKey, {
      maxAttempts: 5,
      windowMinutes: 15,
      lockoutMinutes: 15,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    if (!currentPin || !verifyPin(currentPin, profile.pin_hash as string)) {
      await recordSecurityEvent(adminClient, {
        userId,
        eventType: "pin_failed",
        ipAddress,
        metadata: { context: "pin_change" },
      });
      return NextResponse.json({ error: "Your current PIN is incorrect." }, { status: 401 });
    }

    await resetRateLimit(adminClient, rateLimitKey);
  }

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
      { error: updateError.message || "Unable to save your PIN." },
      { status: 500 },
    );
  }

  const isFirstSetup = !profile.pin_hash;

  await recordSecurityEvent(adminClient, {
    userId,
    eventType: isFirstSetup ? "pin_created" : "pin_changed",
    ipAddress,
  });

  const deviceId = payload.deviceId?.trim() ?? "";
  if (deviceId) {
    await touchDevice(adminClient, {
      userId,
      deviceId,
      deviceName: payload.deviceName,
      platform: payload.platform,
      fcmToken: payload.fcmToken,
    });
    await markDeviceTrusted(adminClient, userId, deviceId);
  }

  return NextResponse.json({ success: true });
}
