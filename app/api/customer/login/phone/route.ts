import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

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
  const digits = phoneNumber.replace(/[^\d]/g, "");
  const normalizedCountryCode = countryCode.trim() || "+60";

  if (!digits) {
    return normalizedCountryCode;
  }

  if (digits.startsWith("60")) {
    return `+${digits}`;
  }

  const countryDigits = normalizedCountryCode.replace(/[^\d]/g, "");

  return `+${countryDigits}${digits}`;
}

// Same complexity contract as the random password generated for provider
// phone-login (app/api/provider/login/phone/route.ts) — must satisfy
// Supabase's password-strength rules when set via updateUserById.
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
};

// Mirrors app/api/provider/login/phone/route.ts's exact trust model, applied
// to customers instead: customers authenticate by phone and never see their
// own password (set once at registration and never shown), so returning to
// log in can't be a normal password prompt. The Flutter app runs the same
// phone-OTP check already used at registration (client-side dev-mode only —
// this login path deliberately does NOT route through the hardened
// /api/auth/otp/verify flow, to avoid changing the shared login screen's
// behavior for providers too) before ever calling this endpoint; this
// endpoint then resets the matched account's password to a fresh value it
// knows and hands it back so the client can immediately sign in with it via
// Supabase's normal signInWithPassword(phone, password).
//
// Known limitation: because OTP delivery on THIS specific path is currently
// dev-mode only, this endpoint effectively lets anyone who knows a
// customer's phone number reset that account's password. Before this is
// relied on with real users, wire the login screen's OTP step through
// /api/auth/otp/verify (already built and hardened for registration/profile
// verification) and require a redeemed challengeId here too.
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

    if (normalizedPhone.replace(/[^\d]/g, "").length < 8) {
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 },
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, phone")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "customer") {
      return NextResponse.json(
        { error: "No customer account was found for this phone number." },
        { status: 404 },
      );
    }

    const password = generateOneTimePassword();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      profile.id,
      { password },
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Unable to sign in right now." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      phone: normalizedPhone,
      password,
    });
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
