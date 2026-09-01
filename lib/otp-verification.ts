import { createHash, randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-authoritative OTP challenges. A code is generated and hashed here
// and only ever checked here — no verification screen in Flutter is trusted
// to decide "correct" on its own (see app/api/profile/me/route.ts, which no
// longer accepts a client-supplied emailVerified/phoneVerified boolean at
// all; only this module's verify path can flip those flags).

const CHALLENGE_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

// Explicit, default-off opt-in for QA before Twilio/an email provider is
// wired up. Must be set to the exact string "true" in the deployment
// environment — unset (the default everywhere, including production unless
// someone deliberately adds it) means the dev bypass code below never
// works, so it cannot be used in production by accident.
const DEV_BYPASS_CODE = "123456";
function isDevOtpModeEnabled() {
  return process.env.OTP_DEV_MODE === "true";
}

export type OtpPurpose = "phone" | "email";

function hashCode(code: string, target: string, purpose: OtpPurpose) {
  return createHash("sha256").update(`${purpose}:${target}:${code}`).digest("hex");
}

function generateCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function isTwilioConfiguredForPhone() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_MESSAGING_SERVICE_SID,
  );
}

// Plain Twilio Programmable SMS (not Twilio Verify) — we keep our own code
// generation/hashing above so there is a single verification code path
// regardless of channel, and just use Twilio to deliver the code we already
// generated. Written defensively against Twilio's documented REST API but
// not yet exercised against real credentials (none are configured yet).
async function sendPhoneCodeViaTwilio(target: string, code: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID as string;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        MessagingServiceSid: messagingServiceSid,
        To: target,
        Body: `Your Della Swiper verification code is ${code}. It expires in ${CHALLENGE_TTL_MINUTES} minutes.`,
      }).toString(),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Twilio SMS send failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export type CreateChallengeResult =
  | { ok: true; challengeId: string }
  | { ok: false; error: string };

export async function createOtpChallenge(
  adminClient: SupabaseClient,
  params: { purpose: OtpPurpose; target: string; userId?: string | null },
): Promise<CreateChallengeResult> {
  const target = params.target.trim();
  if (!target) {
    return { ok: false, error: "A phone number or email is required." };
  }

  const code = generateCode();
  const codeHash = hashCode(code, target, params.purpose);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000).toISOString();

  const { data, error } = await adminClient
    .from("otp_challenges")
    .insert({
      purpose: params.purpose,
      target,
      code_hash: codeHash,
      user_id: params.userId ?? null,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Unable to start verification." };
  }

  if (params.purpose === "phone" && isTwilioConfiguredForPhone()) {
    try {
      await sendPhoneCodeViaTwilio(target, code);
    } catch (sendError) {
      return {
        ok: false,
        error:
          sendError instanceof Error
            ? sendError.message
            : "Unable to send verification code.",
      };
    }
  }
  // Email delivery: no email-sending provider is wired into this project yet
  // (out of Phase A scope — see the login-notification-email discussion).
  // The generated code above is real and hashed, but with no channel to
  // deliver it, email verification is only reachable via the explicit
  // OTP_DEV_MODE bypass below until a real email provider is added.

  return { ok: true, challengeId: data.id as string };
}

export type VerifyChallengeResult =
  | { ok: true; challengeId: string }
  | { ok: false; status: number; error: string };

export async function verifyOtpChallenge(
  adminClient: SupabaseClient,
  params: { purpose: OtpPurpose; target: string; code: string },
): Promise<VerifyChallengeResult> {
  const target = params.target.trim();
  const code = params.code.trim();

  if (!target || code.length !== 6) {
    return { ok: false, status: 400, error: "Enter the 6-digit code." };
  }

  const devBypass = isDevOtpModeEnabled() && code === DEV_BYPASS_CODE;

  const { data } = await adminClient
    .from("otp_challenges")
    .select("id, code_hash, attempts, consumed_at, expires_at")
    .eq("purpose", params.purpose)
    .eq("target", target)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    if (!devBypass) {
      return { ok: false, status: 400, error: "Request a new code and try again." };
    }

    // Dev-mode bypass with no prior /send call on record — still create a
    // consumed row so the registration ticket lookup has something to point
    // at; this path only ever runs when OTP_DEV_MODE=true is explicitly set.
    const { data: inserted, error: insertError } = await adminClient
      .from("otp_challenges")
      .insert({
        purpose: params.purpose,
        target,
        code_hash: hashCode(code, target, params.purpose),
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000).toISOString(),
        consumed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { ok: false, status: 500, error: "Unable to verify right now." };
    }

    return { ok: true, challengeId: inserted.id as string };
  }

  if (!devBypass && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 400, error: "This code has expired. Request a new one." };
  }

  if (!devBypass && data.attempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: "Too many attempts. Request a new code." };
  }

  if (!devBypass) {
    const expectedHash = hashCode(code, target, params.purpose);
    if (expectedHash !== data.code_hash) {
      await adminClient
        .from("otp_challenges")
        .update({ attempts: data.attempts + 1 })
        .eq("id", data.id);
      return { ok: false, status: 400, error: "Incorrect code. Please try again." };
    }
  }

  await adminClient
    .from("otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id);

  return { ok: true, challengeId: data.id as string };
}

// Used by registration (no auth token exists yet at that point) to redeem a
// verify-time challengeId as proof phone verification actually happened,
// without trusting a client-sent boolean.
export async function isChallengeRecentlyVerified(
  adminClient: SupabaseClient,
  params: { challengeId: string; purpose: OtpPurpose; target: string },
) {
  if (!params.challengeId) {
    return false;
  }

  const { data } = await adminClient
    .from("otp_challenges")
    .select("id, consumed_at")
    .eq("id", params.challengeId)
    .eq("purpose", params.purpose)
    .eq("target", params.target.trim())
    .maybeSingle();

  if (!data || !data.consumed_at) {
    return false;
  }

  const consumedAt = new Date(data.consumed_at as string).getTime();
  return Date.now() - consumedAt < 30 * 60_000; // 30-minute ticket validity
}
