"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import swiperLogo from "../../../Logo/Swiper.png";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  CreditCard,
  CircleUserRound,
  CookingPot,
  House,
  MapPin,
  MessageCircleMore,
  Smartphone,
  Star,
  SprayCan,
  UserRound,
  User,
  Wrench,
  Baby,
  CarFront,
  Bolt,
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
import { getSupabaseClient } from "@/lib/supabase";
import type { HomeFeedData, HomeServiceCategory } from "@/lib/home-feed";
import type { CustomerProfile } from "@/lib/profile-types";

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
  const availablePointsLabel = "1,250 pts";

  useEffect(() => {
    let active = true;

    async function hydrateViewerProfile() {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!active || !session) {
        return;
      }

      const response = await fetch("/api/profile/me", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as
        | {
            profile: CustomerProfile;
          }
        | { error?: string };

      if (!active || !response.ok || !("profile" in result)) {
        return;
      }

      const fullName = [result.profile.firstName, result.profile.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (fullName) {
        setDisplayName(fullName);
      }

      const nextLocation = [result.profile.city, result.profile.region]
        .filter(Boolean)
        .join(", ")
        .trim();

      if (nextLocation) {
        setDisplayLocation(nextLocation);
      }
    }

    void hydrateViewerProfile();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#fbf8ff]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[linear-gradient(180deg,#ffffff_0%,#fbf8fe_100%)] px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="relative min-h-[100dvh] bg-transparent py-5 pb-28">
          <div className="pointer-events-none absolute right-[-12%] top-[-2%] h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(142,94,181,0.22),_transparent_68%)]" />

          <header className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Image
                  src={swiperLogo}
                  alt="Swiper"
                  priority
                  className="h-auto w-[148px]"
                />
                <h1 className="mt-7 text-[28px] font-extrabold leading-[1.12] tracking-[-0.05em] text-[#0F172A]">
                  {timePrefix()}{" "}
                  <span className="inline-flex items-center gap-1">
                    {displayName} <span aria-hidden>👋</span>
                  </span>
                </h1>
                <div className="mt-3">
                  <LiveLocationChip fallbackLabel={displayLocation} />
                </div>
              </div>

              <button
                type="button"
                aria-label="Notifications"
                className="relative mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0F172A]"
              >
                <Bell className="h-7 w-7 stroke-[2.2]" />
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#8E5EB5]" />
              </button>
            </div>
          </header>

          <section className="mt-8 rounded-[26px] border border-[#E8EEE9] bg-white px-4 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-4 gap-y-6">
              {categories.map((category) => (
                <CategoryItem key={category.key} category={category} />
              ))}
            </div>
          </section>

          <Link
            href="/profile/rewards"
            className="mt-6 block rounded-[24px] border border-[#eadff8] bg-[linear-gradient(135deg,#ffffff_0%,#f8f1ff_100%)] p-4 shadow-[0_14px_32px_rgba(106,69,160,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
                  Finance
                </p>
                <h2 className="mt-2 text-[1.05rem] font-bold tracking-[-0.03em] text-[#0F172A]">
                  Available Points
                </h2>
                <p className="mt-2 text-[1.7rem] font-black tracking-[-0.05em] text-[#8E5EB5]">
                  {availablePointsLabel}
                </p>
                <p className="mt-1 text-[12px] text-[#6b7280]">
                  Tap to view rewards and redeem options.
                </p>
              </div>
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(180deg,#8E5EB5_0%,#7247ac_100%)] text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]">
                <CreditCard className="h-6 w-6 stroke-[2]" />
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
                label: "Bookings",
                icon: <BookOpen className="h-5 w-5 stroke-[1.9]" />,
              },
              {
                href: "/profile/messages",
                label: "Messages",
                icon: <MessageCircleMore className="h-5 w-5 stroke-[1.9]" />,
              },
              {
                href: "/profile/favourites",
                label: "Favourite",
                icon: <Heart className="h-5 w-5 stroke-[1.9]" />,
              },
              {
                href: "/profile",
                label: "Profile",
                icon: <CircleUserRound className="h-5 w-5 stroke-[1.9]" />,
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
    <section className="mt-7">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[18px] font-extrabold tracking-[-0.04em] text-[#0F172A]">
          {title}
        </h2>
        <Link href={href} className="text-[14px] font-extrabold text-[#8E5EB5]">
          See all
        </Link>
      </div>

      <div className="-mx-5 overflow-x-auto px-5 pb-2">
        <div className="flex gap-4">
          {providers.map((provider) => (
            <div
              key={`${title}-${provider.id}`}
              className="w-[calc(100vw-5.5rem)] max-w-[17rem] shrink-0"
            >
              <PopularProviderCard
                href={buildProviderDetailHref({
                  id: provider.id,
                  serviceKey: provider.serviceKey,
                })}
                name={provider.name}
                fullName={provider.name}
                priceLabel={provider.priceLabel}
                rating={provider.rating.toFixed(1)}
                reviews={`${provider.reviews} reviews`}
                distanceKm={provider.distanceKm}
                providerLatitude={provider.providerLatitude}
                providerLongitude={provider.providerLongitude}
                portraitSrc={provider.portraitSrc}
              />
            </div>
          ))}
          <div className="w-[calc(100vw-5.5rem)] max-w-[17rem] shrink-0">
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
  providerLatitude,
  providerLongitude,
  portraitSrc,
}: {
  href: string;
  name: string;
  fullName: string;
  priceLabel: string;
  rating: string;
  reviews: string;
  distanceKm: number;
  providerLatitude: number | null;
  providerLongitude: number | null;
  portraitSrc: string;
}) {
  return (
    <article className="mx-auto w-full max-w-[312px] rounded-[22px] border border-[#eef2ef] bg-white p-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.07)]">
      <div className="relative h-[168px] overflow-hidden rounded-[14px] bg-[#eef4ef]">
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
        <h3 className="text-[1.28rem] font-semibold leading-none tracking-[-0.045em] text-[#162544]">
          {name}
        </h3>

        <p className="mt-2 text-[0.78rem] font-medium text-[#1f2c44]">{fullName}</p>

        <div className="mt-2 flex items-center gap-2.5 text-[#667085]">
          <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-[#1f2c44]">
            <Star className="h-5 w-5 fill-[#f5b301] text-[#f5b301]" />
            <span>{rating}</span>
          </span>
          <span className="h-5 w-px bg-[#e4e7ec]" />
          <span className="text-[0.72rem] font-medium">{reviews}</span>
        </div>

        <div className="mt-2.5 flex flex-nowrap gap-1 overflow-hidden">
          <ProviderBadge
            icon={<CreditCard className="h-3.5 w-3.5" />}
            label="ID Verified"
            accent
          />
          <ProviderBadge
            icon={<Smartphone className="h-3.5 w-3.5" />}
            label="Phone Verified"
          />
        </div>

        <div className="mt-3 border-t border-[#e8eeea] pt-3">
          <div className="flex items-center gap-2 text-[0.8rem] font-semibold text-[#1f2c44]">
            <MapPin className="h-5.5 w-5.5 text-[#667085]" />
            <span>
              <ProviderDistanceText
                providerLatitude={providerLatitude}
                providerLongitude={providerLongitude}
                fallbackDistanceKm={distanceKm}
              />
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-2 border-t border-[#e8eeea] pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-[#667085]">From</p>
            <p className="mt-1 text-[1.08rem] font-medium leading-none tracking-[-0.01em] text-[#8E5EB5]">
              {priceLabel}
            </p>
          </div>

          <Link
            href={href}
            className="inline-flex h-[2.7rem] min-w-[7.1rem] shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-[linear-gradient(180deg,#f3ebfc_0%,#ebdef9_100%)] px-3 text-[0.68rem] font-semibold text-[#8E5EB5]"
          >
            <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full border border-[#dbc8ed] bg-white/85 text-[#8E5EB5]">
              <User className="h-3 w-3" />
            </span>
            <span>View Profile</span>
          </Link>
        </div>
      </div>
    </article>
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
      className="flex h-full min-h-[25.5rem] w-full flex-col justify-between rounded-[22px] border border-dashed border-[#dcccf0] bg-[linear-gradient(180deg,#fcf8ff_0%,#f7efff_100%)] p-4 text-center shadow-[0_14px_32px_rgba(15,23,42,0.06)]"
    >
      <div className="flex flex-col items-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#8E5EB5_0%,#7247ac_100%)] text-white shadow-[0_14px_28px_rgba(142,94,181,0.18)]">
          <ChevronRight className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-[1.25rem] font-bold leading-tight tracking-[-0.04em] text-[#162544]">
          Show All
        </h3>
        <p className="mt-2 max-w-[15rem] text-[0.9rem] leading-6 text-[#667085]">
          See all {label} nearby and explore more provider options.
        </p>
      </div>

      <div className="rounded-[16px] border border-[#e4d7f5] bg-white/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.82rem] font-semibold text-[#8E5EB5]">
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

function CategoryItem({ category }: { category: HomeServiceCategory }) {
  return (
    <Link
      href={`/providers?service=${category.key}`}
      className="flex flex-col items-center text-center"
    >
      <div className="flex h-[3.7rem] w-[3.7rem] items-center justify-center rounded-[18px] bg-[#f3ebfc] text-[#8E5EB5]">
        <CategoryIcon kind={category.key} />
      </div>
      <p className="mt-3 text-[13px] font-semibold tracking-[-0.02em] text-[#0F172A]">
        {category.label}
      </p>
    </Link>
  );
}

function CategoryIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "chef":
      return <CookingPot className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
    case "maid":
      return <BriefcaseBusiness className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
    case "babysitter":
      return <Baby className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
    case "driver":
      return <CarFront className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
    case "cleaner":
      return <SprayCan className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
    case "tutor":
      return <BookOpen className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
    case "plumber":
      return <Wrench className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
    case "electrician":
      return <Bolt className="h-[1.55rem] w-[1.55rem] stroke-[1.8]" />;
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
