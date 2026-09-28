import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Swiper uses only super_admin/provider/customer as real roles today — admin,
// manager, and customer_care were never assigned to any live account and
// have been removed from every authorization check (see
// SWIPER_CRITICAL_SECURITY_REMEDIATION.md).
const ALLOWED_ADMIN_ROLES = new Set(["super_admin"]);

const ALLOWED_BUCKETS = new Set([
  "certificates",
  "identity-documents",
  "payment-proofs",
] as const);

type AdminMediaBucket = "certificates" | "identity-documents" | "payment-proofs";

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

function buildCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin === "https://admin.myswiper.my" ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
      ? origin
      : "https://admin.myswiper.my";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

async function verifyAdminRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 500 },
      ),
    } as const;
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing auth token." },
        { status: 401 },
      ),
    } as const;
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Invalid session." },
        { status: 401 },
      ),
    } as const;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !ALLOWED_ADMIN_ROLES.has(profile.role ?? "")) {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      ),
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

export async function POST(request: Request) {
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
    const payload = (await request.json()) as {
      bucket?: AdminMediaBucket;
      path?: string;
      expiresInSeconds?: number;
    };
    const bucket = payload.bucket;
    const path = payload.path?.trim() ?? "";

    if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json(
        { error: "Unsupported media bucket." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!path) {
      return NextResponse.json(
        { error: "Media path is required." },
        { status: 400, headers: corsHeaders },
      );
    }

    const signed = await verified.adminClient.storage
      .from(bucket)
      .createSignedUrl(path, payload.expiresInSeconds ?? 60 * 60);

    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json(
        { error: signed.error?.message || "Unable to sign media URL." },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { signedUrl: signed.data.signedUrl },
      { headers: corsHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to sign media URL.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
