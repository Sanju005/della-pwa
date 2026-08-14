import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import { uploadStoredMedia } from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerSignupPayload = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  avatarDataUrl?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
  emergencyContactNumber?: string;
  addressLabel?: string;
  unitNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postcode?: string;
  city?: string;
  state?: string;
  country?: string;
};

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";

  if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
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
  response.headers.set("X-Debug-Cors", "customer-route-v1");

  return response;
}

function toSignupErrorMessage(errorMessage?: string) {
  const normalizedMessage = errorMessage?.trim().toLowerCase() ?? "";

  if (normalizedMessage.includes("email rate limit exceeded")) {
    return "Too many verification emails were requested. Please wait a few minutes and try again.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "An account with this email already exists. Try logging in instead.";
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

function normalizePhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/[^\d]/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("60")) {
    return `+${digits}`;
  }

  return `+60${digits}`;
}

function buildAddressLine1(unitNumber: string, addressLine1: string) {
  return [unitNumber.trim(), addressLine1.trim()].filter(Boolean).join(", ");
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
  const email = payload.email?.trim().toLowerCase() ?? "";
  const phoneNumber = payload.phoneNumber?.trim() ?? "";
  const password = payload.password ?? "";
  const confirmPassword = payload.confirmPassword ?? "";
  const emergencyContactNumber = payload.emergencyContactNumber?.trim() ?? "";
  const addressLabel = payload.addressLabel?.trim() || "Address 1";
  const unitNumber = payload.unitNumber?.trim() ?? "";
  const addressLine1 = payload.addressLine1?.trim() ?? "";
  const addressLine2 = payload.addressLine2?.trim() ?? "";
  const postcode = payload.postcode?.trim() ?? "";
  const city = payload.city?.trim() ?? "";
  const state = payload.state?.trim() ?? "";
  const country = payload.country?.trim() || "Malaysia";

  if (
    !firstName ||
    !lastName ||
    !dateOfBirth ||
    !sex ||
    !email ||
    !phoneNumber ||
    !emergencyContactNumber ||
    !password ||
    !confirmPassword ||
    !addressLine1 ||
    !postcode ||
    !city ||
    !state
  ) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Please fill in all required fields." },
        { status: 400 }
      )
    );
  }

  if (password !== confirmPassword) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      )
    );
  }

  if (password.length < 8) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Password must be at least 8 characters long." },
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

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      sex,
      role: "customer",
      country,
      emergency_contact_number: emergencyContactNumber,
      email_verified: false,
      phone_verified: false,
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

  if (!data.user.email_confirmed_at) {
    const { error: confirmError } = await adminClient.auth.admin.updateUserById(
      data.user.id,
      {
        email_confirm: true,
      }
    );

    if (confirmError) {
      return withCors(
        request,
        NextResponse.json(
          { error: "Account created, but email confirmation setup failed." },
          { status: 500 }
        )
      );
    }
  }

  const normalizedPhone = normalizePhone(phoneNumber);
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
        email,
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
        city,
        region: state,
        state,
        country,
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

  const { error: addressError } = await adminClient.from("addresses").insert({
    user_id: data.user.id,
    label: addressLabel,
    address_line_1: buildAddressLine1(unitNumber, addressLine1),
    address_line_2: addressLine2 || null,
    city,
    state,
    postcode,
    country,
    is_default: true,
  });

  if (addressError) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Account created, but address setup failed." },
        { status: 500 }
      )
    );
  }

  return withCors(
    request,
    NextResponse.json({
      success: true,
      email,
      requiresEmailVerification: false,
    })
  );
}