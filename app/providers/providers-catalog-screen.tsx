"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  Clock3,
  Building2,
  Check,
  IdCard,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Star,
  StarIcon,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import { EmptyState as SharedEmptyState } from "@/app/_components/della-ui";
import { FavoriteProviderButton } from "@/app/_components/favorite-provider-button";
import {
  saveSelectedProviderSearchLocation,
  loadSavedPlaces,
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
  phoneVerified: boolean;
  identityVerified: boolean;
};

type CatalogScreenData = {
  service: ServiceKey;
  serviceLabel: string;
  bannerSrc: string;
  listings: CatalogScreenListing[];
  errorMessage: string | null;
};

const serviceIcons: Partial<Record<Exclude<ServiceKey, null>, string>> = {
  chef: "/service-icons/chef-new.png",
  maid: "/service-icons/maid-01.png",
  babysitter: "/service-icons/baby-01.png",
  driver: "/service-icons/driver-01.png",
  cleaner: "/service-icons/cleaner-01.png",
  tutor: "/service-icons/tutor-01.png",
  plumber: "/service-icons/plumber-01.png",
  electrician: "/service-icons/electrician-01.png",
};

export function ProvidersCatalogScreen({ data }: { data: CatalogScreenData }) {
  const [locationDetails, setLocationDetails] = useState<StoredLiveLocation | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StoredLiveLocation | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<StoredLiveLocation[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<"current" | string>("current");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("popular");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setCurrentLocation(loadCurrentLiveLocation());
    setSavedPlaces(loadSavedPlaces());
  }, []);

  useEffect(() => {
    if (currentLocation) {
      return;
    }

    let active = true;

    void resolveCurrentLiveLocation("Current location", { persist: "current" })
      .then((nextLocation) => {
        if (active && nextLocation) {
          setCurrentLocation(nextLocation);
          if (selectedPlaceId === "current") {
            setLocationDetails(nextLocation);
          }
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
      activeLocation &&
      typeof listing.latitude === "number" &&
      typeof listing.longitude === "number"
    ) {
      return calculateDistanceKm(
        activeLocation.latitude,
        activeLocation.longitude,
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

  const activeLocation = selectedPlaceId === "current"
    ? locationDetails ?? currentLocation
    : savedPlaces.find((place) => place.id === selectedPlaceId) ?? locationDetails ?? currentLocation;

  useEffect(() => {
    if (!activeLocation) {
      return;
    }

    saveSelectedProviderSearchLocation(activeLocation);
  }, [activeLocation]);

  const filteredListings = useMemo(() => {
    let items = data.listings.filter((listing) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "active-now" && listing.availabilityLabel === "Available Today");
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        listing.name.toLowerCase().includes(normalizedQuery) ||
        buildProviderFullName(listing).toLowerCase().includes(normalizedQuery);

      return matchesTab && matchesQuery;
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
  }, [activeTab, data.listings, sortBy, activeLocation, searchQuery]);

  const serviceIconSrc = data.service ? serviceIcons[data.service] : null;
  const serviceTitle = data.serviceLabel ? `${data.serviceLabel} Services` : "Service Providers";
  const serviceLower = (data.serviceLabel || "service").toLowerCase();
  const heroProviders = filteredListings.slice(0, 3);
  const extraProviders = Math.max(filteredListings.length - heroProviders.length, 0);
  const fullAddress =
    activeLocation?.formattedAddress ||
    activeLocation?.label ||
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
              <a
                href="/home"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/home";
                  }
                }}
                className="relative z-20 pointer-events-auto inline-flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[18px] border border-[#e3ebe6] bg-white text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.04)] [touch-action:manipulation]"
              >
                <ArrowLeft className="h-6 w-6" />
              </a>
              <label className="flex min-h-[3.25rem] flex-1 min-w-0 items-center gap-2.5 rounded-[18px] border border-[#e3ebe6] bg-white px-4 text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <Search className="h-5.5 w-5.5 shrink-0 text-[#667085]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search provider name..."
                  className="w-full min-w-0 bg-transparent text-[15px] font-semibold text-[#0F172A] outline-none placeholder:text-[#667085]"
                />
              </label>
            </div>

            <div className="rounded-[28px] border border-[#edf1ee] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              {savedPlaces.length > 0 ? (
                <div className="mb-4">
                  <label className="block">
                    <span className="mb-2 block text-[12px] font-medium text-[#98A2B3]">
                      Use location
                    </span>
                    <span className="relative block">
                      <select
                        value={selectedPlaceId}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setSelectedPlaceId(nextValue);

                          if (nextValue === "current") {
                            setLocationDetails(currentLocation);
                            return;
                          }

                          const selectedPlace = savedPlaces.find((place) => place.id === nextValue);
                          if (selectedPlace) {
                            setLocationDetails(selectedPlace);
                          }
                        }}
                        className="h-11 w-full appearance-none rounded-[16px] border border-[#e3ebe6] bg-white px-4 pr-10 text-[14px] font-medium text-[#1f2c44] outline-none"
                      >
                        <option value="current">Current location</option>
                        {savedPlaces.map((place) => (
                          <option key={place.id} value={place.id}>
                            {place.addressLabel || "Saved address"} - {place.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#f3ebfc] text-[#8E5EB5]">
                  <MapPin className="h-6 w-6 fill-[#8E5EB5] text-[#8E5EB5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#98A2B3]">Location name</p>
                  <p className="mt-1 text-[16px] font-extrabold tracking-[-0.03em] text-[#1f2c44]">
                    {activeLocation?.addressLabel || "Home"}
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
            <div className="rounded-[28px] bg-white px-4 py-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#eff4f1]">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center">
                  {serviceIconSrc ? (
                    <Image
                      src={serviceIconSrc}
                      alt={data.serviceLabel || "Service"}
                      width={74}
                      height={74}
                      className="h-[4.25rem] w-[4.25rem] object-contain"
                    />
                  ) : (
                    <BriefcaseBusiness className="h-12 w-12 stroke-[1.8]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h1 className="text-[1.42rem] font-bold tracking-[-0.045em] text-[#13294b]">
                    {serviceTitle}
                  </h1>
                  <p className="mt-1 text-[13px] leading-5 text-[#667085]">
                    Find trusted and verified
                    <br />
                    {serviceLower} services near you
                  </p>
                </div>
              </div>

              <div className="mt-3.5 grid grid-cols-3 divide-x divide-[#ebf0ed] rounded-[18px] border border-[#eef3f0] bg-white">
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

              <div className="mt-3.5 flex items-center gap-2.5">
                <div className="flex items-center">
                  {heroProviders.map((listing, index) => (
                    <div
                      key={listing.id}
                      className={`relative h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_18px_rgba(15,23,42,0.08)] ${index === 0 ? "" : "-ml-2.5"}`}
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
                    <div className="-ml-2.5 inline-flex h-10 min-w-10 items-center justify-center rounded-full border-2 border-white bg-[#8E5EB5] px-2 text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(142,94,181,0.28)]">
                      +{extraProviders}
                    </div>
                  ) : null}
                </div>
                <p className="text-[14px] font-medium text-[#667085]">
                  <span className="font-semibold text-[#344054]">{filteredListings.length}</span>{" "}
                  {serviceLower} available
                </p>
              </div>
            </div>
          </section>

          <section className="mt-7 pb-1">
            <div className="grid grid-cols-3 gap-2">
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
            </div>
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
      className={`inline-flex h-10 min-w-0 w-full items-center justify-center gap-1.5 rounded-[16px] border px-2.5 text-[11px] font-semibold shadow-[0_8px_20px_rgba(15,23,42,0.04)] ${
        active
          ? "border-[#dbc8ed] bg-[#f3ebfc] text-[#8E5EB5]"
          : "border-[#e7ece8] bg-white text-[#344054]"
      }`}
    >
      <span className={active ? "text-[#8E5EB5]" : "text-[#344054]"}>{icon}</span>
      <span className="truncate">{label}</span>
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
    <article className="relative w-full max-w-[380px] rounded-[26px] border border-[#e7ece8] bg-white p-[14px] shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <div className="relative h-[116px] w-[98px] shrink-0 overflow-hidden rounded-[18px] bg-[#eef4ef]">
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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 text-[0.98rem] font-extrabold leading-5 tracking-[-0.04em] text-[#1f2c44]">
                  <span className="break-words">{listing.name}</span>
                </h3>
              </div>
              <p className="mt-1 break-words text-[13px] font-semibold leading-4.5 text-[#1f2c44]">
                {fullName}
              </p>
              <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-[#f3ebfc] px-2 py-1 text-[9px] font-semibold text-[#8E5EB5]">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span className="truncate">{rankingBadge}</span>
              </span>
            </div>

            <FavoriteProviderButton
              providerId={listing.id}
              serviceKey={listing.serviceKey}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eef2ef] bg-white shadow-[0_6px_14px_rgba(15,23,42,0.05)]"
            />
          </div>
        </div>
      </div>

      <div className="mt-3.5 space-y-3 text-left">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-[#edf1ee] pb-3">
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

        <div className="flex flex-wrap gap-1.5">
          <VerifiedBadge
            icon={<IdCard className="h-3.5 w-3.5" />}
            label={listing.identityVerified ? "ID Verified" : "ID Pending"}
            verified={listing.identityVerified}
          />
          <VerifiedBadge
            icon={<Phone className="h-3.5 w-3.5" />}
            label={listing.phoneVerified ? "Phone Verified" : "Phone Pending"}
            verified={listing.phoneVerified}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {serviceTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-[#f3ebfc] px-2.5 py-1.5 text-[10px] font-semibold leading-none text-[#8E5EB5]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-[#edf1ee] bg-[#fbfdfb] px-1 py-1.5">
        <div className="grid grid-cols-4 divide-x divide-[#e8eeea] text-[11px] text-[#667085]">
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

      <a
        href={listing.href}
        onClick={() => {
          if (typeof window !== "undefined") {
            window.location.href = listing.href;
          }
        }}
        className="relative z-20 pointer-events-auto mt-3.5 inline-flex h-11 w-full items-center justify-center rounded-[16px] bg-[#8E5EB5] px-4 text-[13px] font-bold text-white shadow-[0_12px_24px_rgba(142,94,181,0.2)] transition hover:bg-[#7b4ea1] [touch-action:manipulation]"
      >
        View Profile
      </a>
    </article>
  );
}

function VerifiedBadge({
  icon,
  label,
  verified,
}: {
  icon: ReactNode;
  label: string;
  verified: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-semibold ${
        verified
          ? "border border-[#cbe8d2] bg-[#f2fbf5] text-[#138a36]"
          : "border border-[#fde2b7] bg-[#fff8ee] text-[#d97706]"
      }`}
    >
      <span
        className={`inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full ${
          verified
            ? "bg-[#e7f8ec] text-[#16a34a] ring-1 ring-[#cbe8d2]"
            : "bg-white text-[#f59e0b] ring-1 ring-[#fde2b7]"
        }`}
      >
        {icon}
      </span>
      {verified ? (
        <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
          <Check className="h-3 w-3 stroke-[2.6]" />
        </span>
      ) : null}
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
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <p className="text-[12px] font-bold leading-4.5 text-[#1f2c44]">
        {value}
        {suffix ? <span className="ml-1 text-[11px] font-medium text-[#667085]">{suffix}</span> : null}
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
    <div className="px-1.5 py-2 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-[9px] font-semibold leading-3.5 text-[#98a2b3]">{label}</span>
      </div>
      <p className="mt-1.5 text-[12px] font-bold leading-4.5 text-[#1f2c44]">{value}</p>
    </div>
  );
}

function buildProviderFullName(listing: CatalogScreenListing) {
  if (listing.providerName && listing.providerName !== listing.name) {
    return listing.providerName;
  }

  return listing.name;
}
