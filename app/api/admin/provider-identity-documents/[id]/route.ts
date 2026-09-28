import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sendPushNotificationToUser } from "@/lib/push-notifications";
import { uploadStoredMedia } from "@/lib/server-media-storage";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Swiper uses only super_admin/provider/customer as real roles today — admin,
// manager, and customer_care were never assigned to any live account and
// have been removed from every authorization check (see
// SWIPER_CRITICAL_SECURITY_REMEDIATION.md).
const ALLOWED_ADMIN_ROLES = new Set(["super_admin"]);

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
          // "processing" locks the provider app's upload screen — only
          // correct while a real submission is genuinely awaiting review.
          // Admin explicitly marking pending (without deleting anything)
          // must still let the provider act, so it uses "pending" instead,
          // same as the delete action's "rejected" already does.
          identity_verification_status: isVerified ? "verified" : "pending",
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

      // Mirror of the approve branch above: rejecting / un-verifying a
      // provider's identity must also pull them out of the live marketplace,
      // otherwise the admin list keeps showing Active + Approved for a
      // provider whose IC was just rejected.
      if (!isVerified) {
        await verified.adminClient
          .from("provider_profiles")
          .update({
            approval_status: "pending_review",
            is_visible: false,
          })
          .eq("id", providerId);

        await verified.adminClient
          .from("profiles")
          .update({ status: "pending" })
          .eq("id", providerId);
      }

      const notificationTitle = isVerified ? "IC / Passport verified" : "Identity review updated";
      const adminReason = payload.note?.trim();
      const notificationBody = isVerified
        ? `Admin has approved your IC / Passport verification.${adminReason ? ` Note: ${adminReason}` : ""}`
        : `Admin changed your IC / Passport verification back to pending review.${adminReason ? ` Reason: ${adminReason}` : ""}`;

      await verified.adminClient.from("notifications").insert({
        user_id: providerId,
        booking_id: null,
        notification_type: isVerified ? "identity_verified" : "identity_review_pending",
        title: notificationTitle,
        body: notificationBody,
      });

      await sendPushNotificationToUser(providerId, {
        title: notificationTitle,
        body: notificationBody,
        path: "/provider/profile/identity-verification",
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
      const note = payload.note?.trim() ?? "";

      if (!note) {
        return NextResponse.json(
          { error: "A reason is required to delete an identity document." },
          { status: 400, headers: corsHeaders },
        );
      }

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

      // The provider app's upload screen locks itself whenever
      // user_metadata.identity_verification_status is "processing" — that
      // field lives on the auth user, separate from the
      // provider_verifications row just updated above. Without syncing it
      // here too, a deleted document leaves the provider permanently unable
      // to re-upload: the row says "no document", but the metadata still
      // says "processing" from the original submission.
      const authUserForDelete = await verified.adminClient.auth.admin.getUserById(providerId);
      const metadataForDelete =
        authUserForDelete.data?.user?.user_metadata &&
        typeof authUserForDelete.data.user.user_metadata === "object"
          ? authUserForDelete.data.user.user_metadata
          : {};

      await verified.adminClient.auth.admin.updateUserById(providerId, {
        user_metadata: {
          ...metadataForDelete,
          identity_verification_status: "rejected",
          admin_approval_note: note,
          admin_approval_note_updated_at: now,
        },
      });

      const deleteNotificationBody = `Your ${side === "front" ? "front" : "back"} IC/passport image was removed by admin: ${note}. Please upload a new photo.`;

      await verified.adminClient.from("notifications").insert({
        user_id: providerId,
        booking_id: null,
        notification_type: "identity_review_rejected",
        title: "Identity document removed",
        body: deleteNotificationBody,
      });

      await sendPushNotificationToUser(providerId, {
        title: "Identity document removed",
        body: deleteNotificationBody,
        path: "/provider/profile/identity-verification",
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
