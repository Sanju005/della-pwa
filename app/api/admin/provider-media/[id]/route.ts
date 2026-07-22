import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { uploadStoredMedia } from "@/lib/server-media-storage";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ADMIN_ROLES = new Set(["super_admin", "admin", "manager", "customer_care"]);

type MediaKind = "profile" | "work" | "certificate";
type MediaAction = "upload" | "delete";

function buildCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin === "https://admin.dellaapp.com" ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
      ? origin
      : "https://admin.dellaapp.com";

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
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

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

function parseMediaId(mediaId?: string | null) {
  const match = mediaId?.match(/^(work|certificate)-(\d+)-(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    serviceIndex: Number(match[2]) - 1,
    mediaIndex: Number(match[3]) - 1,
  };
}

async function getProviderServices(adminClient: NonNullable<ReturnType<typeof getAdminClient>>, providerId: string) {
  const { data, error } = await adminClient
    .from("provider_services")
    .select("id, service_type, image_data_urls, image_captions, certificate_data_urls, certificate_captions")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load provider services.");
  }

  return (data ?? []) as Array<{
    id: string;
    service_type?: string | null;
    image_data_urls?: string[] | null;
    image_captions?: string[] | null;
    certificate_data_urls?: string[] | null;
    certificate_captions?: string[] | null;
  }>;
}

function removeArrayIndex(values: string[] | null | undefined, index: number) {
  return (values ?? []).filter((_, itemIndex) => itemIndex !== index);
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
      action?: MediaAction;
      kind?: MediaKind;
      dataUrl?: string;
      fileName?: string;
      mediaId?: string;
    };

    if (payload.action !== "upload" && payload.action !== "delete") {
      return NextResponse.json({ error: "Unsupported media action." }, { status: 400, headers: corsHeaders });
    }

    if (payload.kind !== "profile" && payload.kind !== "work" && payload.kind !== "certificate") {
      return NextResponse.json({ error: "Unsupported media kind." }, { status: 400, headers: corsHeaders });
    }

    if (payload.kind === "profile") {
      if (payload.action === "delete") {
        const { error } = await verified.adminClient
          .from("profiles")
          .update({ avatar_url: null })
          .eq("id", providerId);

        if (error) {
          throw new Error(error.message || "Unable to delete profile photo.");
        }

        return NextResponse.json({ ok: true }, { headers: corsHeaders });
      }

      const dataUrl = payload.dataUrl?.trim() ?? "";
      if (!dataUrl.startsWith("data:")) {
        return NextResponse.json({ error: "Profile photo upload requires a data URL." }, { status: 400, headers: corsHeaders });
      }

      const storedUrl = await uploadStoredMedia(verified.adminClient, {
        bucket: "profile-images",
        dataUrl,
        ownerId: providerId,
        pathParts: ["avatar"],
        fileName: payload.fileName?.trim() || "avatar.jpg",
        upsert: true,
        visibility: "public",
      });

      const { error } = await verified.adminClient
        .from("profiles")
        .update({ avatar_url: storedUrl })
        .eq("id", providerId);

      if (error) {
        throw new Error(error.message || "Unable to save profile photo.");
      }

      return NextResponse.json({ ok: true, value: storedUrl }, { headers: corsHeaders });
    }

    const services = await getProviderServices(verified.adminClient, providerId);
    const serviceIndex = parseMediaId(payload.mediaId)?.serviceIndex ?? 0;
    const targetService = services[serviceIndex] ?? services[0];

    if (!targetService) {
      return NextResponse.json({ error: "Provider service record was not found." }, { status: 404, headers: corsHeaders });
    }

    const isWork = payload.kind === "work";
    const valueColumn = isWork ? "image_data_urls" : "certificate_data_urls";
    const captionColumn = isWork ? "image_captions" : "certificate_captions";
    const currentValues = targetService[valueColumn] ?? [];
    const currentCaptions = targetService[captionColumn] ?? [];

    if (payload.action === "delete") {
      const parsed = parseMediaId(payload.mediaId);

      if (!parsed || parsed.mediaIndex < 0) {
        return NextResponse.json({ error: "Media reference is invalid." }, { status: 400, headers: corsHeaders });
      }

      const { error } = await verified.adminClient
        .from("provider_services")
        .update({
          [valueColumn]: removeArrayIndex(currentValues, parsed.mediaIndex),
          [captionColumn]: removeArrayIndex(currentCaptions, parsed.mediaIndex),
        })
        .eq("id", targetService.id)
        .eq("provider_id", providerId);

      if (error) {
        throw new Error(error.message || "Unable to delete media.");
      }

      return NextResponse.json({ ok: true }, { headers: corsHeaders });
    }

    const dataUrl = payload.dataUrl?.trim() ?? "";
    if (!dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Media upload requires a data URL." }, { status: 400, headers: corsHeaders });
    }

    const nextIndex = currentValues.length + 1;
    const storedValue = await uploadStoredMedia(verified.adminClient, {
      bucket: isWork ? "provider-work-images" : "certificates",
      dataUrl,
      ownerId: providerId,
      pathParts: [targetService.id, isWork ? "work" : "certificates", String(nextIndex)],
      fileName: payload.fileName?.trim() || `${payload.kind}-${nextIndex}.jpg`,
      upsert: false,
      visibility: isWork ? "public" : "private",
    });

    const { error } = await verified.adminClient
      .from("provider_services")
      .update({
        [valueColumn]: [...currentValues, storedValue],
        [captionColumn]: [...currentCaptions, payload.fileName?.trim() || `${payload.kind} ${nextIndex}`],
      })
      .eq("id", targetService.id)
      .eq("provider_id", providerId);

    if (error) {
      throw new Error(error.message || "Unable to save media.");
    }

    return NextResponse.json({ ok: true, value: storedValue }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update provider media." },
      { status: 500, headers: corsHeaders },
    );
  }
}
