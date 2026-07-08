import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "./supabase-env";
import { getProviderCatalog, type ProviderCategoryKey } from "./provider-catalog";
import { buildProviderPortraitSrc } from "./provider-catalog-shared";

type HomeCustomerRow = {
  id: string;
  full_name: string | null;
  customer_profiles:
    | {
        city: string | null;
        state: string | null;
      }
    | Array<{
        city: string | null;
        state: string | null;
      }>
    | null;
};

type ProviderServiceSpecialtyRow = {
  specialty: string | null;
};

type HomeProviderRow = {
  id: string;
  marketing_name: string | null;
  service_location: string | null;
  latitude: number | null;
  longitude: number | null;
  average_rating: number | null;
  total_reviews: number | null;
  provider_services:
    | Array<{
        service_type: string;
        hourly_rate: number | null;
        provider_service_specialties: ProviderServiceSpecialtyRow[] | null;
      }>
    | null;
};

type UpcomingBookingRow = {
  id: string;
  booking_status: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  provider_profiles:
    | {
        marketing_name: string | null;
      }
    | Array<{
        marketing_name: string | null;
      }>
    | null;
  provider_services:
    | {
        service_type: string;
      }
    | Array<{
        service_type: string;
      }>
    | null;
};

export type HomeServiceCategory = {
  key: string;
  label: string;
};

export type HomeProviderCard = {
  id: string;
  serviceKey: ProviderCategoryKey;
  name: string;
  service: string;
  providerLatitude: number | null;
  providerLongitude: number | null;
  rating: number;
  reviews: number;
  distanceKm: number;
  priceLabel: string;
  statusLabel: string;
  specialties: string[];
  phoneVerified: boolean;
  identityVerified: boolean;
  portraitSrc: string;
};

export type HomeUpcomingBooking = {
  id: string;
  title: string;
  provider: string;
  scheduleLabel: string;
  statusLabel: string;
};

export type HomeFeedData = {
  greetingName: string;
  locationLabel: string;
  categories: HomeServiceCategory[];
  popularProviders: HomeProviderCard[];
  popularChefProviders: HomeProviderCard[];
  popularElectricianProviders: HomeProviderCard[];
  popularMaidProviders: HomeProviderCard[];
  upcomingBooking: HomeUpcomingBooking | null;
  errorMessage: string | null;
};

const serviceLabels: Record<string, string> = {
  chef: "Chef",
  maid: "Maid",
  tutor: "Tutor",
  driver: "Driver",
  cleaner: "Cleaner",
  babysitter: "Babysitter",
  plumber: "Plumber",
  electrician: "Electrician",
  other: "Other",
};

const serviceOrder = [
  "chef",
  "maid",
  "babysitter",
  "driver",
  "cleaner",
  "tutor",
  "plumber",
  "electrician",
] as const;

function humanizeService(serviceType: string) {
  return serviceLabels[serviceType] ?? serviceType;
}

function buildAdminSupabaseClient() {
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

function formatSchedule(dateValue: string | null, timeValue: string | null) {
  if (!dateValue) {
    return "Upcoming booking";
  }

  const date = new Date(`${dateValue}T${timeValue ?? "09:00:00"}`);

  return new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getProviderNode<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export const getHomeFeedData = cache(async (): Promise<HomeFeedData> => {
  const adminSupabase = buildAdminSupabaseClient();

  if (!adminSupabase) {
    return {
      greetingName: "Guest",
      locationLabel: "Kuala Lumpur",
      categories: serviceOrder.map((key) => ({
        key,
        label: humanizeService(key),
      })),
      popularProviders: [],
      popularChefProviders: [],
      popularElectricianProviders: [],
      popularMaidProviders: [],
      upcomingBooking: null,
      errorMessage: "Supabase keys are not configured for the home feed yet.",
    };
  }

  const [
    customerResult,
    providerResult,
    bookingResult,
    chefCatalog,
    electricianCatalog,
    maidCatalog,
  ] =
    await Promise.all([
    adminSupabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          customer_profiles (
            city,
            state
          )
        `
      )
      .eq("role", "customer")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    adminSupabase
      .from("provider_profiles")
      .select(
        `
          id,
          marketing_name,
          service_location,
          latitude,
          longitude,
          average_rating,
          total_reviews,
          provider_services (
            service_type,
            hourly_rate,
            provider_service_specialties (
              specialty
            )
          )
        `
      )
      .eq("is_visible", true)
      .order("average_rating", { ascending: false })
      .limit(8),
    adminSupabase
      .from("bookings")
      .select(
        `
          id,
          booking_status,
          scheduled_date,
          scheduled_start_time,
          provider_profiles (
            marketing_name
          ),
          provider_services (
            service_type
          )
        `
      )
      .in("booking_status", ["pending", "accepted", "on_the_way", "arrived"])
      .order("scheduled_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    getProviderCatalog("chef"),
    getProviderCatalog("electrician"),
    getProviderCatalog("maid"),
  ]);

  const customerRow = customerResult.data as HomeCustomerRow | null;
  const customerProfile = getProviderNode(customerRow?.customer_profiles);

  const providers = ((providerResult.data ?? []) as HomeProviderRow[]).map(
    (provider, index) => {
      const firstService = provider.provider_services?.[0];
      const specialties =
        firstService?.provider_service_specialties
          ?.map((item) => item.specialty)
          .filter((item): item is string => Boolean(item))
          .slice(0, 2) ?? [];

      const distanceKm = [2.4, 1.8, 3.1, 2.7, 2.2, 4.0, 3.6, 2.9][index] ?? 2.5;

      return {
        id: provider.id,
        serviceKey: (firstService?.service_type ?? "chef") as ProviderCategoryKey,
        name: provider.marketing_name ?? "DELLA Provider",
        service: humanizeService(firstService?.service_type ?? "other"),
        providerLatitude:
          typeof provider.latitude === "number" ? provider.latitude : null,
        providerLongitude:
          typeof provider.longitude === "number" ? provider.longitude : null,
        rating: Number(provider.average_rating ?? 4.8),
        reviews: provider.total_reviews ?? 0,
        distanceKm,
        priceLabel: `RM${Number(firstService?.hourly_rate ?? 25)}/hr`,
        statusLabel: "Available Today",
        specialties,
        phoneVerified: false,
        identityVerified: false,
        portraitSrc: buildProviderPortraitSrc({
          name: provider.marketing_name ?? "DELLA Provider",
          serviceKey: (firstService?.service_type ?? "chef") as ProviderCategoryKey,
        }),
      };
    }
  );

  const bookingRow = bookingResult.data as UpcomingBookingRow | null;
  const bookingProvider = getProviderNode(bookingRow?.provider_profiles);
  const bookingService = getProviderNode(bookingRow?.provider_services);

  const mapCatalogToHomeCards = (catalogListings: typeof chefCatalog.listings) =>
    catalogListings.slice(0, 5).map((listing) => ({
      id: listing.id,
      serviceKey: listing.serviceKey,
      name: listing.name,
      service: listing.serviceLabel,
      providerLatitude: listing.latitude,
      providerLongitude: listing.longitude,
      rating: listing.rating,
      reviews: listing.reviews,
      distanceKm: listing.distanceKm,
      priceLabel: `RM${listing.hourlyRate}/hr`,
      statusLabel: listing.availabilityLabel,
      specialties: listing.specialties,
      phoneVerified: listing.phoneVerified,
      identityVerified: listing.identityVerified,
      portraitSrc: listing.profileImageUrl,
    }));

  const popularChefProviders = mapCatalogToHomeCards(chefCatalog.listings);
  const popularElectricianProviders = mapCatalogToHomeCards(
    electricianCatalog.listings
  );
  const popularMaidProviders = mapCatalogToHomeCards(maidCatalog.listings);

  return {
    greetingName: customerRow?.full_name ?? "Guest",
    locationLabel:
      [customerProfile?.city, customerProfile?.state]
        .filter(Boolean)
        .join(", ") || "Kuala Lumpur",
    categories: serviceOrder.map((key) => ({
      key,
      label: humanizeService(key),
    })),
    popularProviders: providers,
    popularChefProviders,
    popularElectricianProviders,
    popularMaidProviders,
    upcomingBooking: bookingRow
      ? {
          id: bookingRow.id,
          title: humanizeService(bookingService?.service_type ?? "other"),
          provider: bookingProvider?.marketing_name ?? "DELLA Provider",
          scheduleLabel: formatSchedule(
            bookingRow.scheduled_date,
            bookingRow.scheduled_start_time
          ),
          statusLabel:
            bookingRow.booking_status === "pending"
              ? "Pending"
              : bookingRow.booking_status === "accepted"
                ? "Confirmed"
                : bookingRow.booking_status === "on_the_way"
                  ? "On the Way"
                  : "Arrived",
        }
      : null,
    errorMessage:
      customerResult.error?.message ??
      providerResult.error?.message ??
      bookingResult.error?.message ??
      null,
  };
});
