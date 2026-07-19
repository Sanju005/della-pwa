import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import { uploadStoredMediaList } from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  role: string | null;
};

type ServicePayload = {
  serviceType?: string;
  yearsExperience?: string;
  hourlyRate?: number;
  dailyRate?: number;
  specialties?: string[];
  imageDataUrls?: string[];
  imageCaptions?: string[];
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

  if (profileError || !profile || !isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json({ error: "This account is not a provider." }, { status: 403 }),
    };
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  };
}

function normalizeServiceType(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeSpecialties(items: string[] | undefined) {
  return (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMedia(items: string[] | undefined) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

function normalizeCaptions(items: string[] | undefined, media: string[]) {
  return media.map((_, index) => items?.[index]?.trim() ?? "");
}

function isMissingProviderServiceMediaColumnError(message?: string) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("column") &&
    (normalized.includes("image_data_urls") || normalized.includes("image_captions"))
  );
}

export async function POST(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json()) as ServicePayload;
  const serviceType = payload.serviceType?.trim() ? normalizeServiceType(payload.serviceType) : "";

  if (!serviceType) {
    return NextResponse.json({ error: "Service type is required." }, { status: 400 });
  }

  let insertedServiceId = "";

  const insertService = await verified.adminClient
    .from("provider_services")
    .insert({
      provider_id: verified.profile.id,
      service_type: serviceType,
      years_experience: payload.yearsExperience?.trim() || "",
      hourly_rate: Number(payload.hourlyRate ?? 0),
      daily_rate: Number(payload.dailyRate ?? 0),
      is_active: true,
    })
    .select("id")
    .single();

  if (!insertService.error && insertService.data) {
    insertedServiceId = insertService.data.id;
  } else {
    const fallbackInsert = await verified.adminClient
      .from("provider_services")
      .insert({
        provider_id: verified.profile.id,
        service_type: serviceType,
        years_experience: payload.yearsExperience?.trim() || "",
        hourly_rate: Number(payload.hourlyRate ?? 0),
        daily_rate: Number(payload.dailyRate ?? 0),
      })
      .select("id")
      .single();

    if (fallbackInsert.error || !fallbackInsert.data) {
      return NextResponse.json(
        { error: fallbackInsert.error?.message || insertService.error?.message || "Unable to add service." },
        { status: 500 },
      );
    }
    insertedServiceId = fallbackInsert.data.id;
  }

  const specialties = normalizeSpecialties(payload.specialties);
  if (specialties.length > 0) {
    const specialtyWrite = await verified.adminClient
      .from("provider_service_specialties")
      .insert(
        specialties.map((specialty) => ({
          provider_service_id: insertedServiceId,
          specialty,
        })),
      );

    if (specialtyWrite.error) {
      return NextResponse.json(
        { error: specialtyWrite.error.message || "Service was added, but specialties could not be saved." },
        { status: 500 },
      );
    }
  }

  const imageDataUrls = await uploadStoredMediaList(
    verified.adminClient,
    normalizeMedia(payload.imageDataUrls).map((dataUrl, index) => ({
      dataUrl,
      fileName: `service-image-${index + 1}.jpg`,
    })),
    {
      bucket: "provider-work-images",
      ownerId: verified.profile.id,
      pathPrefix: [insertedServiceId, "work"],
      visibility: "public",
    },
  );
  const imageCaptions = normalizeCaptions(payload.imageCaptions, imageDataUrls);

  if (imageDataUrls.length > 0) {
    const mediaWrite = await verified.adminClient
      .from("provider_services")
      .update({
        image_data_urls: imageDataUrls,
        image_captions: imageCaptions,
      })
      .eq("id", insertedServiceId)
      .eq("provider_id", verified.profile.id);

    if (mediaWrite.error && !isMissingProviderServiceMediaColumnError(mediaWrite.error.message)) {
      return NextResponse.json(
        { error: mediaWrite.error.message || "Service was added, but images could not be saved." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
