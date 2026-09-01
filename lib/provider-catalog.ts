import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceKey, getSupabaseUrl } from "./supabase-env";
import { resolveStoredMediaUrl } from "./server-media-storage";
import { calculateDistanceKm } from "./provider-distance";
import {
  buildProviderPortraitSrc,
  serviceOrder,
  type ProviderCategoryKey,
} from "./provider-catalog-shared";
export {
  buildCategoryBannerSrc,
  buildProviderDetailHref,
  buildProviderPortraitSrc,
  serviceOrder,
} from "./provider-catalog-shared";
export type { ProviderCategoryKey } from "./provider-catalog-shared";

type ProviderServiceSpecialtyRow = {
  specialty: string | null;
};

type ProviderVerificationRow = {
  email_verified: boolean | null;
  phone_verified: boolean | null;
  identity_verified: boolean | null;
};

export type CustomerLocation = {
  latitude: number;
  longitude: number;
};

type ProviderCatalogRow = {
  id: string;
  marketing_name: string | null;
  service_location: string | null;
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number | null;
  average_rating: number | null;
  total_reviews: number | null;
  bio: string | null;
  approval_status: string | null;
  provider_verifications: ProviderVerificationRow | ProviderVerificationRow[] | null;
  provider_services:
    | Array<{
        service_type: string;
        hourly_rate: number | null;
        daily_rate: number | null;
        years_experience: string | null;
        image_data_urls?: string[] | null;
        image_captions?: string[] | null;
        provider_service_specialties: ProviderServiceSpecialtyRow[] | null;
      }>
    | null;
};

type ProviderCatalogServiceRow = NonNullable<ProviderCatalogRow["provider_services"]>[number];

type ProviderProfileMediaRow = {
  id: string;
  avatar_url: string | null;
  full_name: string | null;
};

type ProviderProfileMedia = {
  avatarUrl: string;
  fullName: string;
};

export type ProviderPortfolioImage = {
  src: string;
  caption: string;
};

export type ProviderListing = {
  id: string;
  name: string;
  providerName?: string;
  serviceKey: ProviderCategoryKey;
  serviceLabel: string;
  title: string;
  workMode: "Live-in" | "Part-time" | "Full-time";
  location: string;
  distanceKm: number | null;
  rating: number;
  reviews: number;
  hourlyRate: number;
  dailyRate: number;
  yearsExperience: string;
  specialties: string[];
  bio: string;
  availabilityLabel: string;
  imageTone: string;
  isApproved: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  profileImageUrl: string;
  portfolioImages: ProviderPortfolioImage[];
};

export type ProviderCatalogData = {
  service: ProviderCategoryKey | null;
  serviceLabel: string;
  listings: ProviderListing[];
  errorMessage: string | null;
};

const serviceLabels: Record<ProviderCategoryKey, string> = {
  chef: "Chef",
  maid: "Maid",
  babysitter: "Babysitter",
  driver: "Driver",
  cleaner: "Cleaner",
  tutor: "Tutor",
  plumber: "Plumber",
  electrician: "Electrician",
};

const imageTones = [
  "bg-[linear-gradient(135deg,#3a2417_0%,#8f5a35_40%,#d6b089_100%)]",
  "bg-[linear-gradient(135deg,#d7c0a9_0%,#f2e7d9_45%,#8cb39a_100%)]",
  "bg-[linear-gradient(135deg,#d6c7b2_0%,#f0e3d7_45%,#9e8a72_100%)]",
  "bg-[linear-gradient(135deg,#d8e6db_0%,#f0f6ef_45%,#7aa884_100%)]",
  "bg-[linear-gradient(135deg,#20352b_0%,#2f7d4e_45%,#a7d7a9_100%)]",
];

function buildSupabaseAdminClient() {
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

function isProviderCategoryKey(value: string): value is ProviderCategoryKey {
  return serviceOrder.includes(value as ProviderCategoryKey);
}

type ProviderAvailabilityRow = {
  provider_id: string;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
};

function nowInKualaLumpur() {
  const now = new Date();
  const dayKey = now
    .toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kuala_Lumpur" })
    .trim()
    .toLowerCase();
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(timeParts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(timeParts.find((part) => part.type === "minute")?.value ?? "0");

  return { dayKey, minutesSinceMidnight: hour * 60 + minute };
}

function timeStringToMinutes(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [hour, minute] = value.slice(0, 5).split(":").map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function timeStringToLabel(value: string | null | undefined) {
  const minutes = timeStringToMinutes(value);

  if (minutes === null) {
    return "";
  }

  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

export async function fetchProviderAvailabilityByProviderId(
  supabase: NonNullable<ReturnType<typeof buildSupabaseAdminClient>>,
  providerIds: string[],
) {
  const uniqueIds = [...new Set(providerIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map<string, ProviderAvailabilityRow[]>();
  }

  const { data, error } = await supabase
    .from("provider_availability")
    .select("provider_id, day_of_week, start_time, end_time")
    .in("provider_id", uniqueIds);

  if (error || !data) {
    return new Map<string, ProviderAvailabilityRow[]>();
  }

  const map = new Map<string, ProviderAvailabilityRow[]>();
  for (const row of data as ProviderAvailabilityRow[]) {
    const existing = map.get(row.provider_id) ?? [];
    existing.push(row);
    map.set(row.provider_id, existing);
  }

  return map;
}

export function computeAvailabilityLabel(rows: ProviderAvailabilityRow[]) {
  const { dayKey, minutesSinceMidnight } = nowInKualaLumpur();
  const todayRow = rows.find((row) => row.day_of_week?.trim().toLowerCase() === dayKey);
  const startMinutes = timeStringToMinutes(todayRow?.start_time);
  const endMinutes = timeStringToMinutes(todayRow?.end_time);

  if (startMinutes === null || endMinutes === null) {
    return "Unavailable Today";
  }

  if (minutesSinceMidnight >= endMinutes) {
    return `Last call ended at ${timeStringToLabel(todayRow?.end_time)}`;
  }

  return "Available Today";
}

function humanizeService(serviceKey: ProviderCategoryKey) {
  return serviceLabels[serviceKey];
}

const providerCatalogSelectWithMedia = `
  id,
  marketing_name,
  service_location,
  latitude,
  longitude,
  service_radius_km,
  average_rating,
  total_reviews,
  bio,
  approval_status,
  provider_verifications (
    email_verified,
    phone_verified,
    identity_verified
  ),
  provider_services (
    service_type,
    hourly_rate,
    daily_rate,
    years_experience,
    image_data_urls,
    image_captions,
    provider_service_specialties (
      specialty
    )
  )
`;

const providerCatalogSelectBase = `
  id,
  marketing_name,
  service_location,
  latitude,
  longitude,
  service_radius_km,
  average_rating,
  total_reviews,
  bio,
  approval_status,
  provider_verifications (
    email_verified,
    phone_verified,
    identity_verified
  ),
  provider_services (
    service_type,
    hourly_rate,
    daily_rate,
    years_experience,
    provider_service_specialties (
      specialty
    )
  )
`;

async function buildServicePortfolio(
  supabase: NonNullable<ReturnType<typeof buildSupabaseAdminClient>>,
  serviceRow: ProviderCatalogServiceRow,
) {
  const imageUrls = serviceRow.image_data_urls?.map((item) => item?.trim()).filter(Boolean) ?? [];
  const captions = serviceRow.image_captions ?? [];

  return Promise.all(
    imageUrls.map(async (src, index) => ({
      src: await resolveStoredMediaUrl(supabase, {
        bucket: "provider-work-images",
        value: src,
        visibility: "public",
      }),
      caption: captions[index]?.trim() || `Work ${index + 1}`,
    })),
  );
}

async function fetchProviderProfileMediaMap(
  supabase: NonNullable<ReturnType<typeof buildSupabaseAdminClient>>,
  providerIds: string[],
) {
  const uniqueIds = [...new Set(providerIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map<string, ProviderProfileMedia>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, avatar_url, full_name")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, ProviderProfileMedia>();
  }

  const entries = await Promise.all(
    (data as ProviderProfileMediaRow[])
      .map(async (row) => [
        row.id,
        {
          avatarUrl: await resolveStoredMediaUrl(supabase, {
            bucket: "profile-images",
            value: row.avatar_url,
            visibility: "public",
          }),
          fullName: row.full_name?.trim() || "",
        },
      ] as const),
  );

  return new Map(entries.filter(([, profile]) => Boolean(profile.avatarUrl) || Boolean(profile.fullName)));
}

export const getProviderCatalog = cache(
  async (
    service: string | null,
    customerLocation?: CustomerLocation | null,
  ): Promise<ProviderCatalogData> => {
    const serviceKey = service && isProviderCategoryKey(service) ? service : null;
    const supabase = buildSupabaseAdminClient();

    if (!supabase) {
      return {
        service: serviceKey,
        serviceLabel: serviceKey ? humanizeService(serviceKey) : "All Providers",
        listings: [],
        errorMessage: "Supabase keys are not configured for provider listings yet.",
      };
    }

    const providerQueryWithMedia = await supabase
      .from("provider_profiles")
      .select(providerCatalogSelectWithMedia)
      .eq("is_visible", true)
      .order("average_rating", { ascending: false });

    const providerQuery = providerQueryWithMedia.error?.message
      ?.toLowerCase()
      .includes("image_data_urls")
      ? await supabase
        .from("provider_profiles")
        .select(providerCatalogSelectBase)
        .eq("is_visible", true)
        .order("average_rating", { ascending: false })
      : providerQueryWithMedia;

    const rows = (providerQuery.data ?? []) as ProviderCatalogRow[];
    const profileMediaMap = await fetchProviderProfileMediaMap(
      supabase,
      rows.map((row) => row.id),
    );
    const availabilityMap = await fetchProviderAvailabilityByProviderId(
      supabase,
      rows.map((row) => row.id),
    );

    const realListings = (
      await Promise.all(
        rows.map(async (row, rowIndex) => {
          const serviceListings: Array<ProviderListing | null> = await Promise.all((row.provider_services ?? []).map(async (serviceRow) => {
            if (!isProviderCategoryKey(serviceRow.service_type)) {
              return null;
            }

            if (serviceKey && serviceRow.service_type !== serviceKey) {
              return null;
            }

            const verificationRow = Array.isArray(row.provider_verifications)
              ? row.provider_verifications[0]
              : row.provider_verifications;

            const profileMedia = profileMediaMap.get(row.id);

            const distanceKm =
              customerLocation &&
              typeof row.latitude === "number" &&
              typeof row.longitude === "number"
                ? calculateDistanceKm(
                    customerLocation.latitude,
                    customerLocation.longitude,
                    row.latitude,
                    row.longitude,
                  )
                : null;

            if (
              customerLocation &&
              distanceKm !== null &&
              typeof row.service_radius_km === "number" &&
              distanceKm > row.service_radius_km
            ) {
              return null;
            }

            const listing: ProviderListing = {
              id: row.id,
              name: row.marketing_name ?? "DELLA Provider",
              providerName: profileMedia?.fullName || undefined,
              serviceKey: serviceRow.service_type,
              serviceLabel: humanizeService(serviceRow.service_type),
              title: humanizeService(serviceRow.service_type),
              workMode: (["Live-in", "Part-time", "Full-time"][rowIndex % 3] ??
                "Full-time") as "Live-in" | "Part-time" | "Full-time",
              location: row.service_location ?? "Kuala Lumpur",
              distanceKm,
              rating: Number(row.average_rating ?? 4.8),
              reviews: row.total_reviews ?? 0,
              hourlyRate: Number(serviceRow.hourly_rate ?? 25),
              dailyRate: Number(serviceRow.daily_rate ?? 180),
              yearsExperience: serviceRow.years_experience ?? "New",
              specialties:
                serviceRow.provider_service_specialties
                  ?.map((item) => item.specialty)
                  .filter((item): item is string => Boolean(item))
                  .slice(0, 2) ?? [],
              bio: row.bio ?? "Trusted services available through DELLA.",
              availabilityLabel: computeAvailabilityLabel(
                availabilityMap.get(row.id) ?? [],
              ),
              imageTone: imageTones[rowIndex % imageTones.length],
              isApproved:
                row.approval_status === "approved" &&
                Boolean(verificationRow?.email_verified),
              phoneVerified:
                Boolean(verificationRow?.phone_verified),
              identityVerified:
                Boolean(verificationRow?.identity_verified),
              profileImageUrl:
                profileMedia?.avatarUrl ||
                buildProviderPortraitSrc({
                  name: row.marketing_name ?? "DELLA Provider",
                  serviceKey: serviceRow.service_type,
              }),
              portfolioImages: await buildServicePortfolio(supabase, serviceRow),
            };

            return listing;
          }));

          return serviceListings.filter((listing): listing is ProviderListing => Boolean(listing));
        })
      )
    ).flat();

    if (customerLocation) {
      realListings.sort((left, right) => {
        if (left.distanceKm === null) return 1;
        if (right.distanceKm === null) return -1;
        return left.distanceKm - right.distanceKm;
      });
    }

    if (!serviceKey) {
      return {
        service: null,
        serviceLabel: "All Providers",
        listings: realListings.slice(0, 24),
        errorMessage: providerQuery.error?.message ?? null,
      };
    }

    return {
      service: serviceKey,
      serviceLabel: humanizeService(serviceKey),
      listings: realListings,
      errorMessage: providerQuery.error?.message ?? null,
    };
  }
);
