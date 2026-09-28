import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sendPushNotificationToUser } from "@/lib/push-notifications";
import { resolveStoredMediaUrl } from "@/lib/server-media-storage";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Swiper uses only super_admin/provider/customer as real roles today — admin,
// manager, and customer_care were never assigned to any live account and
// have been removed from every authorization check (see
// SWIPER_CRITICAL_SECURITY_REMEDIATION.md).
const ALLOWED_ADMIN_ROLES = new Set(["super_admin"]);

function buildCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin === "https://admin.myswiper.my" ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
      ? origin
      : "https://admin.myswiper.my";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  identity_document_type?: string | null;
  identity_front_image_url?: string | null;
  identity_back_image_url?: string | null;
  reviewed_at?: string | null;
  last_reviewed_at?: string | null;
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
        .select(
          "verified, identity_document_type, identity_front_image_url, identity_back_image_url, reviewed_at, last_reviewed_at",
        )
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

    const [identityFrontImageUrl, identityBackImageUrl] = await Promise.all([
      resolveStoredMediaUrl(verified.adminClient, {
        bucket: "identity-documents",
        value: customerProfile?.identity_front_image_url,
        visibility: "private",
      }),
      resolveStoredMediaUrl(verified.adminClient, {
        bucket: "identity-documents",
        value: customerProfile?.identity_back_image_url,
        visibility: "private",
      }),
    ]);

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
          kycVerifiedAt: customerProfile?.reviewed_at ?? null,
          identityDocumentType: customerProfile?.identity_document_type ?? null,
          identityFrontImageUrl: identityFrontImageUrl || null,
          identityBackImageUrl: identityBackImageUrl || null,
          identityReviewNote:
            typeof metadata.admin_approval_note === "string" ? metadata.admin_approval_note : null,
          identityLastReviewedAt: customerProfile?.last_reviewed_at ?? null,
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

// Admin-only customer identity/KYC review — approve or reject a customer's
// submitted IC/passport. Mirrors the trusted server-side pattern already
// used for providers (app/api/admin/provider-identity-documents/[id]),
// except customers have no separate `*_verifications` table: the same
// `customer_profiles.verified` boolean and Auth user_metadata fields the
// client-facing /api/profile/me route already reads are updated here,
// service-role, after this route's own super_admin gate — the customer
// client can never set these itself (see SWIPER_CRITICAL_SECURITY_REMEDIATION.md,
// SWP-012).
export async function POST(
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
    const { id: customerId } = await params;
    const payload = (await request.json()) as {
      action?: "verify";
      verified?: boolean;
      note?: string;
    };

    if (payload.action !== "verify") {
      return NextResponse.json(
        { error: "Unsupported customer identity action." },
        { status: 400, headers: corsHeaders },
      );
    }

    const isVerified = Boolean(payload.verified);
    const now = new Date().toISOString();

    const { error: profileError } = await verified.adminClient
      .from("customer_profiles")
      .update({
        verified: isVerified,
        reviewed_at: now,
        last_reviewed_at: now,
      })
      .eq("id", customerId);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message || "Unable to update customer verification record." },
        { status: 500, headers: corsHeaders },
      );
    }

    const authUser = await verified.adminClient.auth.admin.getUserById(customerId);
    const metadata =
      authUser.data?.user?.user_metadata && typeof authUser.data.user.user_metadata === "object"
        ? authUser.data.user.user_metadata
        : {};

    const { error: authUpdateError } = await verified.adminClient.auth.admin.updateUserById(
      customerId,
      {
        user_metadata: {
          ...metadata,
          identity_verification_status: isVerified ? "verified" : "rejected",
          admin_approval_note: payload.note?.trim() || metadata.admin_approval_note,
          admin_approval_note_updated_at: payload.note?.trim() ? now : metadata.admin_approval_note_updated_at,
        },
      },
    );

    if (authUpdateError) {
      return NextResponse.json(
        { error: authUpdateError.message || "Unable to update customer verification status." },
        { status: 500, headers: corsHeaders },
      );
    }

    const notificationTitle = isVerified ? "IC / Passport verified" : "Identity verification rejected";
    const notificationBody = isVerified
      ? "Admin has approved your IC / Passport verification."
      : payload.note?.trim()
        ? `Your IC / Passport verification was rejected: ${payload.note.trim()}`
        : "Your IC / Passport verification was rejected. Please resubmit clear photos.";

    await verified.adminClient.from("notifications").insert({
      user_id: customerId,
      booking_id: null,
      notification_type: isVerified ? "identity_verified" : "identity_review_rejected",
      title: notificationTitle,
      body: notificationBody,
    });

    await sendPushNotificationToUser(customerId, {
      title: notificationTitle,
      body: notificationBody,
      path: "/profile/verification/identity",
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update customer identity verification.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
