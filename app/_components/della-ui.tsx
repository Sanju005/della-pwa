"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  MapPin,
  MessageCircleMore,
  Smartphone,
  Star,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
type StatusTone = "pending" | "accepted" | "declined" | "completed" | "cancelled" | "info";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function MobilePage({
  children,
  className,
  fullWidth = false,
}: {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(166,121,207,0.22),transparent_30%),linear-gradient(180deg,#fcfbff_0%,#f7f2fb_100%)]">
      <div
        className={cx(
          "mx-auto min-h-[100dvh] w-full bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          fullWidth ? "max-w-[430px] px-4 sm:max-w-[440px]" : "max-w-[430px] px-4"
        )}
      >
        <div className={cx("min-h-[100dvh] py-4", className)}>{children}</div>
      </div>
    </main>
  );
}

export function AppCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "bg-transparent p-4",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="mobile-pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ece4f6] bg-[#faf7fd] text-[#8E5EB5]"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-[1.38rem] font-semibold leading-tight tracking-[-0.04em] text-[#0f172a] sm:text-[1.5rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[13px] leading-5 text-[#64748b] sm:text-[14px]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#0f172a]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] leading-5 text-[#64748b]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AppButton({
  children,
  className,
  disabled,
  href,
  icon,
  onClick,
  tone = "primary",
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
  tone?: ButtonTone;
  type?: "button" | "submit";
}) {
  const classes = cx(
    "mobile-pressable inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-center text-[14px] font-medium leading-tight whitespace-normal transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[3.125rem] sm:px-5 sm:text-[15px]",
    tone === "primary" &&
      "bg-[#8E5EB5] text-white shadow-[0_10px_24px_rgba(142,94,181,0.18)] hover:bg-[#7B4EA1]",
    tone === "secondary" &&
      "border border-[#dce7df] bg-white text-[#0f172a] shadow-[0_6px_18px_rgba(15,23,42,0.04)] hover:bg-[#f8fbf9]",
    tone === "ghost" && "bg-[#f5f1fa] text-[#8E5EB5] hover:bg-[#ede4f6]",
    tone === "danger" && "bg-[#fff1f1] text-[#dc2626] hover:bg-[#ffe4e6]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {icon}
      {children}
    </button>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        tone === "pending" && "bg-[#fff7e8] text-[#b45309] ring-[#fcd34d]",
        tone === "accepted" && "bg-[#f5f1fa] text-[#8E5EB5] ring-[#d7c1eb]",
        tone === "declined" && "bg-[#fff1f2] text-[#dc2626] ring-[#fecdd3]",
        tone === "completed" && "bg-[#ecfeff] text-[#0f766e] ring-[#99f6e4]",
        tone === "cancelled" && "bg-[#eef2f7] text-[#475569] ring-[#d6dde6]",
        tone === "info" && "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]"
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f1fa] text-[#8E5EB5]">
        {icon ?? <Bell className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-[#0f172a]">{title}</h3>
      <p className="mx-auto mt-2 max-w-[18rem] text-[14px] leading-6 text-[#64748b]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  title = "Loading",
  description = "Please wait while we prepare this screen.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#8E5EB5]" />
      <h3 className="mt-4 text-[16px] font-semibold text-[#0f172a]">{title}</h3>
      <p className="mt-2 text-[14px] leading-6 text-[#64748b]">{description}</p>
    </div>
  );
}

export function ProviderCard({
  href,
  name,
  service,
  priceLabel,
  rating,
  reviews,
  distanceLabel,
  portraitSrc,
  badge,
  subtitle,
}: {
  href: string;
  name: string;
  service: string;
  priceLabel: string;
  rating: string;
  reviews: string;
  distanceLabel: string;
  portraitSrc: string;
  badge?: ReactNode;
  subtitle?: string;
}) {
  return (
    <AppCard className="overflow-hidden p-0">
      <div className="relative h-40 bg-[#eef4ef]">
        <Image
          src={portraitSrc}
          alt={name}
          fill
          sizes="(max-width: 430px) 100vw, 320px"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f172a]/55 to-transparent" />
        {badge ? <div className="absolute left-3 top-3">{badge}</div> : null}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold text-[#0f172a]">{name}</h3>
            <p className="mt-1 text-[14px] text-[#334155]">{service}</p>
            {subtitle ? (
              <p className="mt-1 text-[12px] font-medium text-[#8E5EB5]">{subtitle}</p>
            ) : null}
          </div>
          <Link
            href={href}
            className="mobile-pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8E5EB5] text-white shadow-[0_10px_24px_rgba(142,94,181,0.18)]"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-[#475569]">
          <span className="font-semibold text-[#0f172a]">⭐ {rating}</span>
          <span>{reviews}</span>
          <span>{distanceLabel}</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#e8eeea] pt-4">
          <div>
            <p className="text-[12px] text-[#64748b]">From</p>
            <p className="text-[18px] font-semibold text-[#8E5EB5]">{priceLabel}</p>
          </div>
          <AppButton href={href}>View Profile</AppButton>
        </div>
      </div>
    </AppCard>
  );
}

export function BookingCard({
  title,
  provider,
  schedule,
  location,
  statusLabel,
  statusTone,
  image,
  primaryAction,
  secondaryAction,
  notes,
}: {
  title: string;
  provider: string;
  schedule: string;
  location?: string;
  statusLabel: string;
  statusTone: StatusTone;
  image?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  notes?: ReactNode;
}) {
  return (
    <AppCard>
      <div className="flex gap-3">
        <div className="flex h-[4.8rem] w-[4.8rem] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#f5f1fa]">
          {image ?? <CalendarDays className="h-8 w-8 text-[#8E5EB5]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-[#0f172a]">{title}</h3>
              <p className="mt-1 text-[14px] text-[#475569]">{provider}</p>
            </div>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </div>
          <div className="mt-3 space-y-2 text-[13px] text-[#475569]">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#8E5EB5]" />
              <span>{schedule}</span>
            </div>
            {location ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#8E5EB5]" />
                <span>{location}</span>
              </div>
            ) : null}
          </div>
          {notes ? <div className="mt-3">{notes}</div> : null}
          {primaryAction || secondaryAction ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {secondaryAction}
              {primaryAction}
            </div>
          ) : null}
        </div>
      </div>
    </AppCard>
  );
}

export function PremiumProviderCard({
  href,
  name,
  fullName,
  priceLabel,
  rating,
  reviews,
  distanceLabel,
  portraitSrc,
}: {
  href: string;
  name: string;
  fullName?: string;
  priceLabel: string;
  rating: string;
  reviews: string;
  distanceLabel: string;
  portraitSrc: string;
}) {
  return (
    <AppCard className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[28px] border-[#eef2ef] bg-white p-0 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
      <div className="relative mx-6 mt-6 h-[260px] overflow-hidden rounded-[16px] bg-[#eef4ef]">
        <Image
          src={portraitSrc}
          alt={name}
          fill
          sizes="(max-width: 430px) calc(100vw - 64px), 340px"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="px-6 pb-6 pt-6 text-left">
        <div className="min-w-0">
          <h3 className="truncate text-[2.3rem] font-semibold leading-none tracking-[-0.06em] text-[#162544]">
            {name}
          </h3>
          <p className="mt-7 text-[14px] font-medium text-[#667085]">Full name</p>
          <p className="mt-3 truncate text-[1.05rem] font-semibold text-[#1f2c44]">
            {fullName ?? name}
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <VerificationPill
            icon={<CreditCard className="h-4 w-4" />}
            label="ID Verified"
            accent
          />
          <VerificationPill
            icon={<Smartphone className="h-4 w-4" />}
            label="Phone Verified"
          />
        </div>

        <div className="mt-8 border-t border-[#e9eeea] pt-6">
          <div className="flex items-center gap-5 text-[14px] text-[#667085]">
            <span className="inline-flex items-center gap-3 font-semibold text-[#1f2c44]">
              <Star className="h-10 w-10 fill-[#f5b301] text-[#f5b301]" />
              {rating}
            </span>
            <span className="h-10 w-px bg-[#e4e7ec]" />
            <span className="text-[1rem] font-medium text-[#667085]">{reviews}</span>
          </div>
          <div className="mt-6 flex items-center gap-3 text-[1rem] font-semibold text-[#1f2c44]">
            <MapPin className="h-8 w-8 text-[#667085]" />
            <span>{distanceLabel}</span>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4 border-t border-[#e9eeea] pt-6">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[#667085]">From</p>
            <p className="mt-2 text-[2.2rem] font-semibold leading-none tracking-[-0.05em] text-[#16a34a]">
              {priceLabel}
            </p>
          </div>
          <Link
            href={href}
            className="inline-flex h-[4.6rem] min-w-[13rem] shrink-0 items-center justify-center gap-3 rounded-[18px] bg-[linear-gradient(180deg,#edf8f0_0%,#e8f6ed_100%)] px-7 text-[1rem] font-bold text-[#169647]"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#cfe9d7] bg-white/80 text-[#169647]">
              <UserRound className="h-5 w-5" />
            </span>
            <span>View Profile</span>
          </Link>
        </div>
      </div>
    </AppCard>
  );
}

function VerificationPill({
  icon,
  label,
  accent = false,
}: {
  icon: ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-3 rounded-full border border-[#d8ebdf] bg-[#fbfefc] px-4 py-3 text-[12px] font-medium text-[#344054]">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#16a34a] ring-1 ring-[#dbeee2]">
        {icon}
      </span>
      {accent ? (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#16a34a] text-white">
          <span className="text-[11px] font-bold">✓</span>
        </span>
      ) : null}
      {label}
    </span>
  );
}

export function BottomNav({
  items,
}: {
  items: Array<{
    href: string;
    label: string;
    icon: ReactNode;
    active?: boolean;
    hardNavigate?: boolean;
  }>;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
      <div className="bg-white/95 px-2 py-1.5">
        <div className="flex items-center justify-between gap-1 text-[10.5px] font-medium text-[#8a94a6]">
        {items.map((item) => {
          const navClassName = cx(
            "mobile-pressable flex min-w-[3.1rem] flex-1 flex-col items-center gap-1 rounded-[14px] px-1 py-2",
            item.active ? "text-[#16a34a]" : "text-[#8a94a6]"
          );
          const indicator = (
            <span className="flex h-2.5 items-end">
              <span
                className={cx(
                  "rounded-full transition-all",
                  item.active ? "h-[3px] w-8 bg-[#16a34a]" : "h-[3px] w-5 bg-transparent"
                )}
              />
            </span>
          );

          if (item.hardNavigate) {
            return (
              <a key={item.href} href={item.href} className={navClassName}>
                {item.icon}
                <span>{item.label}</span>
                {indicator}
              </a>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={navClassName}>
              {item.icon}
              <span>{item.label}</span>
              {indicator}
            </Link>
          );
        })}
        </div>
      </div>
    </nav>
  );
}

export function AuthInfoPanel({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <AppCard className="px-6 py-7">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f7ea] text-[#16a34a]">
          {icon}
        </div>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#16a34a]">
            DELLA
          </p>
          <h1 className="text-[28px] font-semibold text-[#0f172a]">{title}</h1>
        </div>
      </div>
      <p className="mt-5 text-[15px] leading-7 text-[#64748b]">{description}</p>
    </AppCard>
  );
}

export function FeaturePill({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[#e8f7ea] px-4 py-2 text-[13px] font-bold text-[#15803d]">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function MessagePlaceholderCard() {
  return (
    <EmptyState
      title="Messages are coming next"
      description="Your booking conversations will appear here as soon as provider messaging is connected."
      icon={<MessageCircleMore className="h-6 w-6" />}
      action={
        <AppButton href="/profile/bookings" tone="secondary">
          View Bookings
        </AppButton>
      }
    />
  );
}

export function SecureNotice() {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-[#64748b]">
      <ShieldCheck className="h-4 w-4 text-[#16a34a]" />
      <span>Secure marketplace experience powered by DELLA</span>
    </div>
  );
}
