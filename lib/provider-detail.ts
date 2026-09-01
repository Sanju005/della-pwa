import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  buildProviderDetailHref,
  buildProviderPortraitSrc,
  getProviderCatalog,
  type CustomerLocation,
  type ProviderCategoryKey,
  type ProviderListing,
} from "./provider-catalog";
import { getProviderRegistration } from "./provider-registration-storage";
import type { ProviderRegistrationRecord, ProviderService } from "./provider-registration-types";
import { getSupabaseServiceKey, getSupabaseUrl } from "./supabase-env";

type ProviderGalleryImage = {
  src: string;
  alt: string;
  caption: string;
};

export type ProviderAvailabilitySlot = {
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  state: "available" | "booked";
};

export type ProviderBookedTimeRange = {
  startTimeLabel: string;
  endTimeLabel: string;
};

type ProviderCustomerReview = {
  id: string;
  customerName: string;
  rating: number;
  postedLabel: string;
  comment: string;
  images: string[];
};

export type ProviderCalendarDate = {
  isoDate: string;
  dayNumber: number;
  weekdayShort: string;
  state: "available" | "booked";
};

export type ProviderDetail = ProviderListing & {
  href: string;
  profileImage: string;
  title: string;
  reviewsLabel: string;
  jobsCompleted: number;
  locationFull: string;
  online: boolean;
  verified: boolean;
  backgroundChecked: boolean;
  about: string;
  gallery: ProviderGalleryImage[];
  hasUploadedGallery: boolean;
  availability: ProviderAvailabilitySlot[];
  calendarMonthLabel: string;
  calendarDates: ProviderCalendarDate[];
  bookedTimeRangesByDate: Record<string, ProviderBookedTimeRange[]>;
  customerReviews: ProviderCustomerReview[];
};

const providerDescriptions: Record<ProviderCategoryKey, string> = {
  chef:
    "Passionate chef with years of experience preparing fresh meals for daily dining, special family gatherings, and private events. DELLA customers book this chef for trusted home cooking, flexible menus, and warm service.",
  maid:
    "Reliable maid focused on keeping homes comfortable, clean, and well-organized. Suitable for regular cleaning routines, laundry support, and calm day-to-day household care.",
  babysitter:
    "Caring babysitter experienced with babies, toddlers, and school-age children. Families choose this provider for safe routines, patient supervision, and dependable support.",
  driver:
    "Professional driver for airport transfers, city trips, school runs, and planned daily schedules. Known for punctual service, safe driving, and clear communication.",
  cleaner:
    "Detail-oriented cleaner for apartments, homes, and deeper weekend resets. DELLA users book this provider for neat results, flexible hours, and consistent service quality.",
  tutor:
    "Friendly tutor offering structured learning support, patient explanations, and practical study routines. Suitable for one-to-one sessions and steady weekly improvement.",
  plumber:
    "Experienced plumber available for urgent leaks, installation work, and repair visits. Chosen for responsive communication, practical solutions, and reliable workmanship.",
  electrician:
    "Certified electrician for home maintenance, new installations, and troubleshooting. DELLA customers use this provider for clear pricing, safe fixes, and careful service.",
};

const galleryCaptions: Record<ProviderCategoryKey, [string, string, string]> = {
  chef: [
    "Homemade with fresh ingredients",
    "Authentic flavors, made with love",
    "Perfect for every occasion",
  ],
  maid: [
    "Fresh spaces, carefully maintained",
    "Detailed cleaning for busy homes",
    "Comfort and order every visit",
  ],
  babysitter: [
    "Warm care in a safe routine",
    "Play, support, and attention",
    "Trusted help for family schedules",
  ],
  driver: [
    "Comfortable rides across the city",
    "Reliable transport for daily plans",
    "Safe and punctual travel support",
  ],
  cleaner: [
    "Spotless rooms, refreshed daily",
    "Deep cleaning with care",
    "Bright results you can feel",
  ],
  tutor: [
    "Focused lessons that build confidence",
    "Learning plans made simple",
    "Steady progress for every student",
  ],
  plumber: [
    "Fast fixes for urgent repairs",
    "Clean installation and maintenance",
    "Solutions that keep homes running",
  ],
  electrician: [
    "Safe electrical work for the home",
    "Lighting, sockets, and upgrades",
    "Professional service you can trust",
  ],
};

const specialtyDefaults: Record<ProviderCategoryKey, string[]> = {
  chef: ["Malay", "Arabic", "Western", "Indian", "Asian", "Healthy Meals"],
  maid: ["Cleaning", "Laundry", "Ironing", "Deep Cleaning", "Kitchen Care", "Weekly Service"],
  babysitter: ["Toddler Care", "Newborn Care", "Night Care", "Homework Help", "Meal Support", "School Pickup"],
  driver: ["Airport Pickup", "Hourly Driver", "Outstation", "School Runs", "Event Trips", "Errands"],
  cleaner: ["Deep Cleaning", "Vacuum", "Kitchen Cleaning", "Bathroom Care", "Move-in Reset", "Weekly Service"],
  tutor: ["Mathematics", "English", "Science", "Reading", "Homework Help", "Exam Prep"],
  plumber: ["Pipe Repair", "Leak Fix", "Installation", "Toilet Repair", "Kitchen Plumbing", "Emergency Callout"],
  electrician: ["Wiring", "Lighting", "Socket Repair", "Fan Installation", "Troubleshooting", "Home Upgrades"],
};

type ReviewRow = {
  id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
  customer_id: string | null;
};

type CustomerProfileRow = {
  id: string;
  full_name: string | null;
};

type ProviderAvailabilityRow = {
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
};

type ProviderBookingWindowRow = {
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
};

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

function titleForService(serviceKey: ProviderCategoryKey) {
  switch (serviceKey) {
    case "chef":
      return "Professional Chef";
    case "maid":
      return "Professional Maid";
    case "babysitter":
      return "Trusted Babysitter";
    case "driver":
      return "Personal Driver";
    case "cleaner":
      return "Home Cleaner";
    case "tutor":
      return "Private Tutor";
    case "plumber":
      return "Licensed Plumber";
    case "electrician":
      return "Certified Electrician";
  }
}

function registrationServiceLabel(serviceKey: ProviderCategoryKey) {
  switch (serviceKey) {
    case "chef":
      return "Chef";
    case "maid":
      return "Maid";
    case "babysitter":
      return "Babysitter";
    case "driver":
      return "Driver";
    case "cleaner":
      return "Cleaner";
    case "tutor":
      return "Tutor";
    case "plumber":
      return "Plumber";
    case "electrician":
      return "Electrician";
  }
}

function collectRegistrationGallery(
  registration: ProviderRegistrationRecord | null,
  preferredService?: ProviderService | null,
) {
  if (!registration) {
    return [] satisfies ProviderGalleryImage[];
  }

  const orderedServices = [
    preferredService ?? null,
    ...registration.data.selectedServices.filter((service) => service !== preferredService),
  ].filter(Boolean) as ProviderService[];

  const gallery: ProviderGalleryImage[] = [];

  for (const service of orderedServices) {
    const details = registration.data.serviceDetails[service];

    if (!details) {
      continue;
    }

    details.imageDataUrls.forEach((src, index) => {
      const normalized = src.trim();

      if (!normalized) {
        return;
      }

      gallery.push({
        src: normalized,
        alt: `${service} work image ${index + 1}`,
        caption: details.imageCaptions[index]?.trim() || `${service} work ${index + 1}`,
      });
    });
  }

  return gallery;
}

function collectPortfolioGalleryFromListings(
  listings: ProviderListing[],
  preferredServiceKey?: ProviderCategoryKey,
) {
  const orderedListings = [
    ...listings.filter((listing) => listing.serviceKey === preferredServiceKey),
    ...listings.filter((listing) => listing.serviceKey !== preferredServiceKey),
  ];
  const seen = new Set<string>();
  const gallery: ProviderGalleryImage[] = [];

  for (const listing of orderedListings) {
    for (const image of listing.portfolioImages) {
      const normalizedSrc = image.src.trim();

      if (!normalizedSrc || seen.has(normalizedSrc)) {
        continue;
      }

      seen.add(normalizedSrc);
      gallery.push({
        src: normalizedSrc,
        alt: `${listing.name} work image ${gallery.length + 1}`,
        caption: image.caption?.trim() || `${listing.serviceLabel} work ${gallery.length + 1}`,
      });
    }
  }

  return gallery;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeDayKey(value: string) {
  return value.trim().toLowerCase();
}

function timeValueToLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const [rawHour, rawMinute] = value.slice(0, 5).split(":").map(Number);

  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) {
    return "";
  }

  const period = rawHour >= 12 ? "PM" : "AM";
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;

  return `${String(hour12).padStart(2, "0")}:${String(rawMinute).padStart(2, "0")} ${period}`;
}

function toTimeRangeLabel(startTimeLabel: string, endTimeLabel: string) {
  if (!startTimeLabel || !endTimeLabel) {
    return "Unavailable";
  }

  return `${startTimeLabel} - ${endTimeLabel}`;
}

function formatAvailabilityDate(date: Date) {
  return date.toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildAvailabilityFromRows(rows: ProviderAvailabilityRow[]): {
  availability: ProviderAvailabilitySlot[];
  availabilityLabel: string;
  calendarMonthLabel: string;
  calendarDates: ProviderCalendarDate[];
  workingDayKeys: Set<string>;
} {
  const rowByDayKey = new Map(
    rows.map((row) => [normalizeDayKey(row.day_of_week), row] as const),
  );
  const workingDayKeys = new Set(rowByDayKey.keys());
  const startDate = new Date();
  const availability = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    const dayKey = normalizeDayKey(
      date.toLocaleDateString("en-MY", { weekday: "long" }),
    );
    const row = rowByDayKey.get(dayKey);
    const startTimeLabel = timeValueToLabel(row?.start_time);
    const endTimeLabel = timeValueToLabel(row?.end_time);
    const isAvailable = Boolean(startTimeLabel && endTimeLabel);

    return {
      isoDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      dayLabel: date.toLocaleDateString("en-MY", { weekday: "short" }),
      dateLabel: formatAvailabilityDate(date),
      timeLabel: toTimeRangeLabel(startTimeLabel, endTimeLabel),
      startTimeLabel,
      endTimeLabel,
      state: isAvailable ? "available" : "booked",
    } satisfies ProviderAvailabilitySlot;
  });
  const nextAvailableSlot = availability.find((slot) => slot.state === "available");
  const calendar = buildCalendarDates(rowByDayKey);

  return {
    availability,
    availabilityLabel: nextAvailableSlot ? "Available" : "Unavailable",
    calendarMonthLabel: calendar.monthLabel,
    calendarDates: calendar.dates,
    workingDayKeys,
  };
}

function buildCalendarDates(rowByDayKey: Map<string, ProviderAvailabilityRow>): {
  monthLabel: string;
  dates: ProviderCalendarDate[];
} {
  const startDate = new Date();

  const dates: ProviderCalendarDate[] = Array.from({ length: 30 }, (_, index) => {
    const date = addDays(startDate, index);
    const dayNumber = date.getDate();
    const dayKey = normalizeDayKey(
      date.toLocaleDateString("en-MY", { weekday: "long" }),
    );
    const row = rowByDayKey.get(dayKey);

    return {
      isoDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`,
      dayNumber,
      weekdayShort: date.toLocaleDateString("en-MY", { weekday: "short" }),
      state:
        row?.start_time && row?.end_time
          ? "available"
          : "booked",
    };
  });

  const endDate = dates[dates.length - 1];

  return {
    monthLabel:
      endDate && endDate.isoDate.slice(0, 7) !== dates[0]?.isoDate.slice(0, 7)
        ? `${startDate.toLocaleDateString("en-MY", {
            month: "short",
            year: "numeric",
          })} - ${new Date(`${endDate.isoDate}T00:00:00`).toLocaleDateString("en-MY", {
            month: "short",
            year: "numeric",
          })}`
        : startDate.toLocaleDateString("en-MY", {
            month: "long",
            year: "numeric",
          }),
    dates,
  };
}

function mergeSpecialties(listing: ProviderListing) {
  const real = [...new Set(listing.specialties)];
  if (real.length > 0) {
    return real.slice(0, 6);
  }
  return specialtyDefaults[listing.serviceKey].slice(0, 6);
}

function buildCustomerReviews(listing: ProviderListing): ProviderCustomerReview[] {
  return [];
}

function isMissingReviewsTableError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("could not find the table") && normalized.includes("reviews")
  ) || (
    normalized.includes("relation") &&
    normalized.includes("reviews") &&
    normalized.includes("does not exist")
  );
}

function formatReviewPostedLabel(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMs = Date.now() - timestamp;
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs < dayMs) {
    return "Today";
  }

  const days = Math.floor(diffMs / dayMs);

  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

async function fetchProviderReviews(providerId: string): Promise<ProviderCustomerReview[]> {
  const supabase = buildSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, customer_id")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    if (!isMissingReviewsTableError(error.message)) {
      console.error("[Provider detail] Failed to load provider reviews:", error);
    }
    return [];
  }

  const rows = (data ?? []) as ReviewRow[];
  const customerIds = [...new Set(
    rows
      .map((row) => row.customer_id)
      .filter((value): value is string => Boolean(value)),
  )];

  let customerNameMap = new Map<string, string>();

  if (customerIds.length > 0) {
    const { data: customerProfiles, error: customerProfilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", customerIds);

    if (customerProfilesError) {
      console.error("[Provider detail] Failed to load customer names:", customerProfilesError);
    } else {
      customerNameMap = new Map(
        ((customerProfiles ?? []) as CustomerProfileRow[]).map((row) => [
          row.id,
          row.full_name?.trim() || "Customer",
        ]),
      );
    }
  }

  return rows.map((row) => ({
    id: row.id,
    customerName: row.customer_id
      ? customerNameMap.get(row.customer_id) || "Customer"
      : "Customer",
    rating: Math.max(1, Math.min(5, Number(row.rating ?? 5))),
    postedLabel: formatReviewPostedLabel(row.created_at),
    comment: row.comment?.trim() || "Shared feedback",
    images: [],
  }));
}

async function fetchProviderAvailabilityRows(
  providerId: string,
): Promise<ProviderAvailabilityRow[]> {
  const supabase = buildSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("provider_availability")
    .select("day_of_week, start_time, end_time")
    .eq("provider_id", providerId);

  if (error) {
    console.error("[Provider detail] Failed to load provider availability:", error);
    return [];
  }

  return (data ?? []) as ProviderAvailabilityRow[];
}

async function fetchProviderBookedTimeRangesByDate(
  providerId: string,
): Promise<Record<string, ProviderBookedTimeRange[]>> {
  const supabase = buildSupabaseAdminClient();

  if (!supabase) {
    return {};
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateIso = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, "0")}-${String(maxDate.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("bookings")
    .select("scheduled_date, scheduled_start_time, scheduled_end_time")
    .eq("provider_id", providerId)
    .gte("scheduled_date", today)
    .lte("scheduled_date", maxDateIso)
    .not("booking_status", "in", '("declined","declined_by_provider","cancelled")')
    .order("scheduled_date", { ascending: true })
    .order("scheduled_start_time", { ascending: true });

  if (error) {
    console.error("[Provider detail] Failed to load provider booking windows:", error);
    return {};
  }

  const rows = (data ?? []) as ProviderBookingWindowRow[];

  return rows.reduce<Record<string, ProviderBookedTimeRange[]>>((acc, row) => {
    const dateKey = row.scheduled_date;
    const bookedRange = {
      startTimeLabel: timeValueToLabel(row.scheduled_start_time),
      endTimeLabel: timeValueToLabel(row.scheduled_end_time),
    };

    if (!bookedRange.startTimeLabel || !bookedRange.endTimeLabel) {
      return acc;
    }

    acc[dateKey] = [...(acc[dateKey] ?? []), bookedRange];
    return acc;
  }, {});
}

function timeLabelToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  let hour24 = hour % 12;

  if (period === "PM") {
    hour24 += 12;
  }

  return hour24 * 60 + minute;
}

function buildHourlyStartOptions(startLabel: string, endLabel: string) {
  const startMinutes = timeLabelToMinutes(startLabel);
  const endMinutes = timeLabelToMinutes(endLabel);

  if (startMinutes === null || endMinutes === null) {
    return [];
  }

  const options: string[] = [];

  for (let current = startMinutes; current < endMinutes; current += 60) {
    const hour24 = Math.floor(current / 60);
    const minute = current % 60;
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    options.push(`${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`);
  }

  return options;
}

function hasOpenTimeOnDate(
  isoDate: string,
  slot: ProviderAvailabilitySlot,
  bookedTimeRangesByDate: Record<string, ProviderBookedTimeRange[]>,
) {
  if (slot.state !== "available") {
    return false;
  }

  const candidateStarts = buildHourlyStartOptions(
    slot.startTimeLabel,
    slot.endTimeLabel,
  );
  const bookings = bookedTimeRangesByDate[isoDate] ?? [];

  return candidateStarts.some((startLabel) => {
    const startMinutes = timeLabelToMinutes(startLabel);
    const endMinutes = startMinutes === null ? null : startMinutes + 60;

    if (startMinutes === null || endMinutes === null) {
      return false;
    }

    return !bookings.some((booking) => {
      const bookingStart = timeLabelToMinutes(booking.startTimeLabel);
      const bookingEnd = timeLabelToMinutes(booking.endTimeLabel);

      if (bookingStart === null || bookingEnd === null) {
        return false;
      }

      return startMinutes < bookingEnd && endMinutes > bookingStart;
    });
  });
}

function buildDetailFromListing(
  listing: ProviderListing,
  overrides?: {
    profileImage?: string | null;
    gallery?: ProviderGalleryImage[];
    customerReviews?: ProviderCustomerReview[];
    availability?: ProviderAvailabilitySlot[];
    availabilityLabel?: string;
    calendarMonthLabel?: string;
    calendarDates?: ProviderCalendarDate[];
    bookedTimeRangesByDate?: Record<string, ProviderBookedTimeRange[]>;
  },
): ProviderDetail {
  const captions = galleryCaptions[listing.serviceKey];
  const uploadedGallery =
    overrides?.gallery && overrides.gallery.length > 0
      ? overrides.gallery
      : listing.portfolioImages.length > 0
        ? listing.portfolioImages.map((image, index) => ({
            src: image.src,
            alt: `${listing.name} work image ${index + 1}`,
            caption: image.caption || captions[index] || `Work ${index + 1}`,
          }))
        : [];

  return {
    ...listing,
    href: buildProviderDetailHref(listing),
    title: titleForService(listing.serviceKey),
    profileImage:
      overrides?.profileImage?.trim() ||
      listing.profileImageUrl ||
      buildProviderPortraitSrc(listing),
    reviewsLabel: `${listing.rating.toFixed(1)} (${listing.reviews} reviews)`,
    jobsCompleted: Math.max(listing.reviews, 12),
    locationFull: `${listing.location}, Malaysia`,
    online: true,
    verified: listing.isApproved,
    backgroundChecked: listing.isApproved,
    about: providerDescriptions[listing.serviceKey],
    specialties: mergeSpecialties(listing),
    gallery: uploadedGallery,
    hasUploadedGallery: uploadedGallery.length > 0,
    availability: overrides?.availability ?? [],
    availabilityLabel: overrides?.availabilityLabel ?? listing.availabilityLabel,
    calendarMonthLabel: overrides?.calendarMonthLabel ?? "",
    calendarDates: overrides?.calendarDates ?? [],
    bookedTimeRangesByDate: overrides?.bookedTimeRangesByDate ?? {},
    customerReviews: overrides?.customerReviews ?? buildCustomerReviews(listing),
  };
}

export const getProviderDetail = cache(
  async (
    id: string,
    service: string | null,
    customerLocation?: CustomerLocation | null,
  ): Promise<ProviderDetail | null> => {
    const scopedCatalog = await getProviderCatalog(service, customerLocation);
    const scopedMatch = scopedCatalog.listings.find((listing) => listing.id === id);
    const allCatalog = service ? await getProviderCatalog(null, customerLocation) : scopedCatalog;
    const relatedListings = allCatalog.listings.filter((listing) => listing.id === id);

    if (scopedMatch) {
      const [registration, customerReviews, availabilityRows, bookedTimeRangesByDate] = await Promise.all([
        getProviderRegistration(id),
        fetchProviderReviews(id),
        fetchProviderAvailabilityRows(id),
        fetchProviderBookedTimeRangesByDate(id),
      ]);
      const availability = buildAvailabilityFromRows(availabilityRows);
      const availabilityWithConflicts = availability.availability.map((slot) => ({
        ...slot,
        state: hasOpenTimeOnDate(slot.isoDate, slot, bookedTimeRangesByDate)
          ? "available"
          : "booked",
      })) satisfies ProviderAvailabilitySlot[];
      const calendarDatesWithConflicts = availability.calendarDates.map((date) => {
        const matchingSlot = availability.availability.find((slot) => slot.isoDate === date.isoDate);

        if (!matchingSlot) {
          return date;
        }

        return {
          ...date,
          state: hasOpenTimeOnDate(date.isoDate, matchingSlot, bookedTimeRangesByDate)
            ? "available"
            : "booked",
        } satisfies ProviderCalendarDate;
      });
      const availabilityLabel = availabilityWithConflicts.some((slot) => slot.state === "available")
        ? "Available"
        : "Unavailable";
      const uploadedGallery = collectPortfolioGalleryFromListings(
        relatedListings.length > 0 ? relatedListings : [scopedMatch],
        scopedMatch.serviceKey,
      );
      const registrationGallery = uploadedGallery.length > 0
        ? uploadedGallery
        : collectRegistrationGallery(
            registration,
            registrationServiceLabel(scopedMatch.serviceKey),
          );

      return buildDetailFromListing(scopedMatch, {
        profileImage: null,
        gallery: registrationGallery,
        customerReviews,
        availability: availabilityWithConflicts,
        availabilityLabel,
        calendarMonthLabel: availability.calendarMonthLabel,
        calendarDates: calendarDatesWithConflicts,
        bookedTimeRangesByDate,
      });
    }

    const fallbackMatch = allCatalog.listings.find((listing) => listing.id === id);

    if (!fallbackMatch) {
      return null;
    }

    const [registration, customerReviews, availabilityRows, bookedTimeRangesByDate] = await Promise.all([
      getProviderRegistration(id),
      fetchProviderReviews(id),
      fetchProviderAvailabilityRows(id),
      fetchProviderBookedTimeRangesByDate(id),
    ]);
    const availability = buildAvailabilityFromRows(availabilityRows);
    const availabilityWithConflicts = availability.availability.map((slot) => ({
      ...slot,
      state: hasOpenTimeOnDate(slot.isoDate, slot, bookedTimeRangesByDate)
        ? "available"
        : "booked",
    })) satisfies ProviderAvailabilitySlot[];
    const calendarDatesWithConflicts = availability.calendarDates.map((date) => {
      const matchingSlot = availability.availability.find((slot) => slot.isoDate === date.isoDate);

      if (!matchingSlot) {
        return date;
      }

      return {
        ...date,
        state: hasOpenTimeOnDate(date.isoDate, matchingSlot, bookedTimeRangesByDate)
          ? "available"
          : "booked",
      } satisfies ProviderCalendarDate;
    });
    const availabilityLabel = availabilityWithConflicts.some((slot) => slot.state === "available")
      ? "Available"
      : "Unavailable";
    const uploadedGallery = collectPortfolioGalleryFromListings(
      relatedListings.length > 0 ? relatedListings : [fallbackMatch],
      fallbackMatch.serviceKey,
    );
    const registrationGallery = uploadedGallery.length > 0
      ? uploadedGallery
      : collectRegistrationGallery(
          registration,
          registrationServiceLabel(fallbackMatch.serviceKey),
        );

    return buildDetailFromListing(fallbackMatch, {
      profileImage: null,
      gallery: registrationGallery,
      customerReviews,
      availability: availabilityWithConflicts,
      availabilityLabel,
      calendarMonthLabel: availability.calendarMonthLabel,
      calendarDates: calendarDatesWithConflicts,
      bookedTimeRangesByDate,
    });
  }
);
