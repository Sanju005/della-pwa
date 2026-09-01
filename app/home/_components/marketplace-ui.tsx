"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import swiperLogo from "../../../Logo/Swiper.png";
import {
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CreditCard,
  CircleUserRound,
  House,
  MapPin,
  Smartphone,
  Star,
  UserRound,
  Heart,
} from "lucide-react";
import {
  BottomNav,
} from "@/app/_components/della-ui";

import { ProviderDistanceText } from "@/app/_components/provider-distance";
import { LiveLocationChip } from "@/app/_components/live-location-chip";
import {
  buildProviderDetailHref,
} from "@/lib/provider-catalog-shared";
import { loadStoredCustomerProfile } from "@/lib/profile-browser";
import { getSupabaseClient } from "@/lib/supabase";
import {
  loadCurrentLiveLocation,
  loadSavedPlaces,
  loadSelectedProviderSearchLocation,
  saveSelectedProviderSearchLocation,
  saveStoredLiveLocation,
  type StoredLiveLocation,
} from "@/lib/live-location";
import type { HomeFeedData, HomeServiceCategory } from "@/lib/home-feed";

export function MarketplaceScreen({
  greetingName,
  locationLabel,
  categories,
  popularChefProviders,
  popularElectricianProviders,
  popularMaidProviders,
  errorMessage,
}: HomeFeedData) {
  const [displayName, setDisplayName] = useState(greetingName);
  const [displayLocation, setDisplayLocation] = useState(locationLabel);
  const [greetingLabel, setGreetingLabel] = useState("Hello,");
  const [currentLocation, setCurrentLocation] = useState<StoredLiveLocation | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<StoredLiveLocation[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<"current" | string>("current");
  const availablePointsLabel = "1,250 pts";

  useEffect(() => {
    const storedProfile = loadStoredCustomerProfile();
    const client = getSupabaseClient();
    const initialCurrentLocation = loadCurrentLiveLocation();
    const initialSavedPlaces = loadSavedPlaces();
    const initialSelectedSearchLocation = loadSelectedProviderSearchLocation();

    setCurrentLocation(initialCurrentLocation);
    setSavedPlaces(initialSavedPlaces);

    void (async () => {
      let resolvedLiveProfile = false;

      if (client) {
        try {
          const session = await client.auth.getSession();
          const accessToken = session.data.session?.access_token ?? "";
          const metadata =
            session.data.session?.user.user_metadata &&
            typeof session.data.session.user.user_metadata === "object"
              ? (session.data.session.user.user_metadata as Record<string, unknown>)
              : null;
          const sessionFirstName =
            typeof metadata?.first_name === "string"
              ? metadata.first_name.trim()
              : "";

          if (sessionFirstName) {
            setDisplayName(sessionFirstName);
          }

          if (accessToken) {
            const response = await fetch("/api/profile/me", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }).catch(() => null);

            const result = response
              ? ((await response.json().catch(() => null)) as
                  | {
                      profile?: {
                        firstName?: string;
                        lastName?: string;
                        city?: string;
                        region?: string;
                      };
                    }
                  | null)
              : null;

            const liveProfile = result?.profile;
            const liveFirstName = liveProfile?.firstName?.trim() ?? "";
            const liveLastName = liveProfile?.lastName?.trim() ?? "";
            const liveDisplayName = [liveFirstName, liveLastName]
              .filter(Boolean)
              .join(" ")
              .trim();

            if (liveFirstName) {
              setDisplayName(liveFirstName);
              resolvedLiveProfile = true;
            } else if (liveDisplayName) {
              setDisplayName(liveDisplayName);
              resolvedLiveProfile = true;
            }

            const liveLocation = [liveProfile?.city, liveProfile?.region]
              .filter(Boolean)
              .join(", ")
              .trim();

            if (liveLocation) {
              setDisplayLocation(liveLocation);
              resolvedLiveProfile = true;
            }
          }
        } catch {
          // Fall back to local profile below if session lookup fails.
        }
      }

      if (storedProfile) {
        const firstName = storedProfile.firstName.trim();

        if (firstName && !resolvedLiveProfile) {
          setDisplayName(firstName);
        }

        const nextLocation = [storedProfile.city, storedProfile.region]
          .filter(Boolean)
          .join(", ")
          .trim();

        if (nextLocation && !resolvedLiveProfile) {
          setDisplayLocation(nextLocation);
        }
      }

      if (initialSelectedSearchLocation) {
        const matchedSavedPlace = initialSavedPlaces.find(
          (place) => place.id === initialSelectedSearchLocation.id
        );

        if (matchedSavedPlace?.id) {
          setSelectedPlaceId(matchedSavedPlace.id);
          setDisplayLocation(
            matchedSavedPlace.formattedAddress?.trim() || matchedSavedPlace.label
          );
          saveStoredLiveLocation(matchedSavedPlace);
          return;
        }

        setDisplayLocation(
          initialSelectedSearchLocation.formattedAddress?.trim() ||
            initialSelectedSearchLocation.label
        );
        return;
      }

      if (initialCurrentLocation) {
        setDisplayLocation(
          initialCurrentLocation.formattedAddress?.trim() ||
            initialCurrentLocation.label
        );
      }
    })();

    setGreetingLabel(timePrefix());
  }, []);

  useEffect(() => {
    if (selectedPlaceId === "current") {
      if (!currentLocation) {
        return;
      }

      setDisplayLocation(
        currentLocation.formattedAddress?.trim() || currentLocation.label
      );
      saveSelectedProviderSearchLocation(currentLocation);
      return;
    }

    const selectedSavedPlace = savedPlaces.find(
      (place) => place.id === selectedPlaceId
    );

    if (!selectedSavedPlace) {
      return;
    }

    setDisplayLocation(
      selectedSavedPlace.formattedAddress?.trim() || selectedSavedPlace.label
    );
    saveStoredLiveLocation(selectedSavedPlace);
    saveSelectedProviderSearchLocation(selectedSavedPlace);
  }, [currentLocation, savedPlaces, selectedPlaceId]);

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#fbf8ff]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[linear-gradient(180deg,#ffffff_0%,#fbf8fe_100%)] px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="relative min-h-[100dvh] bg-transparent py-4 pb-28">
          <div className="pointer-events-none absolute right-[-12%] top-[-2%] h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(142,94,181,0.22),_transparent_68%)]" />

          <header className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Image
                  src={swiperLogo}
                  alt="Swiper"
                  priority
                  className="h-auto w-[132px]"
                />
                <h1 className="mt-7 text-[26px] font-normal leading-[1.2] tracking-[-0.03em] text-[#0F172A]">
                  <span className="block">{greetingLabel}</span>
                  <span className="mt-1 inline-flex items-center gap-1">
                    {displayName} <span aria-hidden>👋</span>
                  </span>
                </h1>
                <div className="mt-3">
                  {savedPlaces.length > 0 ? (
                    <label className="mb-2 block">
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6b7280]">
                        Search by location
                      </span>
                      <span className="relative block">
                        <select
                          value={selectedPlaceId}
                          onChange={(event) => setSelectedPlaceId(event.target.value)}
                          className="h-12 w-full appearance-none rounded-[16px] border border-[#e3ebe6] bg-white px-4 pr-10 text-[14px] font-medium text-[#0F172A] shadow-[0_6px_18px_rgba(15,23,42,0.04)] outline-none"
                        >
                          <option value="current">Current location</option>
                          {savedPlaces.map((place) => (
                            <option key={place.id} value={place.id}>
                              {place.addressLabel || "Saved location"} - {place.label}
                            </option>
                          ))}
                        </select>
                        <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-[#667085]" />
                      </span>
                    </label>
                  ) : null}
                  <LiveLocationChip
                    fallbackLabel={displayLocation}
                    displayLabel={displayLocation}
                    titleLabel={selectedPlaceId === "current" ? "Current location" : "Saved location"}
                    mode={selectedPlaceId === "current" ? "current" : "saved"}
                    onLocationChange={(location) => {
                      if (selectedPlaceId === "current") {
                        setCurrentLocation(location);
                      }

                      setDisplayLocation(
                        location.formattedAddress?.trim() || location.label
                      );
                      saveSelectedProviderSearchLocation(location);
                    }}
                  />
                </div>
              </div>

              <Link
                href="/profile"
                aria-label="Profile"
                className="mobile-pressable relative mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#edf0f3] bg-white text-[#0F172A] shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
              >
                <CircleUserRound className="h-7 w-7 stroke-[2.1]" />
              </Link>
            </div>
          </header>

          <section className="mt-7 rounded-[18px] border border-[#E8EEE9] bg-white px-3 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
            <div className="grid grid-cols-4 gap-y-4">
              {categories.map((category) => (
                <CategoryItem key={category.key} category={category} />
              ))}
            </div>
          </section>

          <Link
            href="/profile/rewards"
            className="mobile-pressable relative mt-4 block overflow-hidden rounded-[18px] border border-[#efe5ff] bg-[radial-gradient(circle_at_top_right,_rgba(176,108,255,0.24),_transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8f2ff_42%,#eedfff_100%)] px-4 py-4 shadow-[0_10px_24px_rgba(124,58,237,0.08)]"
          >
            <span className="pointer-events-none absolute -right-14 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(196,153,255,0.34),_transparent_68%)]" />
            <span className="pointer-events-none absolute -bottom-9 right-0 h-24 w-40 rounded-full bg-[radial-gradient(circle,_rgba(206,178,255,0.26),_transparent_70%)]" />
            <span className="pointer-events-none absolute bottom-4 right-5 h-12 w-20 opacity-35 [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:8px_8px]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex rounded-full bg-[#ede3ff] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6d3fe0]">
                  Finance
                </p>
                <h2 className="mt-3 text-[0.9rem] font-medium tracking-[-0.03em] text-[#141b5f]">
                  Available Points
                </h2>
                <p className="mt-2.5 flex items-end gap-1 tracking-[-0.05em] text-[#7c3aed]">
                  <span className="text-[2.4rem] font-semibold leading-none">1,250</span>
                  <span className="pb-1 text-[1.15rem] font-medium leading-none">pts</span>
                </p>
                <p className="mt-3 flex items-center gap-2 text-[10px] font-normal text-[#4b5563] min-[390px]:text-[11px]">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#efe7ff] text-[#7c3aed]">
                    <Star className="h-3 w-3 stroke-[1.8]" />
                  </span>
                  <span>Tap to view rewards and redeem options.</span>
                </p>
              </div>
              <span className="inline-flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[18px] border border-white/70 bg-[linear-gradient(180deg,#8b5cf6_0%,#4f1fd3_100%)] text-white shadow-[0_10px_20px_rgba(109,63,224,0.18)]">
                <CreditCard className="h-6 w-6 stroke-[1.8]" />
              </span>
            </div>
          </Link>

          {errorMessage ? (
            <div className="mt-6 rounded-[18px] border border-[#F3C7C7] bg-[#FFF4F4] px-4 py-3 text-[13px] font-semibold text-[#B42318]">
              {errorMessage}
            </div>
          ) : null}

          <ProviderSliderSection
            title="Popular chef nearby you"
            href="/providers?service=chef"
            providers={popularChefProviders}
          />

          <ProviderSliderSection
            title="Popular electrician nearby you"
            href="/providers?service=electrician"
            providers={popularElectricianProviders}
          />

          <ProviderSliderSection
            title="Popular maids nearby you"
            href="/providers?service=maid"
            providers={popularMaidProviders}
          />

          <BottomNav
            items={[
              {
                href: "/home",
                label: "Home",
                active: true,
                icon: <House className="h-5 w-5 stroke-[1.9]" />,
              },
              {
                href: "/profile/bookings",
                label: "Task",
                icon: <BookOpen className="h-5 w-5 stroke-[1.9]" />,
              },
              {
                href: "/profile/favourites",
                label: "Favourite",
                icon: <Heart className="h-5 w-5 stroke-[1.9]" />,
              },
              {
                href: "/profile/bookings?tab=ongoing",
                label: "On Going",
                icon: <BriefcaseBusiness className="h-5 w-5 stroke-[1.9]" />,
              },
            ]}
          />
        </div>
      </div>
    </main>
  );
}

function ProviderSliderSection({
  title,
  href,
  providers,
}: {
  title: string;
  href: string;
  providers: HomeFeedData["popularProviders"];
}) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#0F172A]">
          {title}
        </h2>
        <Link href={href} className="mobile-pressable text-[14px] font-medium text-[#8E5EB5]">
          See all
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex gap-3">
          {providers.map((provider) => (
            <div
              key={`${title}-${provider.id}`}
              className="w-[calc(100vw-4.8rem)] max-w-[16rem] shrink-0"
            >
              <PopularProviderCard
                href={buildProviderDetailHref({
                  id: provider.id,
                  serviceKey: provider.serviceKey,
                })}
                name={provider.name}
                fullName={provider.fullName}
                priceLabel={provider.priceLabel}
                rating={provider.rating.toFixed(1)}
                reviews={`${provider.reviews} reviews`}
                distanceKm={provider.distanceKm}
                portraitSrc={provider.portraitSrc}
                phoneVerified={provider.phoneVerified}
                identityVerified={provider.identityVerified}
              />
            </div>
          ))}
          <div className="w-[calc(100vw-4.8rem)] max-w-[16rem] shrink-0">
            <ShowAllProvidersCard href={href} title={title} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PopularProviderCard({
  href,
  name,
  fullName,
  priceLabel,
  rating,
  reviews,
  distanceKm,
  portraitSrc,
  phoneVerified,
  identityVerified,
}: {
  href: string;
  name: string;
  fullName: string;
  priceLabel: string;
  rating: string;
  reviews: string;
  distanceKm: number | null;
  portraitSrc: string;
  phoneVerified: boolean;
  identityVerified: boolean;
}) {
  return (
    <Link
      href={href}
      className="mobile-pressable mx-auto block w-full max-w-[312px] rounded-[18px] border border-[#eef2ef] bg-white p-3.5 text-left shadow-[0_8px_22px_rgba(15,23,42,0.05)]"
    >
      <div className="relative h-[156px] overflow-hidden rounded-[14px] bg-[#eef4ef]">
        <Image
          src={portraitSrc}
          alt={name}
          fill
          sizes="(max-width: 430px) calc(100vw - 64px), 272px"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="pt-4">
        <h3 className="text-[1.12rem] font-semibold leading-none tracking-[-0.035em] text-[#162544]">
          {name}
        </h3>

        <p className="mt-1.5 text-[0.76rem] text-[#1f2c44]">{fullName}</p>

        <div className="mt-2 flex items-center gap-2.5 text-[#667085]">
          <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-[#1f2c44]">
            <Star className="h-5 w-5 fill-[#f5b301] text-[#f5b301]" />
            <span>{rating}</span>
          </span>
          <span className="h-5 w-px bg-[#e4e7ec]" />
          <span className="text-[0.72rem] font-medium">{reviews}</span>
        </div>

        <div className="mt-2.5 flex flex-nowrap gap-1 overflow-hidden">
          <LiveProviderBadge
            icon={<CreditCard className="h-3.5 w-3.5" />}
            label={identityVerified ? "ID Verified" : "ID Pending"}
            verified={identityVerified}
          />
          <LiveProviderBadge
            icon={<Smartphone className="h-3.5 w-3.5" />}
            label={phoneVerified ? "Phone Verified" : "Phone Pending"}
            verified={phoneVerified}
          />
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[#e8eeea] pt-3">
          <p className="text-[1.08rem] font-medium leading-none tracking-[-0.01em] text-[#8E5EB5]">
            {priceLabel}
          </p>
          <div className="flex items-center gap-2 text-[0.8rem] font-medium text-[#1f2c44]">
            <MapPin className="h-5.5 w-5.5 text-[#667085]" />
            <span>
              <ProviderDistanceText distanceKm={distanceKm} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ShowAllProvidersCard({
  href,
  title,
}: {
  href: string;
  title: string;
}) {
  const label = title
    .replace(/^Popular\s+/i, "")
    .replace(/\s+nearby you$/i, "")
    .trim();

  return (
    <Link
      href={href}
      className="mobile-pressable flex h-full min-h-[23rem] w-full flex-col justify-between rounded-[18px] border border-dashed border-[#dcccf0] bg-[linear-gradient(180deg,#fcf8ff_0%,#f7efff_100%)] p-4 text-center shadow-[0_8px_22px_rgba(15,23,42,0.05)]"
    >
      <div className="flex flex-col items-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(180deg,#8E5EB5_0%,#7247ac_100%)] text-white shadow-[0_10px_22px_rgba(142,94,181,0.16)]">
          <ChevronRight className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-[1.08rem] font-semibold leading-tight tracking-[-0.03em] text-[#162544]">
          Show All
        </h3>
        <p className="mt-2 max-w-[15rem] text-[0.9rem] leading-6 text-[#667085]">
          See all {label} nearby and explore more provider options.
        </p>
      </div>

      <div className="rounded-[16px] border border-[#e4d7f5] bg-white/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.82rem] font-medium text-[#8E5EB5]">
            Open full list
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4ebfc] text-[#8E5EB5]">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ProviderBadge({
  icon,
  label,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#d8ebdf] bg-[#fbfefc] px-2 py-1.5 text-[8px] font-medium text-[#344054]">
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[#16a34a] ring-1 ring-[#dbeee2]">
        {icon}
      </span>
      {accent ? (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#16a34a] text-white">
          <span className="text-[8px] font-bold">✓</span>
        </span>
      ) : null}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

function LiveProviderBadge({
  icon,
  label,
  verified,
}: {
  icon: React.ReactNode;
  label: string;
  verified: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[8px] font-medium ${
        verified
          ? "border border-[#d8ebdf] bg-[#fbfefc] text-[#138a36]"
          : "border border-[#e4d7f5] bg-white text-[#667085]"
      }`}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full ${
          verified
            ? "bg-white text-[#16a34a] ring-1 ring-[#dbeee2]"
            : "bg-white text-[#8E5EB5] ring-1 ring-[#eadff6]"
        }`}
      >
        {icon}
      </span>
      {verified ? (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#16a34a] text-white">
          <Check className="h-2.5 w-2.5 stroke-[2.8]" />
        </span>
      ) : null}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

function CategoryItem({ category }: { category: HomeServiceCategory }) {
  return (
    <Link
      href={`/providers?service=${category.key}`}
      className="mobile-pressable flex flex-col items-center rounded-[14px] px-1 py-1 text-center"
    >
      <div className="flex h-[4rem] w-[4rem] items-center justify-center rounded-[16px] border border-[#eee5f7] bg-white">
        <CategoryIcon kind={category.key} />
      </div>
      <p className="mt-2 text-[12px] font-medium tracking-[-0.01em] text-[#0F172A]">
        {category.label}
      </p>
    </Link>
  );
}

function CategoryIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "chef":
      return (
        <Image
          src="/service-icons/chef-new.png"
          alt="Chef"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    case "maid":
      return (
        <Image
          src="/service-icons/maid-01.png"
          alt="Maid"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    case "babysitter":
      return (
        <Image
          src="/service-icons/baby-01.png"
          alt="Babysitter"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    case "driver":
      return (
        <Image
          src="/service-icons/driver-01.png"
          alt="Driver"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    case "cleaner":
      return (
        <Image
          src="/service-icons/cleaner-01.png"
          alt="Cleaner"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    case "tutor":
      return (
        <Image
          src="/service-icons/tutor-01.png"
          alt="Tutor"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    case "plumber":
      return (
        <Image
          src="/service-icons/plumber-01.png"
          alt="Plumber"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    case "electrician":
      return (
        <Image
          src="/service-icons/electrician-01.png"
          alt="Electrician"
          className="h-[4.7rem] w-[4.7rem] object-contain"
          width={76}
          height={76}
        />
      );
    default:
      return <UserRound className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
  }
}

function timePrefix() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning,";
  }

  if (hour < 18) {
    return "Good afternoon,";
  }

  return "Good evening,";
}
