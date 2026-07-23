import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase-env";

type MediaBucket =
  | "profile-images"
  | "provider-work-images"
  | "job-completion-images"
  | "payment-proofs"
  | "review-images"
  | "certificates"
  | "identity-documents";

type UploadStoredMediaOptions = {
  bucket: MediaBucket;
  dataUrl: string;
  ownerId: string;
  pathParts: string[];
  fileName?: string | null;
  upsert?: boolean;
  visibility?: "public" | "private";
};

type ResolveStoredMediaOptions = {
  bucket: MediaBucket;
  value: string | null | undefined;
  visibility?: "public" | "private";
  expiresInSeconds?: number;
};

const IMAGE_MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "image/jfif": "jfif",
  "application/pdf": "pdf",
};

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/i);

  if (!match) {
    throw new Error("Invalid data URL.");
  }

  const [, mimeType, base64Payload] = match;
  return {
    mimeType: mimeType.toLowerCase(),
    buffer: Buffer.from(base64Payload, "base64"),
  };
}

function extractStoragePathFromUrl(bucket: MediaBucket, value: string) {
  if (!isHttpUrl(value)) {
    return "";
  }

  const candidates = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];

  try {
    const parsed = new URL(value);
    const supabaseUrl = getSupabaseUrl();

    if (supabaseUrl) {
      const parsedSupabaseUrl = new URL(supabaseUrl);

      if (parsed.origin !== parsedSupabaseUrl.origin) {
        return "";
      }
    }

    for (const prefix of candidates) {
      const prefixIndex = parsed.pathname.indexOf(prefix);

      if (prefixIndex === -1) {
        continue;
      }

      const rawPath = parsed.pathname.slice(prefixIndex + prefix.length);
      return decodeURIComponent(rawPath).trim();
    }
  } catch {
    return "";
  }

  return "";
}

function normalizeStoredMediaValue(bucket: MediaBucket, value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (isDataUrl(trimmed)) {
    return trimmed;
  }

  const storagePath = extractStoragePathFromUrl(bucket, trimmed);
  return storagePath || trimmed;
}

function getExtension(mimeType: string, fileName?: string | null) {
  const normalizedFileName = fileName?.trim().toLowerCase() ?? "";
  const nameExtension = normalizedFileName.includes(".")
    ? normalizedFileName.split(".").pop() ?? ""
    : "";

  if (nameExtension) {
    return sanitizePathSegment(nameExtension);
  }

  return IMAGE_MIME_EXTENSION_MAP[mimeType] ?? "bin";
}

function buildStoragePath(ownerId: string, pathParts: string[], fileName?: string | null, mimeType?: string) {
  const cleanOwnerId = sanitizePathSegment(ownerId);
  const cleanParts = pathParts.map(sanitizePathSegment).filter(Boolean);
  const extension = getExtension(mimeType ?? "", fileName);
  const leafName = sanitizePathSegment(fileName?.replace(/\.[^.]+$/, "") || cleanParts.pop() || `${Date.now()}`);
  return [cleanOwnerId, ...cleanParts, `${leafName}.${extension}`].join("/");
}

export async function uploadStoredMedia(
  adminClient: SupabaseClient,
  options: UploadStoredMediaOptions,
) {
  const trimmed = normalizeStoredMediaValue(options.bucket, options.dataUrl);

  if (!trimmed) {
    return "";
  }

  if (!isDataUrl(trimmed)) {
    return trimmed;
  }

  const { mimeType, buffer } = parseDataUrl(trimmed);
  const storagePath = buildStoragePath(
    options.ownerId,
    options.pathParts,
    options.fileName,
    mimeType,
  );

  const uploadResult = await adminClient.storage
    .from(options.bucket)
    .upload(storagePath, buffer, {
      upsert: options.upsert ?? false,
      contentType: mimeType,
    });

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to upload media.");
  }

  if (options.visibility === "private") {
    return storagePath;
  }

  const { data } = adminClient.storage.from(options.bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function uploadStoredMediaList(
  adminClient: SupabaseClient,
  items: Array<{ dataUrl: string; fileName?: string | null }>,
  options: Omit<UploadStoredMediaOptions, "dataUrl" | "fileName" | "pathParts"> & {
    pathPrefix: string[];
  },
) {
  const uploaded = await Promise.all(
    items.map((item, index) =>
      uploadStoredMedia(adminClient, {
        bucket: options.bucket,
        dataUrl: item.dataUrl,
        ownerId: options.ownerId,
        pathParts: [...options.pathPrefix, `${Date.now()}-${index + 1}`],
        fileName: item.fileName,
        upsert: options.upsert,
        visibility: options.visibility,
      }),
    ),
  );

  return uploaded.filter(Boolean);
}

export async function resolveStoredMediaUrl(
  adminClient: SupabaseClient,
  options: ResolveStoredMediaOptions,
) {
  const trimmed = normalizeStoredMediaValue(options.bucket, options.value?.trim() ?? "");

  if (!trimmed || isDataUrl(trimmed)) {
    return trimmed;
  }

  if (options.visibility !== "private") {
    const { data } = adminClient.storage.from(options.bucket).getPublicUrl(trimmed);
    return data.publicUrl;
  }

  const signed = await adminClient.storage
    .from(options.bucket)
    .createSignedUrl(trimmed, options.expiresInSeconds ?? 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return "";
  }

  return signed.data.signedUrl;
}

export async function resolveStoredMediaUrlList(
  adminClient: SupabaseClient,
  bucket: MediaBucket,
  values: string[] | null | undefined,
  visibility: "public" | "private" = "public",
) {
  const items = (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  const resolved = await Promise.all(
    items.map((item) =>
      resolveStoredMediaUrl(adminClient, {
        bucket,
        value: item,
        visibility,
      }),
    ),
  );

  return resolved.filter(Boolean);
}
