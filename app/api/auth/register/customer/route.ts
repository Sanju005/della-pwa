import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import { uploadStoredMedia } from "@/lib/server-media-storage";
import { isChallengeRecentlyVerified } from "@/lib/otp-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Customer registration is phone-first, mirroring the already-working
// Provider registration (app/api/provider/register/route.ts): Supabase Auth
// accounts here are created with `phone` + a password, no email at all.
// Unlike Provider, the customer never types/sees this password — it's
// generated here and handed back once in the response so the Flutter client
// can immediately call signInWithPhone, exactly like the returning-customer
// login flow in app/api/customer/login/phone/route.ts. Email and address are
// intentionally not collected here — email is added later via Verification,
// address later via Profile.
type CustomerSignupPayload = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  avatarDataUrl?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  // Proof the phone was actually verified through /api/auth/otp/verify — a
  // missing or stale id just leaves phone_verified false, it never fails
  // registration outright (see isChallengeRecentlyVerified).
  phoneVerificationChallengeId?: string;
};

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";

  if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    return origin;
  }

  if (origin === "https://app.myswiper.my") {
    return origin;
  }

  return "https://app.myswiper.my";
}

function withCors(request: Request, response: NextResponse) {
  const origin = getCorsOrigin(request);

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");

  return response;
}

function toSignupErrorMessage(errorMessage?: string) {
  const normalizedMessage = errorMessage?.trim().toLowerCase() ?? "";

  if (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists")
  ) {
    return "An account already exists with this phone number.";
  }

  return errorMessage || "Unable to create your account.";
}

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

// Same complexity contract used by the provider/customer phone-login
// password reset — must satisfy Supabase's password-strength rules.
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

export async function OPTIONS(request: Request) {
  return withCors(request, new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CustomerSignupPayload;

  const firstName = payload.firstName?.trim() ?? "";
  const lastName = payload.lastName?.trim() ?? "";
  const dateOfBirth = payload.dateOfBirth?.trim() ?? "";
  const sex = payload.sex === "Male" || payload.sex === "Female" ? payload.sex : "";
  const avatarDataUrl = payload.avatarDataUrl?.trim() ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!firstName || !lastName || !dateOfBirth || !sex) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Please fill in all required fields." },
        { status: 400 }
      )
    );
  }

  const normalizedPhone = normalizePhone(
    payload.phoneCountryCode ?? "+60",
    payload.phoneNumber ?? "",
  );

  if (normalizedPhone.replace(/[^\d]/g, "").length < 8) {
    return withCors(
      request,
      NextResponse.json(
        { error: "A valid phone number is required." },
        { status: 400 }
      )
    );
  }

  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 500 }
      )
    );
  }

  // Prevent duplicate customer accounts on the same phone number before
  // ever touching Supabase Auth.
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existingProfile) {
    return withCors(
      request,
      NextResponse.json(
        { error: "An account already exists with this phone number." },
        { status: 409 }
      )
    );
  }

  const phoneVerified = payload.phoneVerificationChallengeId
    ? await isChallengeRecentlyVerified(adminClient, {
        challengeId: payload.phoneVerificationChallengeId,
        purpose: "phone",
        target: normalizedPhone,
      })
    : false;

  const generatedPassword = generateOneTimePassword();

  const { data, error } = await adminClient.auth.admin.createUser({
    phone: normalizedPhone,
    password: generatedPassword,
    phone_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      sex,
      role: "customer",
      email_verified: false,
      phone_verified: phoneVerified,
      identity_verification_status: "pending",
    },
  });

  if (error) {
    return withCors(
      request,
      NextResponse.json(
        { error: toSignupErrorMessage(error.message) },
        { status: 400 }
      )
    );
  }

  if (!data.user) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Unable to create your account." },
        { status: 500 }
      )
    );
  }

  if (!data.user.phone_confirmed_at) {
    const { error: confirmError } = await adminClient.auth.admin.updateUserById(
      data.user.id,
      {
        phone_confirm: true,
      }
    );

    if (confirmError) {
      return withCors(
        request,
        NextResponse.json(
          { error: "Account created, but phone confirmation setup failed." },
          { status: 500 }
        )
      );
    }
  }

  const storedAvatarUrl = avatarDataUrl
    ? await uploadStoredMedia(adminClient, {
        bucket: "profile-images",
        dataUrl: avatarDataUrl,
        ownerId: data.user.id,
        pathParts: ["avatar"],
        fileName: "avatar.jpg",
        upsert: true,
        visibility: "public",
      })
    : "";

  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        full_name: fullName,
        email: null,
        role: "customer",
        phone: normalizedPhone,
        avatar_url: storedAvatarUrl || null,
        status: "active",
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Account created, but profile setup failed." },
        { status: 500 }
      )
    );
  }

  const { error: customerProfileError } = await adminClient
    .from("customer_profiles")
    .upsert(
      {
        id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        sex,
        verified: false,
      },
      { onConflict: "id" }
    );

  if (customerProfileError) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Account created, but customer profile setup failed." },
        { status: 500 }
      )
    );
  }

  return withCors(
    request,
    NextResponse.json({
      success: true,
      phone: normalizedPhone,
      password: generatedPassword,
    })
  );
}
