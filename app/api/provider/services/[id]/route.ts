import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  role: string | null;
};

type ServicePayload = {
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const params = await context.params;
  const payload = (await request.json()) as ServicePayload;

  const serviceLookup = await verified.adminClient
    .from("provider_services")
    .select("id, image_data_urls, image_captions")
    .eq("id", params.id)
    .eq("provider_id", verified.profile.id)
    .maybeSingle();

  if (serviceLookup.error || !serviceLookup.data) {
    return NextResponse.json({ error: "Service was not found." }, { status: 404 });
  }

  const imageDataUrls = normalizeMedia(payload.imageDataUrls);
  const imageCaptions = normalizeCaptions(payload.imageCaptions, imageDataUrls);

  const updateService = await verified.adminClient
    .from("provider_services")
    .update({
      years_experience: payload.yearsExperience?.trim() || "",
      hourly_rate: Number(payload.hourlyRate ?? 0),
      daily_rate: Number(payload.dailyRate ?? 0),
      image_data_urls: imageDataUrls,
      image_captions: imageCaptions,
    })
    .eq("id", params.id)
    .eq("provider_id", verified.profile.id);

  if (updateService.error && !isMissingProviderServiceMediaColumnError(updateService.error.message)) {
    return NextResponse.json(
      { error: updateService.error.message || "Unable to update service." },
      { status: 500 },
    );
  }

  if (updateService.error && isMissingProviderServiceMediaColumnError(updateService.error.message)) {
    const fallbackUpdate = await verified.adminClient
      .from("provider_services")
      .update({
        years_experience: payload.yearsExperience?.trim() || "",
        hourly_rate: Number(payload.hourlyRate ?? 0),
        daily_rate: Number(payload.dailyRate ?? 0),
      })
      .eq("id", params.id)
      .eq("provider_id", verified.profile.id);

    if (fallbackUpdate.error) {
      return NextResponse.json(
        { error: fallbackUpdate.error.message || "Unable to update service." },
        { status: 500 },
      );
    }
  }

  const deleteSpecialties = await verified.adminClient
    .from("provider_service_specialties")
    .delete()
    .eq("provider_service_id", params.id);

  if (deleteSpecialties.error) {
    return NextResponse.json(
      { error: deleteSpecialties.error.message || "Service was updated, but specialties could not be cleared." },
      { status: 500 },
    );
  }

  const specialties = normalizeSpecialties(payload.specialties);
  if (specialties.length > 0) {
    const specialtyWrite = await verified.adminClient
      .from("provider_service_specialties")
      .insert(
        specialties.map((specialty) => ({
          provider_service_id: params.id,
          specialty,
        })),
      );

    if (specialtyWrite.error) {
      return NextResponse.json(
        { error: specialtyWrite.error.message || "Service was updated, but specialties could not be saved." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
