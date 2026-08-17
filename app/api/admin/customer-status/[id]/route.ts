import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

type CustomerProfileStatusRow = {
  verified?: boolean | null;
};

function readMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  return metadata?.[key] === true;
}

function readMetadataStatus(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.identity_verification_status;

  if (
    value === "pending" ||
    value === "processing" ||
    value === "verified" ||
    value === "rejected"
  ) {
    return value;
  }

  return "pending";
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

  try {
    const { id } = await params;

    const [authUserResult, customerProfileResult] = await Promise.all([
      verified.adminClient.auth.admin.getUserById(id),
      verified.adminClient
        .from("customer_profiles")
        .select("verified")
        .eq("id", id)
        .maybeSingle(),
    ]);

    if (authUserResult.error || !authUserResult.data.user) {
      return NextResponse.json(
        { error: authUserResult.error?.message || "User was not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    const authUser = authUserResult.data.user as {
      user_metadata?: Record<string, unknown> | null;
      email_confirmed_at?: string | null;
      phone_confirmed_at?: string | null;
      confirmed_at?: string | null;
    };
    const metadata =
      authUser.user_metadata && typeof authUser.user_metadata === "object"
        ? authUser.user_metadata
        : {};
    const customerProfile = (customerProfileResult.data ?? null) as CustomerProfileStatusRow | null;
    const identityStatus = readMetadataStatus(metadata);

    return NextResponse.json(
      {
        status: {
          emailVerified:
            readMetadataBoolean(metadata, "email_verified") ||
            Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
          phoneVerified:
            readMetadataBoolean(metadata, "phone_verified") ||
            Boolean(authUser.phone_confirmed_at),
          identityVerificationStatus:
            customerProfile?.verified || identityStatus === "verified"
              ? "verified"
              : identityStatus,
          emailVerifiedAt: authUser.email_confirmed_at || authUser.confirmed_at || null,
          phoneVerifiedAt: authUser.phone_confirmed_at || null,
          kycVerifiedAt:
            customerProfile?.verified || identityStatus === "verified"
              ? authUser.email_confirmed_at || authUser.confirmed_at || null
              : null,
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load customer verification status.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
