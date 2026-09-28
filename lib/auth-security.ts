import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Debug visibility for real-device testing
// ============================================================
// Deliberately a SEPARATE flag from OTP_DEV_MODE — you should never have
// to re-enable the insecure OTP bypass just to get diagnostic visibility.
// Must be the exact string "true"; unset (the default everywhere,
// including production unless explicitly added) means this is a no-op.
// Only ever logs event names/booleans/ids — see the allow-list of fields
// in authDebugLog's call sites; never a PIN, PIN hash, OTP code, password,
// or token.
function isAuthDebugLoggingEnabled() {
  return process.env.AUTH_DEBUG_LOGS === "true";
}

export function authDebugLog(label: string, details: Record<string, unknown>) {
  if (!isAuthDebugLoggingEnabled()) {
    return;
  }
  console.log(`[AuthDebug] ${label}`, details);
}

// ============================================================
// Swiper Security PIN — hashing
// ============================================================
// Algorithm: scrypt (Node's built-in `crypto`, not a hand-rolled scheme) —
// a memory-hard KDF in the same class as Argon2id, not a fast general-
// purpose hash like SHA-256/MD5. Argon2id was considered instead (it's the
// more modern default recommendation), but every real Argon2 package for
// Node is a native addon requiring compilation, and this backend deploys
// to Cloudflare Workers via OpenNext — native N-API addons cannot load in
// that V8-isolate runtime even with the Node.js compat flag set, whereas
// `crypto.scryptSync` is one of the built-ins Workers' Node compat layer
// already supports (this file's sibling `otp-verification.ts` already
// relies on the same `crypto` module in the same deployed environment).
// Choosing scrypt here is "use a standard, vetted KDF that is actually
// known to run where this code runs" rather than inventing anything.
//
// Cost factor: N=2^17 (131072), 8x Node's own default (2^14) — chosen to
// meaningfully raise the offline cracking cost given a 6-digit PIN only
// has 1,000,000 possibilities (hashing alone is not the primary defense;
// see the rate-limiting section below, which is). r=8, p=1 (Node
// defaults), keylen=64. maxmem raised to fit N=2^17's ~128 MiB working set
// (128*N*r bytes).
//
// Salt: random 16 bytes per PIN, stored alongside the hash (`salt:hash`
// hex) — salts are not secret, they only prevent precomputed rainbow-table
// attacks across many accounts' PINs at once.
//
// Verification: `timingSafeEqual` on the derived bytes, not `===` on
// strings/buffers, so a byte-by-byte early exit can't leak timing
// information about how much of a guess was correct.
//
// The PIN itself is never reversible from pin_hash — only verifiable
// against a freshly supplied attempt.

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST_N = 131072; // 2^17
const SCRYPT_BLOCK_SIZE_R = 8;
const SCRYPT_PARALLELIZATION_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024; // headroom over the ~128 MiB N=2^17 needs

const SCRYPT_OPTIONS = {
  N: SCRYPT_COST_N,
  r: SCRYPT_BLOCK_SIZE_R,
  p: SCRYPT_PARALLELIZATION_P,
  maxmem: SCRYPT_MAXMEM,
};

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPin(pin: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.includes(":")) {
    return false;
  }

  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(pin, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

// ============================================================
// Generic server-side rate limiting
// ============================================================
// Fixed-window counter with a lockout period once the window's cap is
// exceeded. Never enforced client-side — every caller here runs on the
// backend with the service-role client.

type RateLimitOptions = {
  maxAttempts: number;
  windowMinutes: number;
  lockoutMinutes: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function checkAndRecordRateLimit(
  adminClient: SupabaseClient,
  bucketKey: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();

  const { data: existing } = await adminClient
    .from("auth_rate_limits")
    .select("id, window_start, attempt_count, locked_until")
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  if (existing?.locked_until && new Date(existing.locked_until).getTime() > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((new Date(existing.locked_until).getTime() - now) / 1000),
    };
  }

  const windowExpired =
    !existing || now - new Date(existing.window_start).getTime() > options.windowMinutes * 60_000;

  if (!existing || windowExpired) {
    await adminClient.from("auth_rate_limits").upsert(
      {
        bucket_key: bucketKey,
        window_start: new Date().toISOString(),
        attempt_count: 1,
        locked_until: null,
      },
      { onConflict: "bucket_key" },
    );
    return { allowed: true };
  }

  const nextCount = existing.attempt_count + 1;

  if (nextCount > options.maxAttempts) {
    const lockedUntil = new Date(now + options.lockoutMinutes * 60_000).toISOString();
    await adminClient
      .from("auth_rate_limits")
      .update({ attempt_count: nextCount, locked_until: lockedUntil })
      .eq("id", existing.id);
    return { allowed: false, retryAfterSeconds: options.lockoutMinutes * 60 };
  }

  await adminClient
    .from("auth_rate_limits")
    .update({ attempt_count: nextCount })
    .eq("id", existing.id);
  return { allowed: true };
}

// Clears a bucket after a successful attempt (e.g. correct PIN entered),
// so a later legitimate attempt doesn't inherit a near-exhausted counter.
export async function resetRateLimit(adminClient: SupabaseClient, bucketKey: string) {
  await adminClient.from("auth_rate_limits").delete().eq("bucket_key", bucketKey);
}

// ============================================================
// Security event log
// ============================================================
// Never pass OTP values, PIN values, access/refresh tokens, or passwords in
// `metadata` — every call site in this codebase must only pass identifiers
// (device id, phone/email presence booleans, status strings), never secrets.

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "otp_failed"
  | "legacy_pin_setup_required"
  | "pin_created"
  | "new_device_detected"
  | "new_device_verified"
  | "new_device_rejected"
  | "pin_failed"
  | "pin_locked"
  | "pin_changed"
  | "pin_reset_started"
  | "pin_reset_completed"
  | "account_recovery_required"
  | "phone_change_started"
  | "phone_changed"
  | "email_changed"
  | "device_revoked"
  | "account_recovery_started";

export async function recordSecurityEvent(
  adminClient: SupabaseClient,
  params: {
    userId: string | null;
    eventType: SecurityEventType;
    deviceId?: string | null;
    ipAddress?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  authDebugLog("security_event", {
    eventType: params.eventType,
    hasUserId: Boolean(params.userId),
    deviceId: params.deviceId ?? null,
  });

  try {
    await adminClient.from("security_events").insert({
      user_id: params.userId,
      event_type: params.eventType,
      device_id: params.deviceId ?? null,
      ip_address: params.ipAddress ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    // Security logging must never break the auth flow it's observing.
    console.error("[Security event] Failed to record event:", params.eventType, error);
  }
}

export function ipFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("cf-connecting-ip") || null;
}

// ============================================================
// Verified recovery email lookup
// ============================================================
// IMPORTANT: `profiles` has no `email_verified` column (checked — no
// migration defines one, and the two real client flows for reading this
// status confirm it lives elsewhere): app/api/profile/me/route.ts reads a
// customer's verified state from Supabase Auth's own
// `user.user_metadata.email_verified` (set only as a side effect of a real
// redeemed OTP challenge or Supabase's own email_confirmed_at, in
// app/api/auth/otp/verify/route.ts — never a client-supplied boolean), and
// app/api/provider/me/route.ts's syncEmailVerification persists a
// provider's verified state into `provider_verifications.email_verified`
// (joined on provider_id). This helper reads whichever of those two is
// authoritative for the account's role, rather than trusting a
// `profiles.email_verified` column that does not reliably exist — the
// exact "don't assume email exists implies verified, and don't invent a
// second source of truth" requirement this was built to satisfy.
export async function getVerifiedRecoveryEmail(
  adminClient: SupabaseClient,
  params: { userId: string; role: string | null | undefined; email: string | null | undefined },
): Promise<string> {
  const email = params.email?.trim() ?? "";
  if (!email) {
    return "";
  }

  const role = params.role ?? "";
  const isProvider = role === "provider" || role === "service_provider";

  if (isProvider) {
    const { data } = await adminClient
      .from("provider_verifications")
      .select("email_verified")
      .eq("provider_id", params.userId)
      .maybeSingle();

    return data?.email_verified ? email : "";
  }

  try {
    const { data, error } = await adminClient.auth.admin.getUserById(params.userId);
    if (error || !data.user) {
      return "";
    }
    const metadata = data.user.user_metadata as Record<string, unknown> | null;
    const verifiedByMetadata = Boolean(metadata?.email_verified);
    const verifiedBySupabase = Boolean(data.user.email_confirmed_at);
    return verifiedByMetadata || verifiedBySupabase ? email : "";
  } catch {
    return "";
  }
}

// ============================================================
// Trusted device lookups/mutations
// ============================================================

export type DeviceRow = {
  id: string;
  user_id: string;
  device_id: string;
  is_trusted: boolean;
  revoked_at: string | null;
};

export async function findDevice(
  adminClient: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<DeviceRow | null> {
  if (!deviceId) {
    return null;
  }

  const { data } = await adminClient
    .from("user_devices")
    .select("id, user_id, device_id, is_trusted, revoked_at")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  return (data as DeviceRow | null) ?? null;
}

export function isDeviceCurrentlyTrusted(device: DeviceRow | null): boolean {
  return Boolean(device && device.is_trusted && !device.revoked_at);
}

export async function touchDevice(
  adminClient: SupabaseClient,
  params: {
    userId: string;
    deviceId: string;
    deviceName?: string | null;
    platform?: string | null;
    fcmToken?: string | null;
  },
) {
  await adminClient.from("user_devices").upsert(
    {
      user_id: params.userId,
      device_id: params.deviceId,
      device_name: params.deviceName ?? null,
      platform: params.platform ?? null,
      fcm_token: params.fcmToken ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id", ignoreDuplicates: false },
  );
}

export async function markDeviceTrusted(
  adminClient: SupabaseClient,
  userId: string,
  deviceId: string,
) {
  await adminClient
    .from("user_devices")
    .update({ is_trusted: true, trusted_at: new Date().toISOString(), revoked_at: null })
    .eq("user_id", userId)
    .eq("device_id", deviceId);
}

// A PIN reset means the account's PIN was possibly compromised or its
// legitimate owner lost access to it — either way, every device trusted
// under the OLD PIN should have to re-establish trust under the new one.
// There is no reliable "current device" to exempt here: PIN reset runs
// without an authenticated session (that's the whole point — the caller
// couldn't sign in), so revoking everything is the conservative, correct
// choice rather than guessing which device is "the real user's."
export async function revokeAllTrustedDevices(adminClient: SupabaseClient, userId: string) {
  await adminClient
    .from("user_devices")
    .update({ is_trusted: false, revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_trusted", true);
}
