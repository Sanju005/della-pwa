import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { uploadStoredMedia } from "@/lib/server-media-storage";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BUCKETS = new Set([
  "profile-images",
  "provider-work-images",
  "certificates",
  "identity-documents",
] as const);

type AllowedBucket =
  | "profile-images"
  | "provider-work-images"
  | "certificates"
  | "identity-documents";

type UploadPayload = {
  bucket?: AllowedBucket;
  dataUrl?: string;
  ownerId?: string;
  fileName?: string;
  pathParts?: string[];
  visibility?: "public" | "private";
};

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

export async function POST(request: Request) {
  try {
    const adminClient = getAdminSupabaseClient();

    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 500 },
      );
    }

    const payload = (await request.json()) as UploadPayload;
    const bucket = payload.bucket;
    const dataUrl = payload.dataUrl?.trim() ?? "";
    const ownerId = payload.ownerId?.trim() ?? "";
    const pathParts = Array.isArray(payload.pathParts)
      ? payload.pathParts.map((part) => part.trim()).filter(Boolean)
      : [];
    const fileName = payload.fileName?.trim() ?? "";
    const visibility = payload.visibility === "private" ? "private" : "public";

    if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json(
        { error: "Unsupported upload bucket." },
        { status: 400 },
      );
    }

    if (!dataUrl.startsWith("data:")) {
      return NextResponse.json(
        { error: "Upload requires a data URL payload." },
        { status: 400 },
      );
    }

    if (!ownerId) {
      return NextResponse.json(
        { error: "Upload owner is required." },
        { status: 400 },
      );
    }

    if (pathParts.length === 0) {
      return NextResponse.json(
        { error: "Upload path is required." },
        { status: 400 },
      );
    }

    const value = await uploadStoredMedia(adminClient, {
      bucket,
      dataUrl,
      ownerId,
      pathParts,
      fileName,
      upsert: true,
      visibility,
    });

    return NextResponse.json({ value });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload registration asset.",
      },
      { status: 500 },
    );
  }
}
