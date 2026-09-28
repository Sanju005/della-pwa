import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import { uploadStoredMedia, resolveStoredMediaUrl } from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Provider self-service "Support Documents" (driving license, other
// certificates) — intentionally separate from provider_verifications.
// Uploading or removing one here never touches identity_verified,
// kyc_verified, or any other verification-status field.
type ProviderProfileRow = {
  id: string;
  role: string | null;
};

type SupportDocumentRow = {
  id: string;
  provider_id: string;
  label: string;
  file_name: string;
  mime_type: string;
  stored_path: string;
  uploaded_at: string;
};

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
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

async function verifyProviderRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 }),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !isProviderRole((profile as ProviderProfileRow).role)) {
    return {
      error: NextResponse.json({ error: "This account is not a provider." }, { status: 403 }),
    };
  }

  return {
    adminClient,
    profile: profile as ProviderProfileRow,
  };
}

async function loadDocuments(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerId: string,
) {
  const { data, error } = await adminClient
    .from("provider_support_documents")
    .select("id, provider_id, label, file_name, mime_type, stored_path, uploaded_at")
    .eq("provider_id", providerId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load support documents.");
  }

  const rows = (data ?? []) as SupportDocumentRow[];

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      label: row.label,
      fileName: row.file_name,
      mimeType: row.mime_type,
      uploadedAt: row.uploaded_at,
      previewUrl: await resolveStoredMediaUrl(adminClient, {
        bucket: "certificates",
        value: row.stored_path,
        visibility: "private",
      }),
    })),
  );
}

export async function GET(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  try {
    const documents = await loadDocuments(verified.adminClient, verified.profile.id);
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load support documents." },
      { status: 500 },
    );
  }
}

type UploadPayload = {
  label?: string;
  fileName?: string;
  dataUrl?: string;
};

export async function POST(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json().catch(() => ({}))) as UploadPayload;
  const dataUrl = payload.dataUrl?.trim() ?? "";
  const fileName = payload.fileName?.trim() || "document";
  const label = payload.label?.trim() || fileName;

  if (!dataUrl.startsWith("data:")) {
    return NextResponse.json(
      { error: "A file is required." },
      { status: 400 },
    );
  }

  const mimeMatch = /^data:([^;,]+)/.exec(dataUrl);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";

  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image or PDF files are supported." },
      { status: 400 },
    );
  }

  try {
    const storedPath = await uploadStoredMedia(verified.adminClient, {
      bucket: "certificates",
      dataUrl,
      ownerId: verified.profile.id,
      pathParts: ["support-documents", `${Date.now()}`],
      fileName,
      visibility: "private",
    });

    if (!storedPath) {
      return NextResponse.json({ error: "Unable to store the file." }, { status: 500 });
    }

    const { error: insertError } = await verified.adminClient
      .from("provider_support_documents")
      .insert({
        provider_id: verified.profile.id,
        label,
        file_name: fileName,
        mime_type: mimeType,
        stored_path: storedPath,
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Unable to save the document." },
        { status: 500 },
      );
    }

    const documents = await loadDocuments(verified.adminClient, verified.profile.id);
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload the document." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json().catch(() => ({}))) as { id?: string };
  const id = payload.id?.trim() ?? "";

  if (!id) {
    return NextResponse.json({ error: "A document id is required." }, { status: 400 });
  }

  const { data: existing } = await verified.adminClient
    .from("provider_support_documents")
    .select("id, stored_path")
    .eq("id", id)
    .eq("provider_id", verified.profile.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const storedPath = (existing as { stored_path: string }).stored_path;

  if (storedPath) {
    await verified.adminClient.storage.from("certificates").remove([storedPath]);
  }

  const { error: deleteError } = await verified.adminClient
    .from("provider_support_documents")
    .delete()
    .eq("id", id)
    .eq("provider_id", verified.profile.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Unable to delete the document." },
      { status: 500 },
    );
  }

  try {
    const documents = await loadDocuments(verified.adminClient, verified.profile.id);
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load support documents." },
      { status: 500 },
    );
  }
}
