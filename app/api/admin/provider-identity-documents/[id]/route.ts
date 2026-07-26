import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { uploadStoredMedia } from "@/lib/server-media-storage";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "manager",
  "customer_care",
]);

type IdentitySide = "front" | "back";
type IdentityAction = "upload" | "delete" | "verify";

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

function sideColumn(side: IdentitySide) {
  return side === "front" ? "identity_front_image_url" : "identity_back_image_url";
}

function isStoredPath(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return Boolean(trimmed && !trimmed.startsWith("data:") && !trimmed.startsWith("http://") && !trimmed.startsWith("https://"));
}

function defaultIdentityFileName(side: IdentitySide, documentType: string | null | undefined) {
  const prefix = documentType === "passport" ? "passport" : "ic";
  return `${prefix}-${side}.jpg`;
}

function normalizeDocumentType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized.includes("passport")) {
    return "passport";
  }

  return "ic";
}

async function findVerificationRow(adminClient: ReturnType<typeof getAdminClient>, providerId: string) {
  if (!adminClient) {
    return null;
  }

  const { data, error } = await adminClient
    .from("provider_verifications")
    .select("id, provider_id, identity_document_type, identity_front_image_url, identity_back_image_url")
    .or(`provider_id.eq.${providerId},id.eq.${providerId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load identity verification record.");
  }

  return data as {
    id?: string | null;
    provider_id?: string | null;
    identity_document_type?: string | null;
    identity_front_image_url?: string | null;
    identity_back_image_url?: string | null;
  } | null;
}

async function saveVerificationPayload(
  adminClient: NonNullable<ReturnType<typeof getAdminClient>>,
  providerId: string,
  payload: Record<string, string | boolean | null>,
) {
  const existing = await findVerificationRow(adminClient, providerId);

  if (existing?.id) {
    const { error } = await adminClient
      .from("provider_verifications")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message || "Unable to update identity document.");
    }

    return;
  }

  const { error } = await adminClient.from("provider_verifications").insert({
    provider_id: providerId,
    ...payload,
  });

  if (error) {
    throw new Error(error.message || "Unable to create identity document record.");
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin")),
  });
}

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
    const { id: providerId } = await params;
    const payload = (await request.json()) as {
      action?: IdentityAction;
      side?: IdentitySide;
      dataUrl?: string;
      fileName?: string;
      documentType?: string;
      verified?: boolean;
      note?: string;
      approveProvider?: boolean;
    };
    const action = payload.action;
    const side = payload.side;

    if (action !== "upload" && action !== "delete" && action !== "verify") {
      return NextResponse.json(
        { error: "Unsupported identity document action." },
        { status: 400, headers: corsHeaders },
      );
    }

    const existing = await findVerificationRow(verified.adminClient, providerId);
    const now = new Date().toISOString();
    const documentType = normalizeDocumentType(payload.documentType || existing?.identity_document_type);

    if (action === "verify") {
      const isVerified = Boolean(payload.verified);

      await saveVerificationPayload(verified.adminClient, providerId, {
        identity_document_type: documentType,
        identity_verified: isVerified,
        kyc_verified: isVerified,
        reviewed_at: now,
        last_reviewed_at: now,
      });

      const authUser = await verified.adminClient.auth.admin.getUserById(providerId);
      const metadata =
        authUser.data?.user?.user_metadata && typeof authUser.data.user.user_metadata === "object"
          ? authUser.data.user.user_metadata
          : {};

      await verified.adminClient.auth.admin.updateUserById(providerId, {
        user_metadata: {
          ...metadata,
          identity_verification_status: isVerified ? "verified" : "processing",
          identity_document_type: documentType,
          admin_approval_note: payload.note?.trim() || metadata.admin_approval_note,
          admin_approval_note_updated_at: payload.note?.trim() ? now : metadata.admin_approval_note_updated_at,
        },
      });

      if (isVerified && payload.approveProvider) {
        await verified.adminClient
          .from("provider_profiles")
          .update({
            approval_status: "approved",
            is_visible: true,
          })
          .eq("id", providerId);

        await verified.adminClient
          .from("profiles")
          .update({ status: "active" })
          .eq("id", providerId);
      }

      await verified.adminClient.from("notifications").insert({
        user_id: providerId,
        booking_id: null,
        notification_type: isVerified ? "identity_verified" : "identity_review_pending",
        title: isVerified ? "IC / Passport verified" : "Identity review updated",
        body: isVerified
          ? "Admin has approved your IC / Passport verification."
          : "Admin changed your IC / Passport verification back to pending review.",
      });

      return NextResponse.json({ ok: true }, { headers: corsHeaders });
    }

    if (side !== "front" && side !== "back") {
      return NextResponse.json(
        { error: "Identity document side must be front or back." },
        { status: 400, headers: corsHeaders },
      );
    }

    const column = sideColumn(side);

    if (action === "delete") {
      const existingValue = existing?.[column]?.trim() ?? "";

      if (isStoredPath(existingValue)) {
        const removed = await verified.adminClient.storage.from("identity-documents").remove([existingValue]);

        if (removed.error) {
          return NextResponse.json(
            { error: removed.error.message || "Unable to delete identity image." },
            { status: 500, headers: corsHeaders },
          );
        }
      }

      await saveVerificationPayload(verified.adminClient, providerId, {
        identity_document_type: documentType,
        [column]: null,
        identity_verified: false,
        kyc_verified: false,
        reviewed_at: null,
        last_reviewed_at: now,
      });

      return NextResponse.json({ ok: true }, { headers: corsHeaders });
    }

    const dataUrl = payload.dataUrl?.trim() ?? "";

    if (!dataUrl.startsWith("data:")) {
      return NextResponse.json(
        { error: "Identity upload requires a data URL." },
        { status: 400, headers: corsHeaders },
      );
    }

    const storedPath = await uploadStoredMedia(verified.adminClient, {
      bucket: "identity-documents",
      dataUrl,
      ownerId: providerId,
      pathParts: ["identity", side],
      fileName: payload.fileName?.trim() || defaultIdentityFileName(side, documentType),
      upsert: true,
      visibility: "private",
    });

    const existingValue = existing?.[column]?.trim() ?? "";

    if (isStoredPath(existingValue) && existingValue !== storedPath) {
      await verified.adminClient.storage.from("identity-documents").remove([existingValue]);
    }

    await saveVerificationPayload(verified.adminClient, providerId, {
      identity_document_type: documentType,
      [column]: storedPath,
      identity_verified: false,
      kyc_verified: false,
      reviewed_at: null,
      last_reviewed_at: now,
    });

    return NextResponse.json({ ok: true, value: storedPath }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update identity document.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
