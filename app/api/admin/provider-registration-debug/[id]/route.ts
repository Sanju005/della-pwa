import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getProviderRegistration } from "@/lib/provider-registration-storage";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "manager",
  "customer_care",
]);

function buildCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin === "https://admin.myswiper.my" ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
      ? origin
      : "https://admin.myswiper.my";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

function getAdminClient() {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyAdminRequest(request: Request) {
  const adminClient = getAdminClient();

  if (!adminClient) {
    return {
      error: NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 }),
    } as const;
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    } as const;
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    } as const;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !ALLOWED_ADMIN_ROLES.has(profile.role ?? "")) {
    return {
      error: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    } as const;
  }

  return { adminClient } as const;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin")),
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));
  const verified = await verifyAdminRequest(request);

  if ("error" in verified && verified.error) {
    const failureResponse = verified.error;
    Object.entries(corsHeaders).forEach(([key, value]) => {
      failureResponse.headers.set(key, value);
    });
    return failureResponse;
  }

  const { id } = await params;

  const [profileRow, providerProfileRow, verificationRow, servicesRow, registrationRow] = await Promise.all([
    verified.adminClient
      .from("profiles")
      .select("id, full_name, first_name, last_name, email, role, status, phone, avatar_url, emergency_contact, emergency_contact_number, created_at")
      .eq("id", id)
      .maybeSingle(),
    verified.adminClient
      .from("provider_profiles")
      .select("id, marketing_name, service_location, formatted_address, city, state, country, approval_status, verification_status, is_visible, bio")
      .eq("id", id)
      .maybeSingle(),
    verified.adminClient
      .from("provider_verifications")
      .select("id, provider_id, phone_verified, email_verified, identity_verified, kyc_verified, background_check_verified, identity_document_type, identity_front_image_url, identity_back_image_url, created_at")
      .or(`provider_id.eq.${id},id.eq.${id}`)
      .limit(1)
      .maybeSingle(),
    verified.adminClient
      .from("provider_services")
      .select("id, provider_id, service_type, years_experience, hourly_rate, daily_rate, image_data_urls, image_captions, certificate_data_urls, certificate_captions")
      .eq("provider_id", id),
    getProviderRegistration(id),
  ]);
  const authUser = await verified.adminClient.auth.admin.getUserById(id);

  return NextResponse.json(
    {
      providerId: id,
      stored: {
        authMetadata: authUser.data?.user?.user_metadata ?? null,
        profile: profileRow.data ?? null,
        providerProfile: providerProfileRow.data ?? null,
        providerVerification: verificationRow.data ?? null,
        providerServices: servicesRow.data ?? [],
        providerRegistrationSnapshot: registrationRow,
      },
      errors: {
        authMetadata: authUser.error?.message ?? null,
        profile: profileRow.error?.message ?? null,
        providerProfile: providerProfileRow.error?.message ?? null,
        providerVerification: verificationRow.error?.message ?? null,
        providerServices: servicesRow.error?.message ?? null,
      },
    },
    { headers: corsHeaders },
  );
}
