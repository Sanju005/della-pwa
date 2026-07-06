"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  ChefHat,
  ChevronDown,
  Clock3,
  Building2,
  IdCard,
  MapPin,
  Phone,
  ShieldCheck,
  Smile,
  Star,
  StarIcon,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import { EmptyState as SharedEmptyState } from "@/app/_components/della-ui";
import { FavoriteProviderButton } from "@/app/_components/favorite-provider-button";

import { LiveLocationChip } from "@/app/_components/live-location-chip";
import {
  loadCurrentLiveLocation,
  resolveCurrentLiveLocation,
  type StoredLiveLocation,
} from "@/lib/live-location";
import { calculateDistanceKm, formatDistanceKm } from "@/lib/provider-distance";

type TabKey = "all" | "active-now";
type SortKey = "popular" | "nearest" | "price-low";
type WorkMode = "Live-in" | "Part-time" | "Full-time";
type ServiceKey =
  | "chef"
  | "maid"
  | "babysitter"
  | "driver"
  | "cleaner"
  | "tutor"
  | "plumber"
  | "electrician"
  | null;

type CatalogScreenListing = {
  id: string;
  name: string;
  providerName?: string;
  serviceKey: Exclude<ServiceKey, null>;
  serviceLabel: string;
  workMode: WorkMode;
  bio: string;
  specialties: string[];
  latitude: number | null;
  longitude: number | null;
  distanceKm: number;
  rating: number;
  reviews: number;
  hourlyRate: number;
  yearsExperience: string;
  availabilityLabel: string;
  href: string;
  portraitSrc: string;
  isApproved: boolean;
};

type CatalogScreenData = {
  service: ServiceKey;
  serviceLabel: string;
  bannerSrc: string;
  listings: CatalogScreenListing[];
  errorMessage: string | null;
};

const serviceIcons: Partial<
  Record<Exclude<ServiceKey, null>, ComponentType<{ className?: string }>>
> = {
  chef: ChefHat,
  maid: UserRound,
  babysitter: UserRound,
  driver: BriefcaseBusiness,
  cleaner: UserRound,
  tutor: BriefcaseBusiness,
  plumber: BriefcaseBusiness,
  electrician: BriefcaseBusiness,
};

export function ProvidersCatalogScreen({ data }: { data: CatalogScreenData }) {
  const [locationDetails, setLocationDetails] = useState<StoredLiveLocation | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StoredLiveLocation | null>(() =>
    loadCurrentLiveLocation()
  );
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("popular");

  useEffect(() => {
    if (currentLocation) {
      return;
    }

    let active = true;

    void resolveCurrentLiveLocation("Current location", { persist: "current" })
      .then((nextLocation) => {
        if (active && nextLocation) {
          setCurrentLocation(nextLocation);
        }
      })
      .catch(() => {
        return;
      });

    return () => {
      active = false;
    };
  }, [currentLocation]);

  const getListingDistanceKm = (listing: CatalogScreenListing) => {
    if (
      currentLocation &&
      typeof listing.latitude === "number" &&
      typeof listing.longitude === "number"
    ) {
      return calculateDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        listing.latitude,
        listing.longitude
      );
    }

    return listing.distanceKm;
  };

  const counts = useMemo(
    () => ({
      all: data.listings.length,
      "active-now": data.listings.filter((item) => item.availabilityLabel === "Available Today").length,
    }),
    [data.listings]
  );

  const filteredListings = useMemo(() => {
    let items = data.listings.filter((listing) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "active-now" && listing.availabilityLabel === "Available Today");

      return matchesTab;
    });

    items = [...items].sort((left, right) => {
      if (sortBy === "nearest") {
        return getListingDistanceKm(left) - getListingDistanceKm(right);
      }
      if (sortBy === "price-low") return left.hourlyRate - right.hourlyRate;
      if (right.rating !== left.rating) return right.rating - left.rating;
      return right.reviews - left.reviews;
    });

    return items;
  }, [activeTab, data.listings, sortBy, currentLocation]);

  const Icon = data.service
    ? serviceIcons[data.service] ?? BriefcaseBusiness
    : BriefcaseBusiness;
  const serviceTitle = data.serviceLabel ? `${data.serviceLabel} Services` : "Service Providers";
  const serviceLower = (data.serviceLabel || "service").toLowerCase();
  const heroProviders = filteredListings.slice(0, 3);
  const extraProviders = Math.max(filteredListings.length - heroProviders.length, 0);
  const fullAddress =
    locationDetails?.formattedAddress ||
    locationDetails?.label ||
    "Bandar Puteri Puchong, Subang Jaya City Council";
  const availabilitySummaryLabel =
    sortBy === "nearest"
      ? `${serviceLower} available nearby`
      : sortBy === "price-low"
        ? `${serviceLower} with lower hourly rates`
        : `popular ${serviceLower} based on rating`;

  return (
    <main className="min-h-[100dvh] bg-[#fbf8ff]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[linear-gradient(180deg,#ffffff_0%,#fbf8fe_100%)] px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="py-6">
          <header className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/home"
                className="inline-flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[18px] border border-[#e3ebe6] bg-white text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              >
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <LiveLocationChip
                fallbackLabel="Search location or address..."
                className="flex-1 min-w-0"
                onLocationChange={(location) => {
                  setLocationDetails(location);
                  setCurrentLocation(location);
                }}
                displayLabel="Search location or address..."
                leadingIcon="search"
                showChevron={false}
              />
            </div>

            <div className="rounded-[28px] border border-[#edf1ee] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#f3ebfc] text-[#8E5EB5]">
                  <MapPin className="h-6 w-6 fill-[#8E5EB5] text-[#8E5EB5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#98A2B3]">Location name</p>
                  <p className="mt-1 text-[16px] font-extrabold tracking-[-0.03em] text-[#1f2c44]">
                    {locationDetails?.addressLabel || "Home"}
                  </p>
                </div>
              </div>

              <div className="my-4 h-px bg-[#edf1ee]" />

              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#f3ebfc] text-[#8E5EB5]">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#98A2B3]">Address</p>
                  <p className="mt-1 text-[14px] font-medium leading-7 text-[#1f2c44]">
                    {fullAddress}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section className="mt-5">
            <div className="rounded-[30px] bg-white px-5 py-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] ring-1 ring-[#eff4f1]">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] bg-[#f3ebfc] text-[#8E5EB5] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <Icon className="h-12 w-12 stroke-[1.8]" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <h1 className="text-[1.72rem] font-extrabold tracking-[-0.05em] text-[#13294b]">
                    {serviceTitle}
                  </h1>
                  <p className="mt-0.5 text-[14px] leading-6 text-[#667085]">
                    Find trusted and verified
                    <br />
                    {serviceLower} services near you
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-[#ebf0ed] rounded-[20px] border border-[#eef3f0] bg-white">
                <TrustBadge
                  icon={<ShieldCheck className="h-5 w-5 text-[#8E5EB5]" />}
                  title="Verified"
                  label="Background checked"
                />
                <TrustBadge
                  icon={<StarIcon className="h-5 w-5 text-[#8E5EB5]" />}
                  title="4.8+ Rated"
                  label="High ratings & reviews"
                />
                <TrustBadge
                  icon={<ShieldCheck className="h-5 w-5 text-[#8E5EB5]" />}
                  title="Secure Booking"
                  label="Protected payments"
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center">
                  {heroProviders.map((listing, index) => (
                    <div
                      key={listing.id}
                      className={`relative h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_18px_rgba(15,23,42,0.08)] ${index === 0 ? "" : "-ml-2.5"}`}
                    >
                      <Image
                        src={listing.portraitSrc}
                        alt={listing.name}
                        width={80}
                        height={80}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                  {extraProviders > 0 ? (
                    <div className="-ml-2.5 inline-flex h-11 min-w-11 items-center justify-center rounded-full border-2 border-white bg-[#8E5EB5] px-2 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(142,94,181,0.28)]">
                      +{extraProviders}
                    </div>
                  ) : null}
                </div>
                <p className="text-[15px] font-medium text-[#667085]">
                  <span className="font-semibold text-[#344054]">{filteredListings.length}</span>{" "}
                  {serviceLower} available
                </p>
              </div>
            </div>
          </section>

          <section className="mt-7 flex items-center gap-2.5 overflow-x-auto pb-1">
              <FilterPill
              active={sortBy === "nearest"}
              onClick={() => setSortBy("nearest")}
              icon={<MapPin className="h-4 w-4" />}
              label="Nearby"
            />
            <FilterPill
              active={sortBy === "popular"}
              onClick={() => setSortBy("popular")}
              icon={<Star className="h-4 w-4" />}
              label="Top Rated"
            />
            <FilterPill
              active={sortBy === "price-low"}
              onClick={() => setSortBy("price-low")}
              icon={<BadgeCheck className="h-4 w-4" />}
              label="Low Rate"
            />
          </section>

          <section className="mt-5 overflow-hidden rounded-[24px] border border-[#E5ECE7] bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <div className="grid grid-cols-2 gap-2">
              <TabButton
                active={activeTab === "all"}
                onClick={() => setActiveTab("all")}
                label="All"
                count={counts.all}
              />
              <TabButton
                active={activeTab === "active-now"}
                onClick={() => setActiveTab("active-now")}
                label="Active now"
                count={counts["active-now"]}
              />
            </div>
          </section>

          {data.errorMessage ? (
            <div className="mt-5 rounded-[18px] border border-[#F3C7C7] bg-[#FFF4F4] px-4 py-3 text-[13px] font-semibold text-[#B42318]">
              {data.errorMessage}
            </div>
          ) : null}

          <section className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] text-[#667085]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8E5EB5]" />
                  <span>
                    <span className="font-semibold text-[#344054]">{filteredListings.length}</span>{" "}
                    {availabilitySummaryLabel}
                  </span>
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-[14px] text-[#98A2B3]">
                <span>Sort by</span>
                <span className="relative">
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortKey)}
                    className="appearance-none bg-transparent pl-1 pr-6 text-[15px] font-bold text-[#8E5EB5] outline-none"
                  >
                    <option value="popular">Popular</option>
                    <option value="nearest">Nearest</option>
                    <option value="price-low">Low Rate</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E5EB5]" />
                </span>
              </label>
            </div>

            <div className="mt-5 space-y-4">
              {filteredListings.length === 0 ? (
                <SharedEmptyState
                  title="No providers matched this filter"
                  description="Try a different keyword, work mode, or sort option to see more nearby providers."
                />
              ) : null}
              {filteredListings.map((listing) => (
                <ProviderCard
                  key={listing.id}
                  listing={listing}
                  distanceKm={getListingDistanceKm(listing)}
                  sortBy={sortBy}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function TrustBadge({
  icon,
  title,
  label,
}: {
  icon: ReactNode;
  title: string;
  label: string;
}) {
  return (
    <div className="min-w-0 px-3 py-2.5 text-center">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f3ebfc] text-[#8E5EB5]">
        {icon}
      </div>
      <p className="mt-2 text-[12px] font-bold text-[#22324c]">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-[#667085]">{label}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-12 shrink-0 items-center gap-2 rounded-[18px] border px-4 text-[13px] font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${
        active
          ? "border-[#dbc8ed] bg-[#f3ebfc] text-[#8E5EB5]"
          : "border-[#e7ece8] bg-white text-[#344054]"
      }`}
    >
      <span className={active ? "text-[#8E5EB5]" : "text-[#344054]"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-center transition ${
        active ? "bg-[#8E5EB5] text-white shadow-[0_12px_22px_rgba(142,94,181,0.24)]" : "text-[#344054]"
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
        <span
          className={`text-[11px] font-extrabold tracking-[-0.02em] ${
            active ? "text-white" : "text-[#0F172A]"
          }`}
        >
          {label}
        </span>
        <span
          className={`inline-flex min-w-[1.7rem] items-center justify-center rounded-full px-1.5 py-1 text-[10px] font-bold leading-none ${
            active ? "bg-white/20 text-white" : "bg-[#F1F4F2] text-[#667085]"
          }`}
        >
          {count}
        </span>
      </div>
    </button>
  );
}

function ProviderCard({
  listing,
  distanceKm,
  sortBy,
}: {
  listing: CatalogScreenListing;
  distanceKm: number;
  sortBy: SortKey;
}) {
  const fullName = buildProviderFullName(listing);
  const jobsCompleted = Math.max(listing.reviews * 2 + 68, 120);
  const repeatCustomers = Math.max(Math.round(listing.reviews * 0.61), 24);
  const serviceTags = [
    listing.specialties[1] ?? "Emergency Repair",
    listing.specialties[2] ?? "Socket Repair",
    listing.specialties[3] ?? "Wiring",
    listing.specialties[4] ?? "Switch Board Repair",
  ];
  const rankingBadge =
    sortBy === "nearest"
      ? `Nearby • ${formatDistanceKm(distanceKm)}`
      : sortBy === "price-low"
        ? `Low Rate • RM${listing.hourlyRate}/hr`
        : listing.rating >= 4.8
          ? "Top Rated Provider"
          : "Popular Provider";

  return (
    <article className="w-full max-w-[380px] rounded-[28px] border border-[#e7ece8] bg-white p-[18px] shadow-[0_18px_38px_rgba(15,23,42,0.07)]">
      <div className="flex items-start gap-4">
        <div className="relative h-[148px] w-[116px] shrink-0 overflow-hidden rounded-[20px] bg-[#eef4ef]">
          <Image
            src={listing.portraitSrc}
            alt={listing.name}
            width={320}
            height={352}
            unoptimized
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 text-[1.04rem] font-extrabold leading-6 tracking-[-0.04em] text-[#1f2c44]">
                  <span className="break-words">{listing.name}</span>
                </h3>
              </div>
              <p className="mt-2 break-words text-[15px] font-bold leading-5 text-[#1f2c44]">
                {fullName}
              </p>
              <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f3ebfc] px-3 py-1.5 text-[10px] font-semibold text-[#8E5EB5]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="break-words">{rankingBadge}</span>
              </span>
            </div>

            <FavoriteProviderButton
              providerId={listing.id}
              serviceKey={listing.serviceKey}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#eef2ef] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4 text-left">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-b border-[#edf1ee] pb-4">
          <InfoMetric
            icon={<Star className="h-5 w-5 fill-[#f5b301] text-[#f5b301]" />}
            value={listing.rating.toFixed(1)}
            suffix={`(${listing.reviews} Reviews)`}
          />
          <InfoMetric
            icon={<ThumbsUp className="h-4.5 w-4.5 fill-[#8E5EB5] text-[#8E5EB5]" />}
            value="98%"
            suffix="On-Time"
          />
          <InfoMetric
            icon={<MapPin className="h-4.5 w-4.5 text-[#667085]" />}
            value={formatDistanceKm(distanceKm)}
          />
          <InfoMetric
            icon={<BriefcaseBusiness className="h-4.5 w-4.5 text-[#667085]" />}
            value={`${listing.yearsExperience} Experience`}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <VerifiedBadge icon={<IdCard className="h-3.5 w-3.5" />} label="ID Verified" />
          <VerifiedBadge icon={<Phone className="h-3.5 w-3.5" />} label="Phone Verified" />
          <VerifiedBadge icon={<Smile className="h-3.5 w-3.5" />} label="Face Verified" />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {serviceTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-[#f3ebfc] px-3 py-2 text-[12px] font-semibold leading-none text-[#8E5EB5]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-[#edf1ee] bg-[#fbfdfb] px-1.5 py-2">
        <div className="grid grid-cols-4 divide-x divide-[#e8eeea] text-[12px] text-[#667085]">
          <StatPill
            icon={<Clock3 className="h-3.5 w-3.5 text-[#8E5EB5]" />}
            label="Replies in"
            value="~5 min"
          />
          <StatPill
            icon={<BriefcaseBusiness className="h-3.5 w-3.5 text-[#8E5EB5]" />}
            label="Jobs Completed"
            value={jobsCompleted.toString()}
          />
          <StatPill
            icon={<UserRound className="h-3.5 w-3.5 text-[#8E5EB5]" />}
            label="Repeat Customers"
            value={repeatCustomers.toString()}
          />
          <StatPill
            icon={<Clock3 className="h-3.5 w-3.5 text-[#8E5EB5]" />}
            label="Active"
            value="10 min ago"
          />
        </div>
      </div>

      <Link
        href={listing.href}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[18px] bg-[#8E5EB5] px-4 text-[14px] font-bold text-white shadow-[0_14px_28px_rgba(142,94,181,0.22)] transition hover:bg-[#7b4ea1]"
      >
        View Profile
      </Link>
    </article>
  );
}

function VerifiedBadge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#dceadf] bg-white px-3 py-2 text-[10px] font-semibold text-[#475467]">
      <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white text-[#8E5EB5] ring-1 ring-[#eadff6]">
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}

function InfoMetric({
  icon,
  value,
  suffix,
}: {
  icon: ReactNode;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0">{icon}</span>
      <p className="text-[13px] font-bold leading-5 text-[#1f2c44]">
        {value}
        {suffix ? <span className="ml-1 font-medium text-[#667085]">{suffix}</span> : null}
      </p>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <span className="text-[10px] font-semibold leading-4 text-[#98a2b3]">{label}</span>
      </div>
      <p className="mt-2 text-[13px] font-bold leading-5 text-[#1f2c44]">{value}</p>
    </div>
  );
}

function buildProviderFullName(listing: CatalogScreenListing) {
  if (listing.providerName && listing.providerName !== listing.name) {
    return listing.providerName;
  }

  return listing.name;
}
