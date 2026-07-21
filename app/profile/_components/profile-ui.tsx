"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppButton,
  BookingCard as SharedBookingCard,
  EmptyState as SharedEmptyState,
  StatusBadge as SharedStatusBadge,
} from "@/app/_components/della-ui";
import { BookingMessagesPanel } from "@/app/_components/booking-messages-panel";
import { ImageCropModal, cropImageFromSelection } from "@/app/_components/image-crop-modal";

import {
  isFavoriteSchemaUnavailable,
  loadStoredFavoriteProviderIds,
  saveStoredFavoriteProviderIds,
} from "@/lib/customer-favorites-browser";
import { LiveLocationChip } from "@/app/_components/live-location-chip";
import { IMAGE_UPLOAD_ACCEPT, isAcceptedImageFile } from "@/lib/image-upload";
import {
  disablePushNotifications,
  getLastPushError,
  getPushSupportDiagnostics,
  getPushSetupState,
  requestNotificationPermission,
  saveFCMToken,
  type PushSetupState,
} from "@/lib/notifications";
import { getFreshSupabaseSession, getSupabaseClient, signOutLocally } from "@/lib/supabase";
import {
  loadSavedPlaces,
  loadStoredLiveLocation,
  resolveCurrentLiveLocation,
  type StoredLiveLocation,
} from "@/lib/live-location";
import { loadStoredCustomerProfile, saveCustomerProfile } from "@/lib/profile-browser";
import { isPaymentProofMimeType, PAYMENT_PROOF_MAX_BYTES, readFileAsDataUrl as readPaymentProofAsDataUrl } from "@/lib/upload-proof";
import type {
  Address,
  Booking,
  BookingStatus,
  CustomerProfile,
  FavoriteProvider,
  NotificationItem,
  PaymentHistoryItem,
  ProfileOverviewData,
  SettingGroup,
} from "@/lib/profile-types";

function getTodayIso() {
  return new Date().toISOString().split("T")[0] ?? "";
}

function waitForClientRetry(attempt: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 350 * (attempt + 1));
  });
}

async function fetchJsonWithRetry<T>(input: RequestInfo | URL, init?: RequestInit, attempts = 3) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const result = (await response.json().catch(() => null)) as T | null;
      return { response, result };
    } catch (error) {
      lastError = error;

      if (attempt < attempts - 1) {
        await waitForClientRetry(attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to fetch");
}

type ShellProps = {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  backHref?: string;
  showBottomNav?: boolean;
};

type OverviewProps = {
  initialData: ProfileOverviewData;
};

type EditProps = {
  initialProfile: CustomerProfile;
};

type AddressesProps = {
  addresses: Address[];
};

type BookingTab = BookingStatus | "all";

type BookingsProps = {
  bookings: Booking[];
  initialTab?: BookingTab;
};

type SettingsProps = {
  groups: SettingGroup[];
};

type PaymentsProps = {
  payments: PaymentHistoryItem[];
};

type FavoritesProps = {
  providers: FavoriteProvider[];
};

type NotificationsProps = {
  initialNotifications?: NotificationItem[];
};

type BookingDetailProps = {
  booking: Booking;
};

type BookingReviewProps = {
  booking: Booking;
};

type TaskStepState = "done" | "current" | "waiting";

function isPdfProof(mimeType?: string, fileName?: string) {
  return mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
}

function isPdfDataUrl(value?: string) {
  return (value ?? "").startsWith("data:application/pdf");
}

function formatStepDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStepTime(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function StepTimelineCard({
  number,
  title,
  description,
  state,
  dateLabel,
  timeLabel,
  expanded = false,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  state: TaskStepState;
  dateLabel?: string;
  timeLabel?: string;
  expanded?: boolean;
  children?: React.ReactNode;
}) {
  const done = state === "done";
  const current = state === "current";

  return (
    <div className="relative flex gap-3 sm:gap-4">
      <div className="flex w-10 shrink-0 flex-col items-center sm:w-14">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-4 text-base font-black sm:h-12 sm:w-12 sm:text-lg ${
            done || current
              ? "border-[#8E5EB5] bg-[#8E5EB5] text-white"
              : "border-[#e5e7eb] bg-white text-[#94a3b8]"
          }`}
        >
            {done ? <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" /> : number}
        </span>
        <span className={`mt-2 h-full min-h-16 w-[2px] ${done || current ? "bg-[#8E5EB5]" : "bg-[#e5e7eb]"}`} />
      </div>
      <div
        className={`min-w-0 flex-1 rounded-[22px] border p-4 shadow-[0_16px_34px_rgba(106,69,160,0.08)] sm:rounded-[24px] sm:p-5 ${
          current
            ? "border-[#dcc7f7] bg-[linear-gradient(180deg,#fcf7ff_0%,#fffefe_100%)]"
            : "border-[#ebe2f8] bg-white"
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h3 className="text-[1.1rem] font-bold tracking-[-0.04em] text-[#1f1630]">
              {number}. {title}
            </h3>
            {(dateLabel || timeLabel) ? (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-[#6d6480]">
                {dateLabel ? (
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateLabel}
                  </span>
                ) : null}
                {timeLabel ? (
                  <span className="inline-flex items-center gap-2">
                    <ClockIcon className="h-4 w-4" />
                    {timeLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
            {description ? (
              <p className="mt-3 text-[13px] leading-6 text-[#6d6480]">{description}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-3 py-2 text-[11px] font-bold sm:px-4 sm:text-[12px] ${
              done
                ? "bg-[#eef9f0] text-[#16a34a]"
                : current
                  ? "bg-[#f3e8ff] text-[#8E5EB5]"
                  : "bg-[#f3f4f6] text-[#6b7280]"
            }`}
          >
            {done ? "Done" : current ? "Current Step" : "Waiting"}
          </span>
        </div>
        {expanded ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}

function PaymentProofPreview({
  title,
  dataUrl,
  fileName,
  mimeType,
}: {
  title: string;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
}) {
  if (!dataUrl) {
    return null;
  }

  return (
    <div className="mt-4 min-w-0 overflow-hidden rounded-[18px] border border-[#ebe2f8] bg-[#fcfaff] p-3 sm:p-4">
      <p className="text-[13px] font-semibold text-[#111827]">{title}</p>
      {isPdfProof(mimeType, fileName) ? (
        <div className="mt-3 break-words rounded-[14px] border border-dashed border-[#d9c7ef] bg-white px-4 py-4 text-[13px] text-[#6d6480]">
          PDF proof attached: {fileName || "Payment proof.pdf"}
        </div>
      ) : (
        <img
          src={dataUrl}
          alt={fileName || title}
          className="mt-3 h-40 w-full rounded-[14px] object-cover"
        />
      )}
      {fileName ? (
        <p className="mt-2 break-all text-[12px] text-[#6d6480]">{fileName}</p>
      ) : null}
    </div>
  );
}

export function ProfileShell({
  children,
  title,
  showBack = false,
  backHref = "/profile",
  showBottomNav = true,
}: ShellProps) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#faf7fd]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-white px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="relative min-h-[100dvh] overflow-hidden bg-white">
          <div className="bg-[linear-gradient(180deg,#8E5EB5_0%,#7A49A7_100%)] px-5 pb-4 pt-5 text-white shadow-[0_12px_28px_rgba(122,73,167,0.22)]">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showBack ? (
                  <Link
                    href={backHref}
                    aria-label="Back"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/95 ring-1 ring-white/15"
                  >
                    <ArrowLeftIcon className="h-5 w-5" />
                  </Link>
                ) : null}
                <h1 className="text-[18px] font-extrabold">{title}</h1>
              </div>
              {!showBack ? (
                <Link
                  href="/profile/notifications"
                  aria-label="Notifications"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/95 ring-1 ring-white/15"
                >
                  <BellIcon className="h-5 w-5" />
                </Link>
              ) : <span className="h-8 w-8" aria-hidden />}
            </div>
          </div>

          <div className={showBottomNav ? "px-4 pb-28 pt-4" : "px-4 pb-6 pt-4"}>
            {children}
          </div>

          {showBottomNav ? <BottomNav /> : null}
        </div>
      </div>
    </main>
  );
}

function StickyActionBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-[5.5rem] z-20 mt-5 rounded-[20px] border border-[#ebe3f5] bg-white/95 p-3 shadow-[0_18px_44px_rgba(86,38,135,0.12)] backdrop-blur">
      {children}
    </div>
  );
}

export function ProfileOverviewScreen({ initialData }: OverviewProps) {
  const [profile, setProfile] = useState(() => loadStoredCustomerProfile() ?? initialData.profile);
  const [favoriteProviders, setFavoriteProviders] = useState(initialData.favoriteProviders);
  const [bookingSummary, setBookingSummary] = useState(initialData.bookingSummary);
  const [paymentSummary, setPaymentSummary] = useState(initialData.paymentSummary);
  const [walletPanel, setWalletPanel] = useState<"closed" | "withdraw">("closed");
  const [selectedBank, setSelectedBank] = useState("Maybank");
  const [walletMessage, setWalletMessage] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const router = useRouter();

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const referralCode = useMemo(
    () => buildReferralCode(profile.firstName, profile.lastName, profile.phoneNumber),
    [profile.firstName, profile.lastName, profile.phoneNumber],
  );
  const referralLink = useMemo(() => buildReferralLink(referralCode), [referralCode]);
  const availablePoints = useMemo(
    () =>
      Math.max(
        250,
        bookingSummary.completed * 150 + favoriteProviders.length * 25 + Number(paymentSummary.totalPaid || 0),
      ),
    [bookingSummary.completed, favoriteProviders.length, paymentSummary.totalPaid],
  );
  const redeemableRewards = useMemo(
    () => [
      {
        id: "voucher-10",
        title: "RM 10 Voucher",
        description: "Grab RM10 off on any service.",
        points: 500,
      },
      {
        id: "voucher-20",
        title: "RM 20 Voucher",
        description: "Save RM20 on selected bookings.",
        points: 900,
      },
      {
        id: "service-discount",
        title: "Free Service Discount",
        description: "Enjoy up to RM30 service discount.",
        points: 1200,
      },
    ],
    [],
  );
  const [referralMessage, setReferralMessage] = useState("");

  const handleLogout = () => {
    startLogoutTransition(async () => {
      setLogoutError("");
      const client = getSupabaseClient();

      if (!client) {
        await signOutLocally(null);
        router.replace("/login");
        router.refresh();
        return;
      }

      await signOutLocally(client);
      router.replace("/login");
      router.refresh();
    });
  };

  const handleWithdrawClick = () => {
    setWalletMessage("");
    setWalletPanel("withdraw");
  };

  const handleConnectBank = () => {
    if (paymentSummary.walletBalance <= 0) {
      setWalletMessage("No wallet balance available to withdraw yet.");
      setWalletPanel("closed");
      return;
    }

    const amount = paymentSummary.walletBalance;
    setPaymentSummary((current) => ({
      ...current,
      walletBalance: 0,
    }));
    setWalletMessage(
      `${selectedBank} connected. Withdrawal request for ${formatRinggit(amount)} is being processed.`,
    );
    setWalletPanel("closed");
  };

  useEffect(() => {
    let active = true;

    async function loadLiveProfile() {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      let session: Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"] = null;

      try {
        session = await getFreshSupabaseSession(client);
      } catch {
        return;
      }

      if (!active || !session) {
        return;
      }

      try {
        const { response, result } = await fetchJsonWithRetry<
          | {
              profile: CustomerProfile;
              bookingSummary: ProfileOverviewData["bookingSummary"];
              paymentSummary: ProfileOverviewData["paymentSummary"];
            }
          | { error?: string }
        >("/api/profile/me", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!active || !response.ok || !result || !("profile" in result)) {
          return;
        }

        setProfile(result.profile);
        setBookingSummary(result.bookingSummary);
        setPaymentSummary(result.paymentSummary);
      } catch {
        return;
      }

      try {
        const favoritesResponse = await fetch("/api/profile/favorites", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const favoritesResult = (await favoritesResponse.json()) as
          | { favoriteProviders: FavoriteProvider[] }
          | { error?: string };

        if (active && favoritesResponse.ok && "favoriteProviders" in favoritesResult) {
          setFavoriteProviders(favoritesResult.favoriteProviders);
        }
      } catch {
        // Keep the main profile visible even if favourites fail to load.
      }
    }

    void loadLiveProfile();

    return () => {
      active = false;
    };
  }, []);

  return (
    <ProfileShell title="My Profile" showBottomNav>
      <ProfileSummaryCard profile={profile} fullName={fullName} />
      <ProfileCompletion completion={profile.completion} />
      <CustomerVerificationSection profile={profile} />
      <WalletSummaryCard
        walletBalance={paymentSummary.walletBalance}
        walletPanel={walletPanel}
        selectedBank={selectedBank}
        walletMessage={walletMessage}
        onSelectedBankChange={setSelectedBank}
        onWithdrawClick={handleWithdrawClick}
        onConnectBank={handleConnectBank}
        onClosePanel={() => setWalletPanel("closed")}
      />

      <SectionCard
        title="My Bookings"
        actionHref="/profile/bookings"
        actionLabel="View All"
      >
        <ProfileInfoRow icon={<CalendarIcon className="h-4 w-4" />} label="Pending Bookings" value={String(bookingSummary.pending)} valueTone="green" href="/profile/bookings?tab=pending" />
        <ProfileInfoRow icon={<CheckCircleIcon className="h-4 w-4" />} label="On Going Bookings" value={String(bookingSummary.ongoing)} valueTone="green" href="/profile/bookings?tab=ongoing" />
        <ProfileInfoRow icon={<CheckCircleIcon className="h-4 w-4" />} label="Completed Bookings" value={String(bookingSummary.completed)} valueTone="green" href="/profile/bookings?tab=completed" />
        <ProfileInfoRow icon={<CloseCircleIcon className="h-4 w-4" />} label="Cancelled Bookings" value={String(bookingSummary.cancelled)} valueTone="green" href="/profile/bookings?tab=cancelled" />
      </SectionCard>

      <SectionCard
        title="Favourite Providers"
        actionHref="/profile/favourites"
        actionLabel="View All"
      >
        {favoriteProviders.length > 0 ? (
          <div className="flex items-start justify-between gap-3">
            {favoriteProviders.map((provider) => (
              <div key={provider.id} className="flex flex-1 flex-col items-center text-center">
                {provider.portraitSrc ? (
                  <div className="relative h-14 w-14 overflow-hidden rounded-full">
                    <Image
                      src={provider.portraitSrc}
                      alt={provider.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <AvatarCircle
                    initials={provider.initials}
                    size="md"
                    accent={provider.accent}
                  />
                )}
                <p className="mt-2 text-[13px] font-bold text-[#111827]">
                  {provider.name}
                </p>
                <p className="text-[12px] text-[#6b7280]">{provider.role}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[16px] border border-dashed border-[#d9e2dd] bg-[#fbfefc] px-4 py-5 text-center text-[13px] text-[#6b7280]">
            No favourite providers saved yet.
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Saved Address"
        actionHref="/profile/addresses"
        actionLabel="Open"
      >
        <div className="rounded-[16px] border border-dashed border-[#d9e2dd] bg-[#fbfefc] px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f1fa] text-[#8E5EB5]">
              <PinIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-[#111827]">Manage your saved addresses</p>
              <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">
                View saved addresses and add a new address for faster booking.
              </p>
              <Link
                href="/profile/addresses"
                className="mt-3 inline-flex h-10 items-center justify-center rounded-[12px] bg-[#f5f1fa] px-4 text-[13px] font-bold text-[#8E5EB5]"
              >
                Open Saved Addresses
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Payment Methods" actionLabel="Manage">
        {initialData.paymentMethods.map((method) => (
          <div
            key={method.id}
            className="flex items-center justify-between border-t border-[#edf1ef] px-0 py-3 first:border-t-0 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f1fa] text-[#8E5EB5]">
                <WalletIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">
                  {method.label}
                </p>
              </div>
            </div>
            <div className="text-right">
              {method.isDefault ? (
                <span className="rounded-full bg-[#f5f1fa] px-2 py-1 text-[11px] font-bold text-[#8E5EB5]">
                  Default
                </span>
              ) : null}
              <p className="mt-1 text-[12px] text-[#6b7280]">{method.type}</p>
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Payment"
        actionHref="/profile/payments"
        actionLabel="View All"
      >
        <ProfileInfoRow
          icon={<WalletIcon className="h-4 w-4" />}
          label="Total Paid"
          value={`RM${paymentSummary.totalPaid}`}
          valueTone="green"
        />
        <ProfileInfoRow
          icon={<CalendarIcon className="h-4 w-4" />}
          label="Latest Payment"
          value={paymentSummary.lastPaymentLabel}
        />
      </SectionCard>

      <RewardsSummaryCard
        availablePoints={availablePoints}
      />

      <section className="mt-4 rounded-[18px] border border-[#f3d2d2] bg-[#fff7f7] p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-[#ef4444] px-4 text-[15px] font-extrabold text-white shadow-[0_12px_24px_rgba(239,68,68,0.18)] disabled:opacity-70"
        >
          {isLoggingOut ? "Logging out..." : "Log Out"}
        </button>
        {logoutError ? (
          <p className="mt-3 text-[13px] font-semibold text-[#dc2626]">{logoutError}</p>
        ) : null}
      </section>
    </ProfileShell>
  );
}

function CustomerVerificationSection({
  profile,
}: {
  profile: CustomerProfile;
}) {
  return (
    <Link
      href="/profile/verification"
      className="mt-4 flex items-center justify-between gap-3 rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]"
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#c18eff_0%,#8E5EB5_100%)] text-white shadow-[0_16px_36px_rgba(142,94,181,0.22)]">
          <CheckShieldIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[1.25rem] font-black tracking-[-0.05em] text-[#1f1630]">
            Verification
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-[#7b728a]">
            Open phone, email, and IC / passport verification
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold ${
            profile.verified
              ? "bg-[#eef9f0] text-[#16a34a]"
              : "bg-[#fff7ed] text-[#f59e0b]"
          }`}
        >
          {profile.verified ? <CheckCircleIcon className="h-4 w-4" /> : null}
          {profile.verified ? "Verified" : "Pending"}
        </span>
        <ChevronRightIcon className="h-5 w-5 text-[#98a2b3]" />
      </div>
    </Link>
  );
}

export function CustomerVerificationHubScreen({ initialProfile }: EditProps) {
  const profile = useLiveCustomerProfile(initialProfile);

  return (
    <ProfileShell title="Verification" showBack backHref="/profile" showBottomNav={false}>
      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#c18eff_0%,#8E5EB5_100%)] text-white shadow-[0_16px_36px_rgba(142,94,181,0.22)]">
              <CheckShieldIcon className="h-7 w-7" />
            </span>
            <div>
              <h3 className="text-[1.5rem] font-black tracking-[-0.05em] text-[#1f1630]">
                Verification
              </h3>
              <p className="mt-1 text-[13px] text-[#7b728a]">
                Verification status for your account
              </p>
            </div>
          </div>
          <Link
            href="/profile/edit"
            className="rounded-[12px] border border-[#e5d5fa] bg-[#fbf8ff] px-3 py-2 text-[12px] font-bold text-[#8E5EB5]"
          >
            Verify / Edit
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          <CustomerVerificationStatusCard
            href="/profile/verification/email"
            icon={<MailIcon className="h-6 w-6" />}
            title="Email"
            subtitle="Email status"
            verified={profile.emailVerified}
          />
          <CustomerVerificationStatusCard
            href="/profile/verification/phone"
            icon={<PhoneIcon className="h-6 w-6" />}
            title="Phone"
            subtitle="Phone status"
            verified={profile.phoneVerified}
          />
          <CustomerVerificationStatusCard
            href="/profile/verification/identity"
            icon={<DocumentIcon className="h-6 w-6" />}
            title="IC / Passport"
            subtitle="Identity check"
            verified={profile.verified}
            status={profile.identityVerificationStatus}
          />
        </div>
      </section>
    </ProfileShell>
  );
}

function useLiveCustomerProfile(initialProfile: CustomerProfile) {
  const [profile, setProfile] = useState(() => loadStoredCustomerProfile() ?? initialProfile);

  useEffect(() => {
    let active = true;

    async function loadLiveProfile() {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      let session: Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"] = null;

      try {
        session = await getFreshSupabaseSession(client);
      } catch {
        return;
      }

      if (!active || !session) {
        return;
      }

      try {
        const { response, result } = await fetchJsonWithRetry<
          | {
              profile: CustomerProfile;
            }
          | { error?: string }
        >("/api/profile/me", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (active && response.ok && result && "profile" in result) {
          setProfile(result.profile);
        }
      } catch {
        return;
      }
    }

    void loadLiveProfile();

    return () => {
      active = false;
    };
  }, [initialProfile]);

  return profile;
}

function CustomerVerificationStatusCard({
  href,
  icon,
  title,
  subtitle,
  verified,
  status,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  verified: boolean;
  status?: "pending" | "processing" | "verified" | "rejected";
}) {
  const label = verified ? "Verified" : status === "processing" ? "Processing" : status === "rejected" ? "Rejected" : "Pending";
  const toneClass = verified
    ? "bg-[#eef9f0] text-[#16a34a]"
    : status === "processing"
      ? "bg-[#eff6ff] text-[#2563eb]"
      : status === "rejected"
        ? "bg-[#fff1f2] text-[#dc2626]"
        : "bg-[#fff7ed] text-[#f59e0b]";

  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-[22px] border border-[#ece4fa] bg-white px-4 py-4 shadow-[0_8px_18px_rgba(106,69,160,0.04)]"
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#f6effd] text-[#8E5EB5]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[1.05rem] font-bold tracking-[-0.03em] text-[#1f1630]">
            {title}
          </p>
          <p className="mt-1 text-[13px] text-[#7b728a]">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold ${toneClass}`}>
          {verified ? <CheckCircleIcon className="h-4 w-4" /> : null}
          {label}
        </span>
        <ChevronRightIcon className="h-5 w-5 text-[#98a2b3]" />
      </div>
    </Link>
  );
}

function OtpInputSlots({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  return (
    <div className="mt-4 flex items-center gap-3">
      {Array.from({ length: 6 }, (_, index) => {
        const char = value[index] ?? "";

        return (
          <input
            key={index}
            ref={(node) => {
              inputsRef.current[index] = node;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={char}
            onChange={(event) => {
              const nextChar = event.target.value.replace(/\D/g, "").slice(-1);
              const nextValue = value.split("");
              nextValue[index] = nextChar;
              onChange(nextValue.join("").slice(0, 6));

              if (nextChar && index < 5) {
                inputsRef.current[index + 1]?.focus();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !char && index > 0) {
                inputsRef.current[index - 1]?.focus();
              }
            }}
            className="h-14 w-12 rounded-[14px] border border-[#e5def3] bg-white text-center text-[1.25rem] font-black text-[#1f1630] outline-none transition focus:border-[#8E5EB5] focus:ring-2 focus:ring-[#efe6fb]"
          />
        );
      })}
    </div>
  );
}

async function patchCustomerProfile(payload: Record<string, unknown>) {
  const client = getSupabaseClient();

  if (!client) {
    return { ok: false, error: "Supabase is not configured yet." };
  }

  const session = await getFreshSupabaseSession(client);

  if (!session) {
    return { ok: false, error: "Your session expired. Please log in again." };
  }

  const response = await fetch("/api/profile/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({}))) as { error?: string; profile?: CustomerProfile };

  if (!response.ok) {
    return { ok: false, error: result.error || "Unable to update verification." };
  }

  return { ok: true, profile: result.profile ?? null };
}

export function CustomerEmailVerificationScreen({ initialProfile }: EditProps) {
  const router = useRouter();
  const profile = useLiveCustomerProfile(initialProfile);
  const [emailValue, setEmailValue] = useState(initialProfile.email);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, startTransition] = useTransition();

  useEffect(() => {
    if (!otpSent || countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpSent, countdown]);

  const canSend = /\S+@\S+\.\S+/.test(emailValue.trim());
  const canVerify = canSend && otp.length === 6;

  useEffect(() => {
    setEmailValue(profile.email);
  }, [profile.email]);

  return (
    <ProfileShell title="Email Verification" showBack backHref="/profile/verification" showBottomNav={false}>
      <section className="space-y-4">
        <div className="flex items-center justify-end">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold ${profile.emailVerified ? "bg-[#eef9f0] text-[#16a34a]" : "bg-[#fff7ed] text-[#f59e0b]"}`}>
            {profile.emailVerified ? <CheckCircleIcon className="h-4 w-4" /> : null}
            {profile.emailVerified ? "Verified" : "Pending"}
          </span>
        </div>

        <header>
          <h1 className="text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">Email Verification</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#7b728a]">
            Add your email address and verify it with a one-time code.
          </p>
        </header>

        <section className="rounded-[26px] border border-[#eee5f7] bg-white p-5 shadow-[0_18px_44px_rgba(86,38,135,0.08)]">
          <p className="text-[15px] font-black text-[#1f1630]">Email Address</p>
          <div className="mt-4 flex items-center rounded-[16px] border border-[#e7def4] bg-white px-4">
            <MailIcon className="h-5 w-5 text-[#8E5EB5]" />
            <input
              type="email"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value.trimStart())}
              placeholder="Enter email address"
              className="h-[52px] w-full bg-transparent px-3 text-[15px] text-[#1f1630] outline-none placeholder:text-[#b3a9c7]"
            />
          </div>

          <button
            type="button"
            disabled={!canSend}
            onClick={() => {
              if (!canSend) {
                return;
              }
              setOtp("");
              setOtpSent(true);
              setCountdown(30);
              setNotice("We sent a 6-digit code to your email.");
              setError("");
            }}
            className={`mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border text-[15px] font-black transition ${
              canSend
                ? "border-[#cdb8f3] bg-white text-[#8E5EB5] shadow-[0_12px_28px_rgba(142,94,181,0.08)]"
                : "cursor-not-allowed border-[#eadff8] bg-[#faf7fe] text-[#c2b2dc]"
            }`}
          >
            <ShareArrowIcon className="h-4.5 w-4.5" />
            Send Code
          </button>

          <div className="mt-6">
            <p className="text-[15px] font-black text-[#1f1630]">Enter OTP</p>
            <OtpInputSlots value={otp} onChange={setOtp} />
            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex items-center gap-2 text-[#6f6681]">
                <MessageIcon className="h-4 w-4 text-[#8E5EB5]" />
                <span>{notice || "We sent a 6-digit code to your email"}</span>
              </div>
              <div className="flex items-center gap-2 text-[#6f6681]">
                <ClockIcon className="h-4 w-4 text-[#8E5EB5]" />
                <span>
                  Resend code in <strong className="font-black text-[#8E5EB5]">00:{String(countdown).padStart(2, "0")}</strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
              <CheckShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Your security matters</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
                Your email address will be used for account verification and important updates.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <p className="rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canVerify || saving}
          onClick={() => {
            startTransition(async () => {
              setError("");
              const result = await patchCustomerProfile({
                email: emailValue.trim(),
                emailVerified: true,
              });

              if (!result.ok) {
                setError(result.error || "Unable to update email verification.");
                return;
              }

              router.push("/profile/verification");
            });
          }}
          className={`inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-[16px] font-black transition ${
            canVerify && !saving
              ? "bg-[linear-gradient(135deg,#8E5EB5_0%,#6f43b6_100%)] text-white shadow-[0_18px_34px_rgba(111,67,182,0.28)]"
              : "cursor-not-allowed bg-[#ddd2ef] text-white shadow-none"
          }`}
        >
          {saving ? "Verifying..." : "Verify Email"}
        </button>
      </section>
    </ProfileShell>
  );
}

export function CustomerPhoneVerificationScreen({ initialProfile }: EditProps) {
  const router = useRouter();
  const profile = useLiveCustomerProfile(initialProfile);
  const [phoneNumber, setPhoneNumber] = useState(initialProfile.phoneNumber);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, startTransition] = useTransition();

  useEffect(() => {
    if (!otpSent || countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpSent, countdown]);

  const canSend = phoneNumber.trim().length >= 7;
  const canVerify = canSend && otp.length === 6;

  useEffect(() => {
    setPhoneNumber(profile.phoneNumber);
  }, [profile.phoneNumber]);

  return (
    <ProfileShell title="Phone Verification" showBack backHref="/profile/verification" showBottomNav={false}>
      <section className="space-y-4">
        <div className="flex items-center justify-end">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold ${profile.phoneVerified ? "bg-[#eef9f0] text-[#16a34a]" : "bg-[#fff7ed] text-[#f59e0b]"}`}>
            {profile.phoneVerified ? <CheckCircleIcon className="h-4 w-4" /> : null}
            {profile.phoneVerified ? "Verified" : "Pending"}
          </span>
        </div>

        <header>
          <h1 className="text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">Phone Verification</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#7b728a]">
            Add your phone number and verify it with a one-time code.
          </p>
        </header>

        <section className="rounded-[26px] border border-[#eee5f7] bg-white p-5 shadow-[0_18px_44px_rgba(86,38,135,0.08)]">
          <p className="text-[15px] font-black text-[#1f1630]">Phone Number</p>
          <div className="mt-4 overflow-hidden rounded-[16px] border border-[#e7def4]">
            <div className="flex items-stretch">
              <div className="flex w-[96px] items-center gap-2 border-r border-[#e7def4] bg-white px-3">
                <MalaysiaFlagIcon className="h-4 w-6 rounded-[3px]" />
                <span className="text-[16px] font-semibold text-[#1f1630]">+60</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="Enter phone number"
                className="h-[52px] flex-1 bg-white px-4 text-[15px] text-[#1f1630] outline-none placeholder:text-[#b3a9c7]"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!canSend}
            onClick={() => {
              if (!canSend) {
                return;
              }
              setOtp("");
              setOtpSent(true);
              setCountdown(30);
              setNotice("We sent a 6-digit code by SMS to your phone.");
              setError("");
            }}
            className={`mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border text-[15px] font-black transition ${
              canSend
                ? "border-[#cdb8f3] bg-white text-[#8E5EB5] shadow-[0_12px_28px_rgba(142,94,181,0.08)]"
                : "cursor-not-allowed border-[#eadff8] bg-[#faf7fe] text-[#c2b2dc]"
            }`}
          >
            <ShareArrowIcon className="h-4.5 w-4.5" />
            Send OTP
          </button>

          <div className="mt-6">
            <p className="text-[15px] font-black text-[#1f1630]">Enter OTP</p>
            <OtpInputSlots value={otp} onChange={setOtp} />
            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex items-center gap-2 text-[#6f6681]">
                <MessageIcon className="h-4 w-4 text-[#8E5EB5]" />
                <span>{notice || "We sent a 6-digit code by SMS"}</span>
              </div>
              <div className="flex items-center gap-2 text-[#6f6681]">
                <ClockIcon className="h-4 w-4 text-[#8E5EB5]" />
                <span>
                  Resend code in <strong className="font-black text-[#8E5EB5]">00:{String(countdown).padStart(2, "0")}</strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
              <CheckShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Your security matters</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
                Your phone number will be used for account verification and important security alerts.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <p className="rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canVerify || saving}
          onClick={() => {
            startTransition(async () => {
              setError("");
              const result = await patchCustomerProfile({
                phoneNumber: phoneNumber.trim(),
                countryCode: profile.countryCode || "+60",
                phoneVerified: true,
              });

              if (!result.ok) {
                setError(result.error || "Unable to update phone verification.");
                return;
              }

              router.push("/profile/verification");
            });
          }}
          className={`inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-[16px] font-black transition ${
            canVerify && !saving
              ? "bg-[linear-gradient(135deg,#8E5EB5_0%,#6f43b6_100%)] text-white shadow-[0_18px_34px_rgba(111,67,182,0.28)]"
              : "cursor-not-allowed bg-[#ddd2ef] text-white shadow-none"
          }`}
        >
          {saving ? "Verifying..." : "Verify Number"}
        </button>
      </section>
    </ProfileShell>
  );
}

export function CustomerIdentityVerificationScreen({ initialProfile }: EditProps) {
  const router = useRouter();
  const profile = useLiveCustomerProfile(initialProfile);
  const [frontFileName, setFrontFileName] = useState("");
  const [backFileName, setBackFileName] = useState("");
  const [frontPreview, setFrontPreview] = useState<string | null>(initialProfile.identityFrontImageUrl || null);
  const [backPreview, setBackPreview] = useState<string | null>(initialProfile.identityBackImageUrl || null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<"ic" | "passport">(initialProfile.identityDocumentType === "passport" ? "passport" : "ic");
  const [uploadTarget, setUploadTarget] = useState<"front" | "back" | null>(null);
  const [cropState, setCropState] = useState<{
    side: "front" | "back";
    fileName: string;
    sourceDataUrl: string;
    tone: "document";
  } | null>(null);
  const [error, setError] = useState("");
  const [saving, startTransition] = useTransition();
  const frontGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const backGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const frontCameraInputRef = useRef<HTMLInputElement | null>(null);
  const backCameraInputRef = useRef<HTMLInputElement | null>(null);

  const identityStatus = profile.identityVerificationStatus;
  const isLocked = profile.verified || identityStatus === "processing";
  const canSubmit = Boolean(frontPreview && backPreview);

  useEffect(() => {
    setFrontPreview(profile.identityFrontImageUrl || null);
    setBackPreview(profile.identityBackImageUrl || null);
    setSelectedDocumentType(profile.identityDocumentType === "passport" ? "passport" : "ic");
  }, [profile.identityBackImageUrl, profile.identityDocumentType, profile.identityFrontImageUrl]);

  const handleFileChange = (side: "front" | "back", source: "gallery" | "camera") =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (isLocked) {
        setError("Your identity verification is under review right now.");
        return;
      }

      if (!isAcceptedImageFile(file)) {
        setError(source === "camera" ? "Camera upload must be an image." : "Gallery upload must be an image for document cropping.");
        return;
      }

      if (file.size > PAYMENT_PROOF_MAX_BYTES) {
        setError("Each document image must be 5MB or smaller.");
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      setUploadTarget(null);
      setCropState({
        side,
        fileName: file.name,
        sourceDataUrl: dataUrl,
        tone: "document",
      });
      setError("");
    };

  const openSourcePicker = (side: "front" | "back") => {
    if (isLocked) {
      setError("Your identity verification is under review right now.");
      return;
    }

    setUploadTarget(side);
    setError("");
  };

  const activeInputs =
    uploadTarget === "front"
      ? { gallery: frontGalleryInputRef, camera: frontCameraInputRef }
      : { gallery: backGalleryInputRef, camera: backCameraInputRef };

  return (
    <ProfileShell title="Identity Verification" showBack backHref="/profile/verification" showBottomNav={false}>
      <section className="space-y-4">
        <div className="flex items-center justify-end">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold ${
            profile.verified
              ? "bg-[#eef9f0] text-[#16a34a]"
              : identityStatus === "processing"
                ? "bg-[#eff6ff] text-[#2563eb]"
                : identityStatus === "rejected"
                  ? "bg-[#fff1f2] text-[#dc2626]"
                  : "bg-[#fff7ed] text-[#f59e0b]"
          }`}>
            {profile.verified ? <CheckCircleIcon className="h-4 w-4" /> : null}
            {profile.verified ? "Verified" : identityStatus === "processing" ? "Processing" : identityStatus === "rejected" ? "Rejected" : "Pending"}
          </span>
        </div>

        <header>
          <h1 className="text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">Identity Verification</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#7b728a]">
            {identityStatus === "processing"
              ? "Your IC / passport is under review. Verification usually takes up to 24 hours."
              : "Upload your IC or passport images for identity verification."}
          </p>
        </header>

        {identityStatus === "processing" ? (
          <section className="rounded-[18px] border border-[#c7d2fe] bg-[#eef2ff] px-4 py-3 text-[13px] font-semibold text-[#4338ca]">
            Your IC / Passport successfully submitted for verification. It will take up to 24 hours to activate.
          </section>
        ) : null}

        {identityStatus === "rejected" ? (
          <section className="rounded-[18px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#be123c]">
            Your previous identity verification was rejected. Please upload your IC / Passport again.
          </section>
        ) : null}

        <section className="rounded-[22px] border border-[#eadff8] bg-white p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <p className="text-[14px] font-black text-[#1f1630]">Document Type</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedDocumentType("ic")}
              disabled={isLocked}
              className={`rounded-[14px] border px-4 py-3 text-[14px] font-bold transition ${selectedDocumentType === "ic" ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]" : "border-[#e7def4] bg-white text-[#6f6681]"} ${isLocked ? "cursor-not-allowed opacity-60" : ""}`}
            >
              IC
            </button>
            <button
              type="button"
              onClick={() => setSelectedDocumentType("passport")}
              disabled={isLocked}
              className={`rounded-[14px] border px-4 py-3 text-[14px] font-bold transition ${selectedDocumentType === "passport" ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]" : "border-[#e7def4] bg-white text-[#6f6681]"} ${isLocked ? "cursor-not-allowed opacity-60" : ""}`}
            >
              Passport
            </button>
          </div>
        </section>

        <section className="rounded-[26px] border border-[#eee5f7] bg-white p-5 shadow-[0_18px_44px_rgba(86,38,135,0.08)]">
          <div className="space-y-5">
            {([
              {
                side: "front" as const,
                title: selectedDocumentType === "passport" ? "Passport Main Page" : "IC Front",
                subtitle: `Upload clear image of ${selectedDocumentType === "passport" ? "passport page" : "front side"}`,
                fileName: frontFileName,
                preview: frontPreview,
                buttonLabel: selectedDocumentType === "passport" ? "Upload Passport" : "Upload Front",
              },
              {
                side: "back" as const,
                title: selectedDocumentType === "passport" ? "Passport Supporting Page" : "IC Back",
                subtitle: `Upload clear image of ${selectedDocumentType === "passport" ? "supporting page" : "back side"}`,
                fileName: backFileName,
                preview: backPreview,
                buttonLabel: selectedDocumentType === "passport" ? "Upload Page" : "Upload Back",
              },
            ]).map((item) => (
              <div key={item.side}>
                <p className="text-[15px] font-black text-[#1f1630]">{item.title}</p>
                <div className="mt-3 rounded-[18px] border border-dashed border-[#dccff3] bg-[#fdfbff] p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-24 w-32 overflow-hidden rounded-[14px] border border-[#ece3f8] bg-[linear-gradient(135deg,#f8f4ff_0%,#eef2ff_100%)]">
                      {item.preview ? (
                        <Image src={item.preview} alt={item.fileName || item.title} fill unoptimized className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#8E5EB5]">
                          <DocumentIcon className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-5 text-[#6f6681]">{item.subtitle}</p>
                      {item.fileName ? (
                        <p className="mt-2 truncate text-[12px] font-semibold text-[#8E5EB5]">{item.fileName}</p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openSourcePicker(item.side)}
                        disabled={isLocked}
                        className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#ceb9f2] bg-white px-4 text-[14px] font-bold text-[#8E5EB5]"
                      >
                        <ShareArrowIcon className="h-4 w-4" />
                        {item.buttonLabel}
                      </button>
                      {item.side === "front" ? (
                        <>
                          <input ref={frontGalleryInputRef} type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={handleFileChange("front", "gallery")} className="hidden" />
                          <input ref={frontCameraInputRef} type="file" accept={IMAGE_UPLOAD_ACCEPT} capture="environment" onChange={handleFileChange("front", "camera")} className="hidden" />
                        </>
                      ) : (
                        <>
                          <input ref={backGalleryInputRef} type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={handleFileChange("back", "gallery")} className="hidden" />
                          <input ref={backCameraInputRef} type="file" accept={IMAGE_UPLOAD_ACCEPT} capture="environment" onChange={handleFileChange("back", "camera")} className="hidden" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
              <DocumentIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Image Requirements</p>
              <ul className="mt-2 space-y-1 text-[13px] leading-5 text-[#6f6681]">
                <li>Ensure the full IC or passport page is visible within the frame</li>
                <li>All text must be clear and readable</li>
                <li>Image must be in focus and not blurry</li>
                <li>No glare or reflections on the card</li>
                <li>Crop the image before saving to keep only the document area</li>
              </ul>
            </div>
          </div>
        </section>

        {error ? (
          <p className="rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit || isLocked || saving}
          onClick={() => {
            startTransition(async () => {
              if (!canSubmit || isLocked) {
                return;
              }

              setError("");
              const result = await patchCustomerProfile({
                verified: false,
                identityVerificationStatus: "processing",
                identityDocumentType: selectedDocumentType,
                identityFrontImageUrl: frontPreview,
                identityBackImageUrl: backPreview,
              });

              if (!result.ok) {
                setError(result.error || "Unable to submit identity verification.");
                return;
              }

              const successMessage = `Your ${selectedDocumentType === "passport" ? "Passport" : "IC / Passport"} successfully submitted for verification. It will take 24 hrs to activate.`;
              window.alert(successMessage);
              router.push("/profile/verification");
            });
          }}
          className={`inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-[16px] font-black transition ${
            canSubmit && !isLocked && !saving
              ? "bg-[linear-gradient(135deg,#8E5EB5_0%,#6f43b6_100%)] text-white shadow-[0_18px_34px_rgba(111,67,182,0.28)]"
              : "cursor-not-allowed bg-[#ddd2ef] text-white shadow-none"
          }`}
        >
          {saving ? "Submitting..." : isLocked ? "Submitted for Review" : "Submit for Verification"}
        </button>

        {uploadTarget ? (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#111827]/45 px-4 pb-6">
            <div className="w-full max-w-[430px] rounded-[24px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
              <p className="text-[16px] font-black text-[#1f1630]">
                {uploadTarget === "front" ? "Front document image" : "Back document image"}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
                Choose a source, then crop the document before saving.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => activeInputs.gallery.current?.click()} className="inline-flex h-12 items-center justify-center rounded-[14px] border border-[#d9c8ee] bg-white px-4 text-[14px] font-bold text-[#8E5EB5]">
                  Choose from Gallery
                </button>
                <button type="button" onClick={() => activeInputs.camera.current?.click()} className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#8E5EB5] px-4 text-[14px] font-bold text-white">
                  Open Camera
                </button>
              </div>
              <button type="button" onClick={() => setUploadTarget(null)} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[#eee5f7] bg-[#faf7fe] text-[14px] font-bold text-[#6f6681]">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {cropState ? (
        <ImageCropModal
          imageDataUrl={cropState.sourceDataUrl}
          tone={cropState.tone}
          onClose={() => setCropState(null)}
          onApply={async (selection) => {
            try {
              const croppedImage = await cropImageFromSelection(cropState.sourceDataUrl, selection);
              if (cropState.side === "front") {
                setFrontFileName(cropState.fileName);
                setFrontPreview(croppedImage);
              } else {
                setBackFileName(cropState.fileName);
                setBackPreview(croppedImage);
              }
              setCropState(null);
              setError("");
            } catch (cropError) {
              setError(cropError instanceof Error ? cropError.message : "Unable to crop this document image.");
            }
          }}
        />
      ) : null}
    </ProfileShell>
  );
}

export function RewardsScreen({ initialData }: OverviewProps) {
  const profile = initialData.profile;
  const favoriteProviders = initialData.favoriteProviders;
  const bookingSummary = initialData.bookingSummary;
  const paymentSummary = initialData.paymentSummary;
  const referralCode = useMemo(
    () => buildReferralCode(profile.firstName, profile.lastName, profile.phoneNumber),
    [profile.firstName, profile.lastName, profile.phoneNumber],
  );
  const referralLink = useMemo(() => buildReferralLink(referralCode), [referralCode]);
  const availablePoints = useMemo(
    () =>
      Math.max(
        250,
        bookingSummary.completed * 150 + favoriteProviders.length * 25 + Number(paymentSummary.totalPaid || 0),
      ),
    [bookingSummary.completed, favoriteProviders.length, paymentSummary.totalPaid],
  );
  const redeemableRewards = useMemo(
    () => [
      {
        id: "voucher-10",
        title: "RM 10 Voucher",
        description: "Grab RM10 off on any service.",
        points: 500,
      },
      {
        id: "voucher-20",
        title: "RM 20 Voucher",
        description: "Save RM20 on selected bookings.",
        points: 900,
      },
      {
        id: "service-discount",
        title: "Free Service Discount",
        description: "Enjoy up to RM30 service discount.",
        points: 1200,
      },
    ],
    [],
  );
  const [referralMessage, setReferralMessage] = useState("");

  return (
    <ProfileShell title="Rewards" showBack backHref="/profile" showBottomNav={false}>
      <ReferralRewardsCard
        referralCode={referralCode}
        referralLink={referralLink}
        availablePoints={availablePoints}
        rewards={redeemableRewards}
        feedbackMessage={referralMessage}
        onFeedbackChange={setReferralMessage}
      />
    </ProfileShell>
  );
}

export function WalletTopUpScreen({ initialData }: OverviewProps) {
  const [selectedAmount, setSelectedAmount] = useState("20");
  const [customAmount, setCustomAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [isProcessing, startTransition] = useTransition();

  const presetAmounts = ["20", "50", "100", "200"];
  const displayAmount = customAmount.trim() || selectedAmount;

  return (
    <ProfileShell title="Top Up Wallet" showBack backHref="/profile" showBottomNav={false}>
      <section className="rounded-[24px] border border-[#ebe2f8] bg-white p-4 shadow-[0_16px_34px_rgba(106,69,160,0.08)]">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
          Current Balance
        </p>
        <p className="mt-3 text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">
          {formatRinggit(initialData.paymentSummary.walletBalance)}
        </p>
        <p className="mt-1 text-[12px] text-[#7c728f]">
          Add funds to your wallet for future bookings and quick payments.
        </p>
      </section>

      <section className="mt-4 rounded-[24px] border border-[#ebe2f8] bg-white p-4 shadow-[0_14px_30px_rgba(106,69,160,0.07)]">
        <p className="text-[15px] font-black text-[#1f1630]">Choose top up amount</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {presetAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setSelectedAmount(amount);
                setCustomAmount("");
              }}
              className={`rounded-[14px] border px-4 py-4 text-left text-[15px] font-black transition ${
                !customAmount && selectedAmount === amount
                  ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]"
                  : "border-[#e7def4] bg-white text-[#1f1630]"
              }`}
            >
              {formatRinggit(Number(amount))}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[13px] font-semibold text-[#111827]">Custom amount</p>
          <div className="flex items-center rounded-[14px] border border-[#e7def4] bg-white px-4">
            <span className="text-[15px] font-bold text-[#8E5EB5]">RM</span>
            <input
              type="number"
              min="1"
              step="1"
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="Enter amount"
              className="h-12 w-full bg-transparent px-3 text-[15px] font-semibold text-[#1f1630] outline-none placeholder:text-[#b3a9c7]"
            />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
            <WalletIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[14px] font-black text-[#1f1630]">Selected amount</p>
            <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
              {displayAmount ? formatRinggit(Number(displayAmount)) : "Choose or enter a top up amount."}
            </p>
          </div>
        </div>
      </section>

      {notice ? (
        <p className="mt-4 rounded-[14px] border border-[#d7efdb] bg-[#effbf1] px-4 py-3 text-[12px] font-semibold text-[#1f6b37]">
          {notice}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!displayAmount || Number(displayAmount) <= 0 || isProcessing}
        onClick={() => {
          startTransition(async () => {
            setNotice(`Top up request for ${formatRinggit(Number(displayAmount))} is ready. Payment gateway can be connected next.`);
          });
        }}
        className={`mt-5 inline-flex h-12 w-full items-center justify-center rounded-[14px] text-[15px] font-extrabold transition ${
          displayAmount && Number(displayAmount) > 0 && !isProcessing
            ? "bg-[linear-gradient(135deg,#8E5EB5_0%,#6f43b6_100%)] text-white shadow-[0_18px_34px_rgba(111,67,182,0.28)]"
            : "cursor-not-allowed bg-[#ddd2ef] text-white shadow-none"
        }`}
      >
        {isProcessing ? "Processing..." : "Top Up Wallet"}
      </button>
    </ProfileShell>
  );
}

export function FavoritesScreen({ providers }: FavoritesProps) {
  const [items, setItems] = useState(providers);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      const session = await getFreshSupabaseSession(client);

      if (!active || !session) {
        return;
      }

      const response = await fetch("/api/profile/favorites", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as
        | { favoriteProviders: FavoriteProvider[] }
        | { error?: string };

      if (!active) {
        return;
      }

      if (!response.ok || !("favoriteProviders" in result)) {
        if ("error" in result && isFavoriteSchemaUnavailable(result.error)) {
          const localIds = loadStoredFavoriteProviderIds();
          setItems(providers.filter((provider) => localIds.has(provider.id)));
          setError("");
          return;
        }

        setError(("error" in result ? result.error : "") || "Unable to load favourite providers right now.");
        return;
      }

      saveStoredFavoriteProviderIds(new Set(result.favoriteProviders.map((provider) => provider.id)));
      setItems(result.favoriteProviders);
    }

    void loadFavorites();

    return () => {
      active = false;
    };
  }, []);

  async function removeFavorite(providerId: string) {
    const client = getSupabaseClient();

    if (!client) {
      setError("Supabase is not configured yet.");
      return;
    }

    const session = await getFreshSupabaseSession(client);

    if (!session) {
      setError("Your session expired. Please log in again.");
      return;
    }

    const previousItems = items;
    const nextItems = previousItems.filter((item) => item.id !== providerId);
    setItems(nextItems);
    saveStoredFavoriteProviderIds(new Set(nextItems.map((item) => item.id)));
    setError("");

    const response = await fetch("/api/profile/favorites", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ providerId }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (isFavoriteSchemaUnavailable(result.error)) {
        setError("");
        return;
      }

      setError(result.error || "Unable to remove favourite provider right now.");
      setItems(previousItems);
      saveStoredFavoriteProviderIds(new Set(previousItems.map((item) => item.id)));
    }
  }

  return (
    <ProfileShell title="Favourite Providers" showBack backHref="/profile">
      <div className="space-y-4">
        {error ? (
          <p className="rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
            {error}
          </p>
        ) : null}

        {items.map((provider) => (
          <div
            key={provider.id}
            className="rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start gap-4">
              <div className="relative h-[5.6rem] w-[5.6rem] shrink-0 overflow-hidden rounded-full">
                {provider.portraitSrc ? (
                  <Image
                    src={provider.portraitSrc}
                    alt={provider.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <AvatarCircle
                    initials={provider.initials}
                    size="lg"
                    accent={provider.accent}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-extrabold text-[#111827]">
                      {provider.name}
                    </h2>
                    <p className="mt-1 text-[13px] font-semibold text-[#8E5EB5]">
                      {provider.role}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${provider.name} from favourites`}
                    onClick={() => void removeFavorite(provider.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1f1] text-[#ef4444]"
                  >
                    <FavoriteHeartIcon className="h-5 w-5 fill-current" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] text-[#4b5563]">
                  <p>
                    Rating:{" "}
                    <span className="font-semibold text-[#111827]">
                      {provider.rating?.toFixed(1) ?? "4.8"}
                    </span>
                  </p>
                  <p>
                    From:{" "}
                    <span className="font-semibold text-[#111827]">
                      {provider.priceLabel ?? "RM200"}
                    </span>
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <Link
                    href={provider.bookHref ?? "/profile/favourites"}
                    className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#8E5EB5] px-4 text-[13px] font-extrabold text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]"
                  >
                    Book Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#d9e2dd] bg-white px-4 py-8 text-center text-[14px] text-[#6b7280]">
            No favourite providers left.
          </div>
        ) : null}
      </div>
    </ProfileShell>
  );
}

export function EditProfileScreen({ initialProfile }: EditProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedMessage, setSavedMessage] = useState("");
  const [form, setForm] = useState(initialProfile);
  const [avatarCropState, setAvatarCropState] = useState<{
    fileName: string;
    sourceDataUrl: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLiveProfile() {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      let session: Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"] = null;

      try {
        session = await getFreshSupabaseSession(client);
      } catch {
        return;
      }

      if (!active || !session) {
        return;
      }

      const { response, result } = await fetchJsonWithRetry<
        | {
            profile: CustomerProfile;
          }
        | { error?: string }
      >("/api/profile/me", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => ({ response: null, result: null }));

      if (!active || !response?.ok || !result || !("profile" in result)) {
        return;
      }

      setForm(result.profile);
    }

    void loadLiveProfile();

    return () => {
      active = false;
    };
  }, []);

  const updateField =
    (field: keyof CustomerProfile) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void (async () => {
      if (!isAcceptedImageFile(file)) {
        setSavedMessage("Please choose a JPG, PNG, GIF, WEBP, TIFF, or JFIF image.");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setSavedMessage("Profile photo must be 2MB or smaller.");
        return;
      }

      setSavedMessage("");
      setAvatarCropState({
        fileName: file.name,
        sourceDataUrl: await readFileAsDataUrl(file),
      });
    })();
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await saveCustomerProfile(form);
      setSavedMessage(
        result.mode === "supabase"
          ? "Saved to profile backend."
          : "Saved for preview on this device."
      );
      window.setTimeout(() => {
        router.push("/profile");
      }, 500);
    });
  };

  return (
    <ProfileShell title="Edit Personal Information" showBack backHref="/profile">
      <form onSubmit={handleSave}>
        <div className="mb-5 flex flex-col items-center">
          <label className="relative cursor-pointer">
            {form.avatarUrl ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-full shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
                <Image
                  src={form.avatarUrl}
                  alt="Profile photo"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <AvatarCircle
                initials={customerInitials(form)}
                size="xl"
                accent="from-[#8E5EB5] to-[#7B4EA1]"
              />
            )}
            <span className="absolute bottom-1 right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#8E5EB5] text-white shadow-[0_8px_18px_rgba(142,94,181,0.22)]">
              <CameraIcon className="h-4 w-4" />
            </span>
            <input
              type="file"
              accept={IMAGE_UPLOAD_ACCEPT}
              onChange={handleAvatarChange}
              className="sr-only"
            />
          </label>
          <p className="mt-3 text-[13px] text-[#4b5563]">Change Profile Photo</p>
        </div>

        <div className="space-y-4">
          <LabeledInput label="First Name" value={form.firstName} onChange={updateField("firstName")} icon={<UserIcon className="h-5 w-5" />} />
          <LabeledInput label="Last Name" value={form.lastName} onChange={updateField("lastName")} icon={<UserIcon className="h-5 w-5" />} />
          <LabeledSelect
            label="Gender"
            value={form.sex}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sex: event.target.value as CustomerProfile["sex"],
              }))
            }
            icon={<UserIcon className="h-5 w-5" />}
            options={["Male", "Female"]}
            hidePlaceholder
          />
          <LabeledDateInput label="Date of Birth" value={form.dateOfBirth} onChange={(value) => setForm((current) => ({ ...current, dateOfBirth: value }))} icon={<CalendarIcon className="h-5 w-5" />} />
          <LabeledInput label="Email" value={form.email} onChange={updateField("email")} icon={<MailIcon className="h-5 w-5" />} />
          <div>
            <p className="mb-2 text-[14px] font-semibold text-[#111827]">Phone Number</p>
            <div className="flex gap-2.5">
              <div className="flex h-11 w-[6.2rem] items-center rounded-[12px] border border-[#d9e2dd] px-3 text-[14px] text-[#111827] shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                <MalaysiaFlagIcon className="mr-2 h-4 w-6 rounded-[3px]" />
                <span>{form.countryCode}</span>
                <ChevronDownIcon className="ml-auto h-4 w-4 text-[#6b7280]" />
              </div>
              <div className="flex flex-1 items-center rounded-[12px] border border-[#d9e2dd] px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                <input
                  value={form.phoneNumber}
                  onChange={updateField("phoneNumber")}
                  className="h-11 w-full border-0 bg-transparent text-[14px] text-[#111827] outline-none"
                />
              </div>
            </div>
          </div>
          <LabeledInput label="Emergency Contact Number" value={form.emergencyContactNumber} onChange={updateField("emergencyContactNumber")} icon={<PhoneIcon className="h-5 w-5" />} />
          <LabeledInput label="Country" value={form.country} onChange={updateField("country")} icon={<PinIcon className="h-5 w-5" />} />
        </div>

        {savedMessage ? (
          <p className="mt-4 text-center text-[13px] font-semibold text-[#8E5EB5]">
            {savedMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[#8E5EB5] text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.22)]"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
        {avatarCropState ? (
          <ImageCropModal
            imageDataUrl={avatarCropState.sourceDataUrl}
            tone="profile"
            aspectRatio={1}
            onClose={() => setAvatarCropState(null)}
            onApply={async (selection) => {
              const cropped = await cropImageFromSelection(avatarCropState.sourceDataUrl, selection);
              setForm((current) => ({
                ...current,
                avatarUrl: cropped,
              }));
              setSavedMessage("");
              setAvatarCropState(null);
            }}
          />
        ) : null}
      </form>
    </ProfileShell>
  );
}

export function AddressesScreen({ addresses }: AddressesProps) {
  const [items, setItems] = useState(addresses);
  const [showForm, setShowForm] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    label: `Address ${Math.max(1, addresses.length + 1)}`,
    unitNumber: "",
    addressLine1: "",
    addressLine2: "",
    postcode: "",
    city: "",
    state: "",
    country: "Malaysia",
  });

  useEffect(() => {
    let active = true;

    async function loadLiveAddresses() {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      const session = await getFreshSupabaseSession(client);

      if (!active || !session) {
        return;
      }

      const response = await fetch("/api/profile/addresses", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as
        | { addresses: Address[] }
        | { error?: string };

      if (!active || !response.ok || !("addresses" in result)) {
        return;
      }

      setItems(result.addresses);
      setForm((current) => ({
        ...current,
        label: `Address ${Math.max(1, result.addresses.length + 1)}`,
      }));
    }

    void loadLiveAddresses();

    return () => {
      active = false;
    };
  }, []);

  const updateField =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSave = () => {
    startSaving(async () => {
      setError("");
      const client = getSupabaseClient();

      if (!client) {
        setError("Supabase is not configured yet.");
        return;
      }

      const session = await getFreshSupabaseSession(client);

      if (!session) {
        setError("Please log in again to save addresses.");
        return;
      }

      const response = await fetch("/api/profile/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          isDefault: items.length === 0,
        }),
      });

      const result = (await response.json()) as
        | { address: Address }
        | { error?: string };

      if (!response.ok || !("address" in result)) {
        setError(
          "error" in result && result.error
            ? result.error
            : "Unable to save address."
        );
        return;
      }

      setItems((current) => [...current, result.address]);
      setShowForm(false);
      setForm({
        label: `Address ${items.length + 2}`,
        unitNumber: "",
        addressLine1: "",
        addressLine2: "",
        postcode: "",
        city: "",
        state: "",
        country: "Malaysia",
      });
    });
  };

  return (
    <ProfileShell title="Saved Addresses" showBack backHref="/profile">
      <div className="space-y-4">
        {items.map((address) => (
          <div
            key={address.id}
            className="rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eff9f0] text-[#16a34a]">
                <AddressKindIcon kind={address.kind} className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-extrabold text-[#111827]">
                      {address.label}
                    </h3>
                    {address.isDefault ? (
                      <span className="rounded-full bg-[#e9f9ec] px-2 py-1 text-[11px] font-bold text-[#16a34a]">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Address options"
                    className="text-[#6b7280]"
                  >
                    <DotsVerticalIcon className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-2 text-[14px] leading-6 text-[#374151]">
                  {address.line1}
                  <br />
                  {address.line2}
                  <br />
                  {address.city}
                  {address.state ? `, ${address.state}` : ""}
                </p>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#d9e2dd] bg-white px-4 py-8 text-center text-[14px] text-[#6b7280]">
            No saved addresses yet.
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setShowForm((current) => !current)}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#3ec66d] bg-[#fbfffc] text-[15px] font-extrabold text-[#16a34a]"
      >
        <PlusIcon className="h-4 w-4" />
        {showForm ? "Hide Address Form" : "Add New Address"}
      </button>

      {showForm ? (
        <div className="mt-4 rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
          <div className="space-y-4">
            <LabeledInput label="Address Name" value={form.label} onChange={updateField("label")} icon={<PinIcon className="h-5 w-5" />} />
            <LabeledInput label="Unit Number" value={form.unitNumber} onChange={updateField("unitNumber")} icon={<PinIcon className="h-5 w-5" />} />
            <LabeledInput label="Address Line 1" value={form.addressLine1} onChange={updateField("addressLine1")} icon={<PinIcon className="h-5 w-5" />} />
            <LabeledInput label="Address Line 2" value={form.addressLine2} onChange={updateField("addressLine2")} icon={<PinIcon className="h-5 w-5" />} />
            <LabeledInput label="Postcode" value={form.postcode} onChange={updateField("postcode")} icon={<PinIcon className="h-5 w-5" />} />
            <LabeledInput label="City" value={form.city} onChange={updateField("city")} icon={<PinIcon className="h-5 w-5" />} />
            <LabeledInput label="State" value={form.state} onChange={updateField("state")} icon={<PinIcon className="h-5 w-5" />} />
            <LabeledInput label="Country" value={form.country} onChange={updateField("country")} icon={<PinIcon className="h-5 w-5" />} />
          </div>
          {error ? (
            <p className="mt-3 text-[13px] font-semibold text-[#dc2626]">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#8E5EB5] px-4 text-[15px] font-extrabold text-white disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Address"}
          </button>
        </div>
      ) : null}
    </ProfileShell>
  );
}

export function BookingsScreen({ bookings, initialTab = "all" }: BookingsProps) {
  const [items, setItems] = useState(bookings);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "custom">("all");
  const [customDate, setCustomDate] = useState("");
  const [todayFilterDate, setTodayFilterDate] = useState<Date | null>(null);

  useEffect(() => {
    setTodayFilterDate(new Date());
  }, []);

  const filtered = useMemo(() => {
    if (!todayFilterDate) {
      return items;
    }

    const todayStart = new Date(
      todayFilterDate.getFullYear(),
      todayFilterDate.getMonth(),
      todayFilterDate.getDate(),
    );
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const matchesFilter = (booking: Booking) => {
      const bookingDate = getBookingFilterDate(booking);

      if (!bookingDate) {
        return dateFilter === "all";
      }

      if (dateFilter === "today") {
        return isSameCalendarDate(bookingDate, todayStart);
      }

      if (dateFilter === "week") {
        return bookingDate >= todayStart && bookingDate <= weekEnd;
      }

      if (dateFilter === "custom") {
        if (!customDate) {
          return true;
        }

        const selectedDate = new Date(`${customDate}T00:00:00`);
        if (Number.isNaN(selectedDate.getTime())) {
          return true;
        }

        return isSameCalendarDate(bookingDate, selectedDate);
      }

      return true;
    };

    const matchesTab = (booking: Booking) => {
      if (initialTab === "all") {
        return true;
      }

      if (initialTab === "ongoing") {
        return booking.status === "ongoing";
      }

      if (initialTab === "completed") {
        return booking.status === "completed";
      }

      if (initialTab === "cancelled") {
        return booking.status === "cancelled";
      }

      return booking.status === "pending";
    };

    return [...items]
      .filter(matchesTab)
      .filter(matchesFilter)
      .sort((left, right) => getBookingSortTimestamp(right) - getBookingSortTimestamp(left));
  }, [customDate, dateFilter, initialTab, items, todayFilterDate]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    let bookingsChannel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;
    let paymentsChannel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = (callback: () => Promise<void>, delayMs = 400) => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        refreshTimeout = null;
        void callback();
      }, delayMs);
    };

    const waitForRetry = (attempt: number) =>
      new Promise((resolve) => {
        setTimeout(resolve, 350 * (attempt + 1));
      });

    async function fetchBookingsWithRetry(sessionToken: string) {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch("/api/bookings", {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          const result = (await response.json().catch(() => null)) as
            | { bookings: Booking[] }
            | { error?: string }
            | null;

          if (response.ok && result && "bookings" in result) {
            return result.bookings;
          }

          lastError = result && "error" in result ? result.error : response.statusText;
        } catch (error) {
          lastError = error;
        }

        if (attempt < 2) {
          await waitForRetry(attempt);
        }
      }

      if (lastError) {
        console.warn("[Bookings] Live bookings refresh skipped:", lastError);
      }

      return null;
    }

    async function loadLiveBookings() {
      if (!client) {
        return;
      }

      let session: Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"] = null;

      try {
        session = await getFreshSupabaseSession(client);
      } catch (error) {
        console.warn("[Bookings] Unable to read session:", error);
        return;
      }

      if (!active || !session) {
        return;
      }

      const liveBookings = await fetchBookingsWithRetry(session.access_token);

      if (!active || !liveBookings) {
        return;
      }

      setItems(liveBookings);

      if (!bookingsChannel) {
        bookingsChannel = client
          .channel(`customer-bookings-${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `customer_id=eq.${session.user.id}`,
            },
            () => {
              scheduleRefresh(loadLiveBookings);
            },
          )
          .subscribe();
      }

      if (!paymentsChannel) {
        paymentsChannel = client
          .channel(`customer-booking-payments-${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "payments",
            },
            () => {
              scheduleRefresh(loadLiveBookings);
            },
          )
          .subscribe();
      }
    }

    void loadLiveBookings();

    return () => {
      active = false;
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      if (client && bookingsChannel) {
        void client.removeChannel(bookingsChannel);
      }
      if (client && paymentsChannel) {
        void client.removeChannel(paymentsChannel);
      }
    };
  }, []);

  return (
    <ProfileShell title="My Bookings" showBack backHref="/profile">
      <div className="mt-4 space-y-4">
        <div className="rounded-[22px] border border-[#eadff8] bg-white p-4 shadow-[0_12px_28px_rgba(106,69,160,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-extrabold text-[#1f1630]">Filter by Date</p>
              <p className="mt-1 text-[12px] text-[#7b728a]">Sorted by latest booking first</p>
            </div>
            <span className="rounded-full bg-[#f5f1fa] px-3 py-1 text-[11px] font-bold text-[#8E5EB5]">
              Latest
            </span>
          </div>
          <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-hidden">
            {([
              { id: "all", label: "All" },
              { id: "today", label: "Today" },
              { id: "week", label: "This Week" },
              { id: "custom", label: "Custom Date" },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDateFilter(option.id)}
                className={`min-w-0 flex-1 truncate rounded-full px-2.5 py-1.5 text-[10px] font-extrabold transition ${
                  dateFilter === option.id
                    ? "bg-[#8E5EB5] text-white shadow-[0_12px_22px_rgba(142,94,181,0.18)]"
                    : "border border-[#e8def6] bg-white text-[#6d6480]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {dateFilter === "custom" ? (
            <div className="mt-4">
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold text-[#6d6480]">Choose date</span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className="h-11 w-full rounded-[14px] border border-[#e8def6] bg-[#fcfbfe] px-4 text-[14px] font-semibold text-[#1f1630] outline-none"
                />
              </label>
            </div>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <SharedEmptyState
            title={
              initialTab === "ongoing"
                ? "No ongoing bookings"
                : initialTab === "completed"
                  ? "No completed bookings"
                  : initialTab === "cancelled"
                    ? "No cancelled bookings"
                    : initialTab === "pending"
                      ? "No pending bookings"
                      : "No bookings yet"
            }
            description={
              initialTab === "ongoing"
                ? "Accepted and in-progress tasks will appear here until they are completed."
                : "No bookings match this filter yet. Try another filter or book a new service."
            }
            action={<AppButton href="/providers">Find Providers</AppButton>}
          />
        ) : null}
        {filtered.map((booking) => (
          <div
            key={booking.id}
            className="rounded-[28px] border border-[#eadff8] bg-white px-4 py-4 shadow-[0_18px_38px_rgba(106,69,160,0.1)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="relative h-[4.9rem] w-[4.9rem] shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#f5eefc] shadow-[0_14px_24px_rgba(106,69,160,0.14)]">
                  {booking.providerAvatarUrl || booking.imageSrc ? (
                    <Image
                      src={booking.providerAvatarUrl || booking.imageSrc || ""}
                      alt={booking.providerFullName || booking.provider}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#8E5EB5_0%,#6b39c5_100%)] text-[1.2rem] font-black text-white">
                      {providerNameInitials(booking.providerFullName || booking.provider)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[1.15rem] font-black leading-[1.08] tracking-[-0.04em] text-[#181538]">
                    {booking.providerFullName || booking.provider}
                  </p>
                  <p className="mt-1 text-[12px] font-medium leading-5 text-[#7b728a]">
                    {booking.service}
                  </p>
                </div>
              </div>
              <BookingStatusPill label={booking.statusLabel} tone={bookingTone(booking)} />
            </div>

            <div className="mt-4 w-full overflow-hidden rounded-[22px] border border-[#efe5fb] bg-white shadow-[0_8px_18px_rgba(106,69,160,0.04)]">
              <div className="flex items-start gap-3 px-4 py-3 text-[#2d274f]">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f6effd] text-[#8E5EB5]">
                  <CalendarIcon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 pt-0.5 text-left text-[12px] font-semibold leading-6">
                  {booking.schedule}
                </span>
              </div>
              <div className="h-px bg-[#f1e8fb]" />
              <div className="flex items-start gap-3 px-4 py-3 text-[#2d274f]">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f6effd] text-[#8E5EB5]">
                  <PinIcon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 pt-0.5 text-left text-[12px] font-semibold leading-7">
                  {booking.location}
                </span>
              </div>
              <div className="h-px bg-[#f1e8fb]" />
              <div className="flex items-center gap-3 px-4 py-3 text-[#2d274f]">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f6effd] text-[#8E5EB5]">
                  <WalletIcon className="h-4.5 w-4.5" />
                </span>
                <span className="text-[1rem] font-black tracking-[-0.03em] text-[#161233]">
                  {formatBookingAmount(booking.paymentAmount)}
                </span>
              </div>
            </div>

            <Link
              href={`/profile/bookings/${booking.id}`}
              className="mt-4 flex h-[3.45rem] w-full items-center justify-between rounded-[19px] bg-[linear-gradient(135deg,#8f40ff_0%,#702cf0_55%,#5a20c9_100%)] px-5 text-[0.95rem] font-extrabold text-white shadow-[0_16px_30px_rgba(91,33,182,0.26)]"
            >
              <span className="pl-1">Track Task</span>
              <ChevronRightIcon className="h-4.5 w-4.5" />
            </Link>

            {booking.status === "cancelled" ? (
              <div className="mt-3 space-y-1.5 rounded-[14px] border border-[#f0e8f8] bg-[#fcfaff] px-3 py-2.5 text-[12px] leading-5 text-[#544b66]">
                <p>
                  <span className="font-extrabold text-[#1f1630]">Cancelled by:</span>{" "}
                  {booking.cancelledBy ?? "Not specified"}
                </p>
                <p>
                  <span className="font-extrabold text-[#1f1630]">Reason:</span>{" "}
                  {booking.cancellationReason ?? "No reason shared."}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ProfileShell>
  );
}

function BookingStatusSummary({ booking }: { booking: Booking }) {
  const currentStep =
    booking.activitySteps?.find((step) => step.status === "current") ??
    booking.activitySteps?.find((step) => step.status === "done") ??
    null;
  const { title, description } = describeBookingStatus(booking);

  return (
    <div className="mt-4 rounded-[20px] border border-[#eee5fb] bg-[linear-gradient(180deg,#faf6ff_0%,#fffefe_100%)] p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#dcc7f7] bg-[#f3e8ff] text-[#7c3aed] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <CheckCircleIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-black text-[#7c3aed]">
            {currentStep?.label || title}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#6d6480]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function BookingStatusPill({
  label,
  tone,
}: {
  label: string;
  tone: ReturnType<typeof bookingTone>;
}) {
  const toneClass =
    tone === "completed"
      ? "border-[#b9efe0] bg-[#e8fbf4] text-[#118c69]"
      : tone === "accepted"
        ? "border-[#d9c7ef] bg-[#f6effd] text-[#7c3aed]"
        : tone === "pending"
          ? "border-[#fde2b8] bg-[#fff4df] text-[#d97706]"
          : tone === "declined" || tone === "cancelled"
            ? "border-[#f6caca] bg-[#fff1f1] text-[#dc2626]"
            : "border-[#d8e1f1] bg-[#f4f7fb] text-[#64748b]";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${toneClass}`}
    >
      {tone === "completed" ? <CheckCircleIcon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </span>
  );
}

function describeBookingStatus(booking: Booking) {
  switch (booking.workflowStatus) {
    case "pending_provider_response":
      return {
        title: "Booking Sent",
        description: "Waiting for provider response.",
      };
    case "accepted":
      return {
        title: "Provider Accepted",
        description: "Your booking has been accepted by the provider.",
      };
    case "on_the_way":
      return {
        title: "Provider On The Way",
        description: "The provider is on the way to your location.",
      };
    case "arrived":
      return {
        title: "Provider Arrived",
        description: "The provider has arrived and is ready to start.",
      };
    case "work_finished_by_provider":
      return {
        title: "Confirm Work Completion",
        description: "Review the task and confirm the provider has finished.",
      };
    case "work_confirmed_by_user":
      return {
        title: "Waiting Final Payment",
        description: "Send the final payment so the task can be closed.",
      };
    case "final_payment_sent":
    case "cash_paid_by_user":
      return {
        title: "Payment Sent",
        description: "Payment was sent and is waiting for provider confirmation.",
      };
    case "payment_received_by_provider":
    case "completed":
    case "paid":
    case "review_requested":
    case "reviewed":
      return {
        title: "Task Completed",
        description: "This booking has been completed successfully.",
      };
    case "declined":
    case "declined_by_provider":
      return {
        title: "Booking Declined",
        description: "The provider declined this booking request.",
      };
    case "cancelled":
      return {
        title: "Booking Cancelled",
        description: "This booking was cancelled.",
      };
    default:
      return {
        title: booking.statusLabel,
        description: "Track this booking to view the latest progress.",
      };
  }
}

function CompactTaskPath({
  steps,
}: {
  steps: Array<{ label: string; status: "done" | "current" | "pending" }>;
}) {
  return (
    <div className="rounded-[16px] border border-[#f0e6fb] bg-white px-3 py-3">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
        Task Path
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                step.status === "done"
                  ? "bg-[#eadcf7] text-[#7f47a7]"
                  : step.status === "current"
                    ? "bg-[#8E5EB5] text-white"
                    : "bg-white text-[#94a3b8] ring-1 ring-[#ebe3f5]"
              }`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="text-[10px] font-bold text-[#c4b5d8]">&gt;</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen({ groups }: SettingsProps) {
  const router = useRouter();
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = () => {
    startLogoutTransition(async () => {
      setLogoutError("");
      const client = getSupabaseClient();

      if (!client) {
        await signOutLocally(null);
        router.replace("/login");
        router.refresh();
        return;
      }

      await signOutLocally(client);
      router.replace("/login");
      router.refresh();
    });
  };

  return (
    <ProfileShell title="Settings" showBack backHref="/profile" showBottomNav>
      <div className="space-y-4">
        <LocationSettingsCard />
        {logoutError ? (
          <p className="rounded-[14px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
            {logoutError}
          </p>
        ) : null}
        {groups.map((group) => (
          <SectionCard key={group.title} title={group.title}>
            {group.items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={item.id === "logout" ? handleLogout : undefined}
                disabled={item.id === "logout" ? isLoggingOut : false}
                className={`flex w-full items-center justify-between gap-3 py-4 text-left text-[14px] ${
                  index > 0 ? "border-t border-[#edf1ef]" : ""
                } disabled:opacity-60`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                      item.tone === "danger"
                        ? "bg-[#fff1f1] text-[#ef4444]"
                        : "bg-[#eff9f0] text-[#16a34a]"
                    }`}
                  >
                    <SettingIcon name={item.icon} className="h-4 w-4" />
                  </span>
                  <span
                    className={`font-medium ${
                      item.tone === "danger" ? "text-[#ef4444]" : "text-[#111827]"
                    }`}
                  >
                    {item.id === "logout" && isLoggingOut ? "Logging out..." : item.label}
                  </span>
                </div>
                <ChevronRightIcon className="h-4 w-4 text-[#6b7280]" />
              </button>
            ))}
          </SectionCard>
        ))}
      </div>
    </ProfileShell>
  );
}

export function BookingDetailScreen({ booking }: BookingDetailProps) {
  const router = useRouter();
  const paymentQuery = useClientSearchParam("payment");
  const [paymentError, setPaymentError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [paymentLoading, startPaymentTransition] = useTransition();
  const [paymentProofCropState, setPaymentProofCropState] = useState<{
    sourceDataUrl: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState("");
  const [paymentProofFileName, setPaymentProofFileName] = useState("");
  const [paymentProofMimeType, setPaymentProofMimeType] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [reportSubmitting, startReportTransition] = useTransition();
  const paymentMarkedPaid =
    booking.paymentStatus === "paid" ||
    ["cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus);
  const canPayNow = booking.workflowStatus === "final_payment_sent" && !paymentMarkedPaid;
  const canReview =
    ["cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus) &&
    booking.userReviewStatus !== "submitted";
  const paidDateLabel =
    paymentMarkedPaid
      ? "Payment Done"
      : canPayNow
      ? "Awaiting Customer Payment"
      : booking.status === "ongoing"
        ? "Payment Pending"
        : canReview
            ? "Task Completed"
            : "Awaiting Payment";
  const confirmedDate = formatStepDate(booking.acceptedAt || booking.createdAt);
  const confirmedTime = formatStepTime(booking.acceptedAt || booking.createdAt);
  const onTheWayDate = formatStepDate(booking.onTheWayAt);
  const onTheWayTime = formatStepTime(booking.onTheWayAt);
  const arrivedDate = formatStepDate(booking.arrivedAt);
  const arrivedTime = formatStepTime(booking.arrivedAt);
  const workFinishedDate = formatStepDate(booking.workFinishedAt);
  const workFinishedTime = formatStepTime(booking.workFinishedAt);
  const workConfirmedDate = formatStepDate(booking.workConfirmedByUserAt);
  const workConfirmedTime = formatStepTime(booking.workConfirmedByUserAt);
  const paymentSentDate = formatStepDate(booking.paymentSentAt);
  const paymentSentTime = formatStepTime(booking.paymentSentAt);
  const cashPaidDate = formatStepDate(booking.cashPaidByUserAt || booking.paidAt);
  const cashPaidTime = formatStepTime(booking.cashPaidByUserAt || booking.paidAt);
  const paymentReceivedDate = formatStepDate(booking.paymentReceivedByProviderAt);
  const paymentReceivedTime = formatStepTime(booking.paymentReceivedByProviderAt);
  const completedDate = formatStepDate(booking.completedAt);
  const completedTime = formatStepTime(booking.completedAt);
  const stepState = {
    confirmed:
      ["accepted", "on_the_way", "arrived", "work_finished_by_provider", "work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus)
        ? "done"
        : booking.workflowStatus === "pending_provider_response"
          ? "current"
          : "waiting",
    onTheWay:
      ["on_the_way", "arrived", "work_finished_by_provider", "work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus)
        ? "done"
        : booking.workflowStatus === "accepted"
          ? "current"
          : "waiting",
    arrived:
      ["arrived", "work_finished_by_provider", "work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus)
        ? "done"
        : booking.workflowStatus === "on_the_way"
          ? "current"
          : "waiting",
    workFinished:
      ["work_finished_by_provider", "work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus)
        ? "done"
        : booking.workflowStatus === "arrived"
          ? "current"
          : "waiting",
    workConfirmed:
      booking.workflowStatus === "work_finished_by_provider"
        ? "current"
        : ["work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus)
          ? "done"
          : "waiting",
    paymentRequest:
      booking.workflowStatus === "final_payment_sent" && !paymentMarkedPaid
        ? "current"
        : ["cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus)
          ? "done"
          : "waiting",
    cashPaid:
      booking.workflowStatus === "cash_paid_by_user"
        ? "current"
        : ["payment_received_by_provider", "completed"].includes(booking.workflowStatus)
          ? "done"
          : "waiting",
    providerPaymentConfirmation:
      booking.workflowStatus === "cash_paid_by_user"
        ? "current"
        : ["payment_received_by_provider", "completed"].includes(booking.workflowStatus)
          ? "done"
          : "waiting",
    completed:
      ["cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus)
        ? "done"
        : "waiting",
    review:
      booking.workflowStatus === "completed" && booking.userReviewStatus !== "submitted"
        ? "current"
        : booking.userReviewStatus === "submitted"
          ? "done"
          : "waiting",
  } as const;

  useEffect(() => {
    if (paymentQuery === "success") {
      setPaymentNotice("Cash payment confirmed successfully.");
    }
  }, [paymentQuery]);

  function handleCashPaid() {
    const client = getSupabaseClient();

    startPaymentTransition(async () => {
      setPaymentError("");
      setPaymentNotice("");

      if (!client) {
        setPaymentError("Supabase is not configured yet.");
        return;
      }

      const session = await getFreshSupabaseSession(client);

      if (!session) {
        setPaymentError("Your session expired. Please log in again.");
        return;
      }

      const response = await fetch(`/api/bookings/${booking.id}/cash-pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          proofDataUrl: paymentProofDataUrl,
          proofFileName: paymentProofFileName,
          proofMimeType: paymentProofMimeType,
        }),
      }).catch(() => null);

      const result = response
        ? ((await response.json().catch(() => ({}))) as { success?: boolean; error?: string })
        : null;

      if (!response || !response.ok || !result?.success) {
        setPaymentError(result?.error || "Unable to confirm cash payment.");
        return;
      }

      setPaymentNotice("Cash payment confirmed successfully.");
      router.replace(`/profile/bookings/${booking.id}/review?payment=success`);
      router.refresh();
    });
  }

  async function handlePaymentProofChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      setPaymentError("Payment proof must be 5MB or smaller.");
      return;
    }

    if (!isPaymentProofMimeType(file.type)) {
      setPaymentError("Payment proof must be JPG, PNG, GIF, WebP, or PDF.");
      return;
    }

    try {
      const dataUrl = await readPaymentProofAsDataUrl(file);
      if (file.type === "application/pdf") {
        setPaymentProofDataUrl(dataUrl);
        setPaymentProofFileName(file.name);
        setPaymentProofMimeType(file.type);
      } else {
        setPaymentProofCropState({
          sourceDataUrl: dataUrl,
          fileName: file.name,
          mimeType: file.type,
        });
      }
      setPaymentError("");
    } catch {
      setPaymentError("Unable to read the payment proof file.");
    }
  }

  function handleReportIssue() {
    setReportOpen(true);
    setReportError("");
    setReportNotice("");
  }

  function submitIssueReport() {
    const client = getSupabaseClient();

    startReportTransition(async () => {
      setReportError("");
      setReportNotice("");

      if (!client) {
        setReportError("Supabase is not configured yet.");
        return;
      }

      const session = await getFreshSupabaseSession(client);

      if (!session) {
        setReportError("Your session expired. Please log in again.");
        return;
      }

      if (!reportMessage.trim()) {
        setReportError("Please describe the issue before sending.");
        return;
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          bookingTitle: `${booking.service} - ${booking.providerFullName || booking.provider}`,
          providerName: booking.providerFullName || booking.provider,
          schedule: booking.schedule,
          location: booking.location,
          paymentAmount: booking.paymentAmount ?? 0,
          paymentMethod: booking.paymentMethod ?? "Cash",
          message: reportMessage,
        }),
      }).catch(() => null);

      const result = response
        ? ((await response.json().catch(() => ({}))) as { success?: boolean; error?: string })
        : null;

      if (!response || !response.ok || !result?.success) {
        setReportError(result?.error || "Unable to send the report right now.");
        return;
      }

      setReportOpen(false);
      setReportMessage("");
      setReportNotice("Issue report sent successfully. Admin will receive it in reports.");
    });
  }

  return (
    <ProfileShell title="User Task Path" showBack backHref="/profile/bookings">
      <div className="rounded-[28px] border border-[#ebe2f8] bg-white p-5 text-center shadow-[0_20px_48px_rgba(106,69,160,0.08)]">
        <p className="text-[1.15rem] font-black tracking-[0.2em] text-[#8E5EB5]">DELLA</p>
        <h2 className="mt-2 text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">USER TASK PATH</h2>
        <p className="mt-2 text-[14px] text-[#6d6480]">Track service, pay cash, and complete the job</p>
      </div>

      <div className="mt-4 space-y-4">
        <StepTimelineCard number={1} title="Booking Sent" state="done" dateLabel={formatStepDate(booking.createdAt)} timeLabel={formatStepTime(booking.createdAt)} />
        <StepTimelineCard number={2} title="Provider Accepted" state={stepState.confirmed} dateLabel={confirmedDate} timeLabel={confirmedTime} />
        <StepTimelineCard number={3} title="Provider On The Way" state={stepState.onTheWay} dateLabel={onTheWayDate} timeLabel={onTheWayTime} />
        <StepTimelineCard number={4} title="Provider Arrived" state={stepState.arrived} dateLabel={arrivedDate} timeLabel={arrivedTime} />
        <StepTimelineCard
          number={5}
          title="Job Completed by Provider"
          state={stepState.workFinished}
          dateLabel={workFinishedDate || workConfirmedDate}
          timeLabel={workFinishedTime || workConfirmedTime}
        />
        <StepTimelineCard
          number={6}
          title="Payment Requested"
          state={stepState.paymentRequest}
          dateLabel={paymentSentDate}
          timeLabel={paymentSentTime}
          description="Provider has sent the final payment."
          expanded={stepState.paymentRequest === "current" || stepState.paymentRequest === "done"}
        >
          {booking.workFinishedImages && booking.workFinishedImages.length > 0 ? (
            <div className="mb-4">
              <p className="text-[14px] font-black text-[#24193a]">
                Completion Images ({booking.workFinishedImages.length})
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {booking.workFinishedImages.slice(0, 3).map((image, index) => (
                  <a
                    key={`${booking.id}-user-work-photo-${index}`}
                    href={image}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-[4/3] overflow-hidden rounded-[12px] border border-[#ebe2f8] bg-[#f8f5fc]"
                  >
                    {isPdfDataUrl(image) ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-[#8E5EB5]">
                        <span className="rounded-full border border-current px-3 py-1 text-[11px] font-extrabold">PDF</span>
                        <span className="text-[12px] font-semibold">Proof file {index + 1}</span>
                      </div>
                    ) : (
                      <img src={image} alt={`Job photo ${index + 1}`} className="h-full w-full object-cover" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="min-w-0 rounded-[20px] border border-[#ebe2f8] bg-white p-3 sm:p-4">
            <p className="text-[15px] font-black text-[#8E5EB5]">Payment Summary</p>
            <div className="mt-4 space-y-3 text-[14px] text-[#24193a]">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span>Fixed Amount</span>
                <span className="shrink-0 font-semibold">RM {booking.baseAmount ?? booking.paymentAmount ?? 0}</span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span>Additional Amount</span>
                <span className="shrink-0 font-semibold">RM {booking.additionalCharge ?? 0}</span>
              </div>
              <div className="min-w-0 rounded-[16px] bg-[#faf6ff] px-3 py-3 sm:px-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8E5EB5]">Description</p>
                <p className="mt-2 text-[13px] leading-6 text-[#4c4561]">
                  {booking.additionalChargeDescription || booking.paymentNote || "No additional description provided."}
                </p>
              </div>
              <div className="border-t border-dashed border-[#ddd4ea] pt-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="text-[1rem] font-black text-[#8E5EB5]">Total Amount</span>
                  <span className="shrink-0 text-[1.25rem] font-black text-[#8E5EB5] sm:text-[1.6rem]">RM {booking.paymentAmount ?? 0}</span>
                </div>
              </div>
            </div>
            {canPayNow ? (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleCashPaid}
                  disabled={paymentLoading}
                  className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-[#8E5EB5] text-[16px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.24)] disabled:opacity-70"
                >
                  {paymentLoading ? "Paying..." : "Pay by Cash"}
                </button>
                <label className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-[16px] border border-dashed border-[#cdb3eb] bg-[#fcfaff] text-[14px] font-extrabold text-[#8E5EB5]">
                  Upload Payment Proof
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,application/pdf,image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(event) => void handlePaymentProofChange(event)}
                  />
                </label>
                <div className="mt-3 grid grid-cols-4 gap-3">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[12px] border border-[#e7dcf7] bg-white px-2 text-center text-[20px] font-semibold text-[#8E5EB5]">
                    {paymentProofDataUrl ? (
                      isPdfProof(paymentProofMimeType, paymentProofFileName) ? (
                        <span className="text-[12px] font-extrabold">PDF</span>
                      ) : (
                        <img src={paymentProofDataUrl} alt={paymentProofFileName || "Payment proof"} className="h-full w-full object-cover" />
                      )
                    ) : (
                      "+"
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </StepTimelineCard>
        <StepTimelineCard number={7} title="Paid by Cash" state={stepState.cashPaid} dateLabel={cashPaidDate} timeLabel={cashPaidTime} />
        <StepTimelineCard number={8} title="Waiting Provider Payment Confirmation" state={stepState.providerPaymentConfirmation} dateLabel={paymentReceivedDate} timeLabel={paymentReceivedTime} />
        <StepTimelineCard number={9} title="Task Completed" state={stepState.completed} dateLabel={completedDate} timeLabel={completedTime} />
        <StepTimelineCard
          number={10}
          title="Optional Review Provider"
          state={stepState.review}
          dateLabel={completedDate}
          timeLabel={completedTime}
          description="Review popup will appear after both sides complete the job. You can add photos while submitting your review."
          expanded={canReview}
        >
          {canReview ? (
            <Link
              href={`/profile/bookings/${booking.id}/review`}
              className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-[#8E5EB5] text-[16px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.24)]"
            >
              Review This Service
            </Link>
          ) : null}
        </StepTimelineCard>
      </div>

      <section id="task-messages" className="mt-4">
        <BookingMessagesPanel
          role="customer"
          basePath="/profile/messages"
          fixedBookingId={booking.id}
          hideThreadList
          hideOpenBookingLink
          emptyTitle="No messages yet"
          emptyDescription="Send a message to this provider without leaving the task screen."
          emptyActionHref="/profile/bookings"
          emptyActionLabel="Open My Bookings"
          theme={{
            accentText: "text-[#8E5EB5]",
            accentBg: "bg-[#8E5EB5]",
            accentSoftBg: "bg-[#faf5ff]",
            accentBorder: "border-[#d9c5f1]",
            badgeBg: "bg-[#f5f1fa]",
            badgeText: "text-[#8E5EB5]",
            ownBubble: "bg-[#8E5EB5]",
            ownBubbleText: "text-white",
            otherBubble: "bg-[#f7f4fb]",
            otherBubbleText: "text-[#24193a]",
            threadUnreadBorder: "border-[#d9c5f1]",
            threadUnreadBg: "bg-[#fcf8ff]",
            composerButton: "bg-[#8E5EB5]",
          }}
        />
      </section>

      <PaymentProofPreview
        title="Customer Payment Proof"
        dataUrl={booking.customerPaymentProofDataUrl}
        fileName={booking.customerPaymentProofFileName}
        mimeType={booking.customerPaymentProofMimeType}
      />

      <PaymentProofPreview
        title="Provider Company Payment Proof"
        dataUrl={booking.providerCompanyPaymentProofDataUrl}
        fileName={booking.providerCompanyPaymentProofFileName}
        mimeType={booking.providerCompanyPaymentProofMimeType}
      />

      <section className="mt-4 rounded-[24px] border border-[#ebe2f8] bg-white p-4 shadow-[0_14px_30px_rgba(106,69,160,0.07)]">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
          Payment Summary
        </p>
        <div className="mt-4 space-y-3 text-[13px] text-[#4f4663]">
          <SummaryRow label="Service Charges" value={`RM${booking.baseAmount ?? booking.paymentAmount ?? 0}`} />
          <SummaryRow label="Service Fee" value={typeof booking.additionalCharge === "number" ? `RM${booking.additionalCharge}` : "RM0"} />
          <SummaryRow label="Payment Method" value={booking.paymentMethod ?? "Cash"} />
          <div className="border-t border-[#efe6fb] pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-black text-[#24193a]">Total Paid</p>
              <p className="text-[22px] font-black text-[#8E5EB5]">RM{booking.paymentAmount ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-[16px] border border-[#d7efdb] bg-[#effbf1] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#22c55e] text-white">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-bold text-[#1f4d2b]">{paidDateLabel}</p>
              <p className="text-[11px] text-[#5f7d67]">{booking.schedule}</p>
            </div>
          </div>
        </div>
        {booking.additionalChargeDescription ? (
          <div className="mt-4 border-t border-[#efe6fb] pt-3">
            <p className="text-[13px] font-semibold text-[#111827]">
              Additional Charge Description
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#374151]">
              {booking.additionalChargeDescription}
            </p>
          </div>
        ) : null}
        {booking.paymentNote ? (
          <div className="mt-4 border-t border-[#efe6fb] pt-3">
            <p className="text-[13px] font-semibold text-[#111827]">
              Provider Payment Note
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#374151]">
              {booking.paymentNote}
            </p>
          </div>
        ) : null}
      </section>

      {paymentError ? (
        <p className="mt-4 rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
          {paymentError}
        </p>
      ) : null}

      {reportError ? (
        <p className="mt-4 rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
          {reportError}
        </p>
      ) : null}

      {paymentNotice || reportNotice || paymentQuery === "success" ? (
        <p className="mt-4 rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
          {paymentNotice || reportNotice || "Cash payment confirmed successfully."}
        </p>
      ) : null}

      {booking.status === "cancelled" ? (
        <SectionCard title="Cancellation Details">
          <ProfileInfoRow
            icon={<CloseCircleIcon className="h-4 w-4" />}
            label="Cancelled By"
            value={booking.cancelledBy ?? "Not specified"}
          />
          <div className="border-t border-[#edf1ef] pt-3">
            <p className="text-[13px] font-semibold text-[#111827]">Reason</p>
            <p className="mt-2 text-[14px] leading-6 text-[#374151]">
              {booking.cancellationReason ?? "No cancellation reason shared."}
            </p>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Booking Details">
        <ProfileInfoRow
          icon={<CalendarIcon className="h-4 w-4" />}
          label="Date & Time"
          value={booking.schedule}
        />
        <ProfileInfoRow
          icon={<WalletIcon className="h-4 w-4" />}
          label="Rates"
          value={`Base RM ${booking.baseAmount ?? booking.paymentAmount ?? 0} / Total RM ${booking.paymentAmount ?? 0}`}
        />
        <ProfileInfoRow
          icon={<PinIcon className="h-4 w-4" />}
          label="Location"
          value={booking.location}
        />
        <ProfileInfoRow
          icon={<WalletIcon className="h-4 w-4" />}
          label="Booking ID"
          value={booking.id}
        />
      </SectionCard>

      <section className="mt-3 rounded-[18px] border border-[#ebe2f8] bg-white px-3 py-3 shadow-[0_10px_22px_rgba(106,69,160,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#24193a]">Report an Issue</p>
            <p className="mt-0.5 text-[11px] leading-5 text-[#6d6480]">
              Send this task details to admin and describe the issue you are facing.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReportIssue}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-[12px] bg-[#fff1f2] px-3 text-[12px] font-bold text-[#dc2626]"
          >
            Report
          </button>
        </div>
      </section>

      {reportOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1f1630]/45 px-4 py-6 sm:items-center">
          <div className="w-full max-w-[430px] rounded-[28px] bg-white p-5 shadow-[0_24px_48px_rgba(31,22,48,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-black tracking-[-0.03em] text-[#24193a]">
                  Report an Issue
                </p>
                <p className="mt-1 text-[13px] text-[#6d6480]">
                  Task details are included below for admin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f1fa] text-[#8E5EB5]"
              >
                <CloseCircleIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-[18px] border border-[#ebe2f8] bg-[#fcf9ff] p-4 text-[13px] text-[#374151]">
              <p><span className="font-bold text-[#24193a]">Task:</span> {booking.service}</p>
              <p className="mt-2"><span className="font-bold text-[#24193a]">Provider:</span> {booking.providerFullName || booking.provider}</p>
              <p className="mt-2"><span className="font-bold text-[#24193a]">Booking ID:</span> {booking.id}</p>
              <p className="mt-2"><span className="font-bold text-[#24193a]">Schedule:</span> {booking.schedule}</p>
              <p className="mt-2"><span className="font-bold text-[#24193a]">Location:</span> {booking.location}</p>
              <p className="mt-2"><span className="font-bold text-[#24193a]">Payment:</span> RM{booking.paymentAmount ?? 0} • {booking.paymentMethod ?? "Cash"}</p>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-[13px] font-bold text-[#24193a]">Describe the issue</span>
              <textarea
                value={reportMessage}
                onChange={(event) => setReportMessage(event.target.value)}
                rows={5}
                className="w-full rounded-[18px] border border-[#d9c7ef] bg-white px-4 py-3 text-[14px] leading-6 text-[#24193a] outline-none"
                placeholder="Explain what happened with this task..."
              />
            </label>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-[16px] border border-[#d9c7ef] bg-white text-[14px] font-bold text-[#8E5EB5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitIssueReport}
                disabled={reportSubmitting}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-[16px] bg-[#8E5EB5] text-[14px] font-bold text-white shadow-[0_16px_30px_rgba(142,94,181,0.24)] disabled:opacity-70"
              >
                {reportSubmitting ? "Sending..." : "Send to Admin"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentProofCropState ? (
        <ImageCropModal
          imageDataUrl={paymentProofCropState.sourceDataUrl}
          tone="work"
          onClose={() => setPaymentProofCropState(null)}
          onApply={async (selection) => {
            try {
              const croppedImage = await cropImageFromSelection(
                paymentProofCropState.sourceDataUrl,
                selection,
              );
              setPaymentProofDataUrl(croppedImage);
              setPaymentProofFileName(paymentProofCropState.fileName);
              setPaymentProofMimeType(paymentProofCropState.mimeType);
              setPaymentProofCropState(null);
              setPaymentError("");
            } catch (cropError) {
              setPaymentError(
                cropError instanceof Error
                  ? cropError.message
                  : "Unable to crop the payment proof image.",
              );
            }
          }}
        />
      ) : null}

    </ProfileShell>
  );
}

export function BookingReviewScreen({ booking }: BookingReviewProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [reviewPhotoCropState, setReviewPhotoCropState] = useState<{
    sourceDataUrl: string;
    remaining: string[];
  } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recommend, setRecommend] = useState(true);
  const router = useRouter();
  const reviewTags = ["Punctual", "Professional", "Friendly", "Quality", "Clean & Tidy"];

  async function submitReview() {
    const client = getSupabaseClient();

    if (!client) {
      setError("Supabase is not configured yet.");
      return;
    }

    const session = await getFreshSupabaseSession(client);

    if (!session) {
      setError("Your session expired. Please log in again.");
      return;
    }

    if (rating < 1) {
      setError("Please choose a rating before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/bookings/${booking.id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        rating,
        comment,
        photos,
        tags: selectedTags,
        recommend,
      }),
    }).catch(() => null);

    if (!response) {
      setError("Unable to reach the server. Please try again.");
      setSubmitting(false);
      return;
    }

    const result = (await response.json().catch(() => ({}))) as {
      success?: true;
      error?: string;
    };

    if (!response.ok || !result.success) {
      setError(result.error || "Unable to submit review.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
    window.setTimeout(() => {
      router.replace(`/profile/bookings/${booking.id}`);
      router.refresh();
    }, 700);
  }

  return (
    <ProfileShell title="Review" showBack backHref={`/profile/bookings/${booking.id}`}>
      <div className="rounded-[24px] border border-[#ebe2f8] bg-white p-5 text-center shadow-[0_16px_34px_rgba(106,69,160,0.08)]">
        <div className="mx-auto flex w-fit flex-col items-center">
          <div className="rounded-[20px] border border-[#f1e7fb] bg-[#fffdfd] p-1">
            <BookingThumb
              kind={booking.thumbnail}
              imageSrc={booking.imageSrc}
              avatarSrc={booking.providerAvatarUrl}
              service={booking.service}
              providerName={booking.provider}
            />
          </div>
          <p className="mt-4 text-[14px] font-bold text-[#1f1630]">
            How was your experience with
          </p>
          <h2 className="mt-1 text-[20px] font-black text-[#1f1630]">
            {booking.provider}?
          </h2>
          <p className="mt-1 text-[13px] text-[#7f7692]">{booking.service}</p>
        </div>
      </div>

      <SectionCard title="Rate your experience">
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="text-[#8E5EB5]"
              aria-label={`Rate ${value} stars`}
            >
              <StarIcon
                className={`h-8 w-8 ${
                  value <= rating ? "fill-current text-[#8E5EB5]" : "text-[#d0d5dd]"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[13px] text-[#6b7280]">
          {rating > 0 ? "Excellent" : "Tap a star to rate this service."}
        </p>
      </SectionCard>

      <SectionCard title="What did you like?">
        <p className="mb-3 text-[12px] text-[#7f7692]">Select all that apply</p>
        <div className="grid grid-cols-2 gap-2">
          {reviewTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTags((current) =>
                    active ? current.filter((item) => item !== tag) : [...current, tag],
                  )
                }
                className={`rounded-[10px] px-3 py-2 text-[12px] font-bold ${
                  active
                    ? "bg-[#8E5EB5] text-white"
                    : "bg-white text-[#8E5EB5] ring-1 ring-[#e8daf7]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Write your review (optional)">
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Great service! Very professional and the food was amazing."
          maxLength={200}
          className="min-h-[8rem] w-full rounded-[16px] border border-[#e7dcf7] px-4 py-3 text-[14px] text-[#111827] outline-none"
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#9a90ac]">
          <span>Share your experience</span>
          <span>{comment.length}/200</span>
        </div>
      </SectionCard>

      <SectionCard title="Add Photos (Optional)">
        <label className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-[16px] border border-dashed border-[#cdb3eb] bg-[#fcfaff] text-[14px] font-extrabold text-[#8E5EB5]">
          Upload Review Photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []).slice(0, 4);
              event.target.value = "";
              void Promise.all(files.map((file) => readPaymentProofAsDataUrl(file)))
                .then((items) => {
                  if (items.length === 0) {
                    return;
                  }

                  setPhotos([]);
                  setReviewPhotoCropState({
                    sourceDataUrl: items[0],
                    remaining: items.slice(1),
                  });
                  setError("");
                })
                .catch(() => setError("Unable to read review photos."));
            }}
          />
        </label>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {(photos.length > 0 ? photos : ["+", "+", "+", "+"]).map((photo, index) => (
            <div
              key={`${photo}-${index}`}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-[12px] border border-[#e7dcf7] bg-white px-2 text-center text-[20px] font-semibold text-[#8E5EB5]"
            >
              {photo.startsWith("data:image/") ? (
                <img src={photo} alt={`Review photo ${index + 1}`} className="h-full w-full object-cover" />
              ) : (
                photo
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recommend Provider">
        <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#eee5f7] bg-[#fcfaff] px-4 py-3">
          <div>
            <p className="text-[14px] font-bold text-[#1f1630]">Recommend this service</p>
            <p className="mt-1 text-[12px] text-[#7b728a]">Help other users choose with confidence.</p>
          </div>
          <button
            type="button"
            onClick={() => setRecommend((current) => !current)}
            className={`relative h-8 w-14 rounded-full ${recommend ? "bg-[#8E5EB5]" : "bg-[#d7d0e3]"}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                recommend ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </SectionCard>

      {reviewPhotoCropState ? (
        <ImageCropModal
          imageDataUrl={reviewPhotoCropState.sourceDataUrl}
          tone="work"
          onClose={() => setReviewPhotoCropState(null)}
          onApply={async (selection) => {
            try {
              const croppedImage = await cropImageFromSelection(
                reviewPhotoCropState.sourceDataUrl,
                selection,
              );
              setPhotos((current) => [...current, croppedImage]);
              setReviewPhotoCropState(
                reviewPhotoCropState.remaining.length > 0
                  ? {
                      sourceDataUrl: reviewPhotoCropState.remaining[0],
                      remaining: reviewPhotoCropState.remaining.slice(1),
                    }
                  : null,
              );
              setError("");
            } catch (cropError) {
              setError(
                cropError instanceof Error
                  ? cropError.message
                  : "Unable to crop the review image.",
              );
            }
          }}
        />
      ) : null}

      {submitted ? (
        <p className="mt-4 text-center text-[13px] font-semibold text-[#16a34a]">
          Review submitted successfully.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-center text-[13px] font-semibold text-[#dc2626]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void submitReview()}
        disabled={submitting}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-[#8E5EB5] text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.24)] disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </ProfileShell>
  );
}

export function PaymentsScreen({ payments }: PaymentsProps) {
  const [items, setItems] = useState(payments);
  const [filterMode, setFilterMode] = useState<"month" | "custom">("month");
  const [todayIso, setTodayIso] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const resolvedTodayIso = getTodayIso();
    const initial = new Date();
    initial.setDate(initial.getDate() - 90);

    setTodayIso(resolvedTodayIso);
    setSelectedMonth((current) => current || resolvedTodayIso.slice(0, 7));
    setDateFrom((current) => current || (initial.toISOString().split("T")[0] ?? ""));
    setDateTo((current) => current || resolvedTodayIso);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLivePayments() {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      let session: Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"] = null;

      try {
        session = await getFreshSupabaseSession(client);
      } catch {
        return;
      }

      if (!active || !session) {
        return;
      }

      const { response, result } = await fetchJsonWithRetry<
        | { payments: PaymentHistoryItem[] }
        | { error?: string }
      >("/api/profile/payments", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => ({ response: null, result: null }));

      if (!active || !response?.ok || !result || !("payments" in result)) {
        return;
      }

      setItems(result.payments);
    }

    void loadLivePayments();

    return () => {
      active = false;
    };
  }, []);

  const availableMonths = useMemo(() => {
    const months = Array.from(
      new Set(
        items
          .map((payment) => {
            const paidDate = new Date(payment.paidAt);
            if (Number.isNaN(paidDate.getTime())) {
              return null;
            }

            return `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, "0")}`;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (months.length > 0) {
      return months;
    }

    return todayIso ? [todayIso.slice(0, 7)] : [];
  }, [items, todayIso]);

  useEffect(() => {
    if (availableMonths.length === 0) {
      return;
    }

    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0] ?? "");
    }
  }, [availableMonths, selectedMonth]);

  const filteredPayments = useMemo(() => {
    return items.filter((payment) => {
      const paidDate = new Date(payment.paidAt);

      if (Number.isNaN(paidDate.getTime())) {
        return false;
      }

      if (filterMode === "month") {
        const paymentMonth = `${paidDate.getFullYear()}-${String(
          paidDate.getMonth() + 1,
        ).padStart(2, "0")}`;
        return paymentMonth === selectedMonth;
      }

      const from = new Date(`${dateFrom}T00:00:00`);
      const to = new Date(`${dateTo}T23:59:59`);
      return paidDate >= from && paidDate <= to;
    });
  }, [dateFrom, dateTo, filterMode, items, selectedMonth]);

  const totalPaid = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const leadPayment = filteredPayments[0] ?? items[0];

  return (
    <ProfileShell title="Payment" showBack backHref="/profile">
      <div className="rounded-[24px] border border-[#ebe2f8] bg-white p-4 shadow-[0_16px_34px_rgba(106,69,160,0.08)]">
        <div className="flex items-start gap-3">
          <div className="rounded-[18px] border border-[#f1e7fb] bg-[#fffdfd] p-1">
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,#2d233d_0%,#181022_100%)] text-white shadow-[0_10px_20px_rgba(34,19,49,0.24)]">
              <WalletIcon className="h-6 w-6" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-black text-[#1f1630]">
              {leadPayment?.provider ?? "Service Payment"}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-[#6d6480]">
              {leadPayment?.serviceTitle ?? "Customer booking payment"}
            </p>
            <p className="mt-1 text-[11px] text-[#8f86a2]">
              {leadPayment
                ? new Intl.DateTimeFormat("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(leadPayment.paidAt))
                : "No payments available"}
            </p>
          </div>
        </div>
      </div>

      <section className="mt-4 rounded-[24px] border border-[#ebe2f8] bg-white p-4 shadow-[0_14px_30px_rgba(106,69,160,0.07)]">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
          Payment Summary
        </p>
        <div className="mt-4 space-y-3">
          <SummaryRow label="Service Charges" value={`RM${leadPayment?.amount.toFixed(2) ?? totalPaid.toFixed(2)}`} />
          <SummaryRow label="Service Fee" value="RM0.00" />
          <SummaryRow label="Platform Fee" value="RM0.00" />
          <div className="border-t border-[#efe6fb] pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-black text-[#24193a]">Total Paid</p>
              <p className="text-[22px] font-black text-[#8E5EB5]">RM{leadPayment?.amount.toFixed(2) ?? totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </section>

      <SectionCard title="Payment Method">
        <div className="rounded-[16px] border border-[#e7dcf7] bg-white px-4 py-3 shadow-[0_10px_20px_rgba(142,94,181,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#f6effd] text-[#8E5EB5]">
                <WalletIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-[#24193a]">
                  {leadPayment?.paymentMethod ?? "Cash"}
                </p>
                <p className="text-[11px] text-[#8f86a2]">Only cash is available right now</p>
              </div>
            </div>
            <span className="rounded-full bg-[#f6effd] px-2 py-1 text-[11px] font-bold text-[#8E5EB5]">
              Cash
            </span>
          </div>
        </div>
      </SectionCard>

      <section className="mt-4 rounded-[18px] border border-[#d7efdb] bg-[#effbf1] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#22c55e] text-white">
            <CheckCircleIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[#1f4d2b]">Payment Completed</p>
            <p className="text-[11px] text-[#5f7d67]">
              {leadPayment
                ? `Paid on ${new Intl.DateTimeFormat("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(leadPayment.paidAt))}`
                : "Waiting for payment record"}
            </p>
          </div>
        </div>
      </section>

      <SectionCard title="Filter">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFilterMode("month")}
            className={`inline-flex h-10 flex-1 items-center justify-center rounded-[12px] border text-[13px] font-bold ${
              filterMode === "month"
                ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]"
                : "border-[#d9e2dd] bg-white text-[#111827]"
            }`}
          >
            By Month
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("custom")}
            className={`inline-flex h-10 flex-1 items-center justify-center rounded-[12px] border text-[13px] font-bold ${
              filterMode === "custom"
                ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]"
                : "border-[#d9e2dd] bg-white text-[#111827]"
            }`}
          >
            Custom Period
          </button>
        </div>

        {filterMode === "month" ? (
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-semibold text-[#111827]">Month</p>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-11 w-full rounded-[12px] border border-[#d9e2dd] bg-white px-3 text-[14px] text-[#111827] outline-none"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {new Intl.DateTimeFormat("en-MY", {
                    month: "long",
                    year: "numeric",
                  }).format(new Date(`${month}-01T00:00:00`))}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="mb-2 text-[13px] font-semibold text-[#111827]">From</p>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-11 w-full rounded-[12px] border border-[#d9e2dd] bg-white px-3 text-[14px] text-[#111827] outline-none"
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-[#111827]">To</p>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-11 w-full rounded-[12px] border border-[#d9e2dd] bg-white px-3 text-[14px] text-[#111827] outline-none"
              />
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Transaction ID">
        <p className="text-[14px] font-semibold text-[#24193a]">
          {leadPayment?.id ?? "No transaction available"}
        </p>
      </SectionCard>

      <SectionCard title="Transaction History">
        <div className="space-y-4">
          {filteredPayments.map((payment) => {
            const paidAt = new Date(payment.paidAt);
            return (
              <div
                key={payment.id}
                className="rounded-[16px] border border-[#edf1ef] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-extrabold text-[#111827]">
                      {payment.serviceTitle}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-[#8E5EB5]">
                      {payment.serviceCategory}
                    </p>
                    <p className="mt-1 text-[13px] text-[#4b5563]">
                      Provider: {payment.provider}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-extrabold text-[#111827]">
                      RM{payment.amount}
                    </p>
                    <span className="mt-1 inline-flex rounded-full bg-[#f7f1fc] px-2 py-1 text-[11px] font-bold text-[#8E5EB5]">
                      {payment.status === "paid" ? "Paid" : "Refunded"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-[#6b7280]">
                  <p>
                    Date:{" "}
                    <span className="font-semibold text-[#111827]">
                      {new Intl.DateTimeFormat("en-MY", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(paidAt)}
                    </span>
                  </p>
                  <p>
                    Time:{" "}
                    <span className="font-semibold text-[#111827]">
                      {new Intl.DateTimeFormat("en-MY", {
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(paidAt)}
                    </span>
                  </p>
                  <p className="col-span-2">
                    Method:{" "}
                    <span className="font-semibold text-[#111827]">
                      {payment.paymentMethod}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}

          {filteredPayments.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#d9e2dd] px-4 py-6 text-center text-[13px] text-[#6b7280]">
              No payment records found for the selected period.
            </div>
          ) : null}
        </div>
      </SectionCard>
    </ProfileShell>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-[#4f4663]">
      <p>{label}</p>
      <p className="font-semibold text-[#24193a]">{value}</p>
    </div>
  );
}

export function NotificationsScreen({
  initialNotifications = [],
}: NotificationsProps) {
  const [items, setItems] = useState(initialNotifications);
  const [pushState, setPushState] = useState<PushSetupState>({
    permission: "default",
    hasSavedToken: false,
  });
  const [pushNotice, setPushNotice] = useState("");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    let channel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;

    async function loadNotifications() {
      if (!client) {
        return;
      }

      const session = await getFreshSupabaseSession(client);

      if (!active || !session) {
        return;
      }

      const response = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as
        | { notifications: NotificationItem[] }
        | { error?: string };

      if (!active || !response.ok || !("notifications" in result)) {
        return;
      }

      setItems(result.notifications);

      channel = client
        .channel(`notifications-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          async () => {
            const refreshResponse = await fetch("/api/notifications", {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            const refreshResult = (await refreshResponse.json()) as
              | { notifications: NotificationItem[] }
              | { error?: string };

            if (!active || !refreshResponse.ok || !("notifications" in refreshResult)) {
              return;
            }

            setItems(refreshResult.notifications);
          }
        )
        .subscribe();
    }

    void loadNotifications();
    void getPushSetupState().then((state) => {
      if (active) {
        setPushState(state);
      }
    });

    return () => {
      active = false;
      if (client && channel) {
        client.removeChannel(channel);
      }
    };
  }, []);

  async function markAsRead(id: string) {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const session = await getFreshSupabaseSession(client);

    if (!session) {
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, isRead: true } : item
      )
    );

    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  }

  async function handleEnablePush() {
    setPushBusy(true);
    setPushNotice("");

      try {
        const token = await requestNotificationPermission();

        if (!token) {
          const support = await getPushSupportDiagnostics();
          const state = await getPushSetupState();
          setPushState(state);
          setPushNotice(
            support.permission === "unsupported"
              ? "Push is not supported on this device/browser for the current web environment."
              : support.permission === "denied"
                ? "Push is blocked in this browser. Please allow notifications in browser settings."
                : support.permission === "granted"
                  ? getLastPushError()
                    ? `Browser permission is granted, but Firebase could not create a push token on this device. ${getLastPushError()}`
                    : "Browser permission is granted, but Firebase could not create a push token on this device."
                  : "Push permission was dismissed or not granted yet."
          );
          return;
        }

      const result = await saveFCMToken(token);

      if (!result.success) {
        setPushNotice(result.error || "Unable to save push token.");
        return;
      }

      setPushState({
        permission: "granted",
        hasSavedToken: true,
      });
      setPushNotice("Push notifications enabled on this device.");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    setPushNotice("");

    try {
      const result = await disablePushNotifications();

      if (!result.success) {
        setPushNotice(result.error || "Unable to disable push notifications.");
        return;
      }

      const state = await getPushSetupState();
      setPushState(state);
      setPushNotice("Push notifications disabled for this device.");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <ProfileShell title="Notifications" showBack backHref="/profile">
      <div className="space-y-4">
        <PushNotificationCard
          pushState={pushState}
          notice={pushNotice}
          busy={pushBusy}
          onEnable={handleEnablePush}
          onDisable={handleDisablePush}
        />
        {items.length === 0 ? (
          <SharedEmptyState
            title="No notifications yet"
            description="Booking updates, provider decisions, and payment alerts will show up here in real time."
          />
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void markAsRead(item.id)}
              className={`w-full rounded-[18px] border p-4 text-left shadow-[0_10px_26px_rgba(15,23,42,0.04)] ${
                item.isRead
                  ? "border-[#e4ece7] bg-white"
                  : "border-[#d7c1eb] bg-[#faf7fd]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-extrabold text-[#111827]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-[#4b5563]">
                    {item.body}
                  </p>
                  <div className="mt-3">
                    <SharedStatusBadge
                      label={item.isRead ? "Read" : "Unread"}
                      tone={item.isRead ? "cancelled" : "info"}
                    />
                  </div>
                </div>
                {!item.isRead ? (
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#8E5EB5]" />
                ) : null}
              </div>
              <p className="mt-3 text-[12px] font-semibold text-[#6b7280]">
                {new Intl.DateTimeFormat("en-MY", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(item.createdAt))}
              </p>
            </button>
          ))
        )}
      </div>
    </ProfileShell>
  );
}

export function MessagesScreen() {
  return (
    <ProfileShell title="Messages" showBack backHref="/profile">
      <BookingMessagesPanel
        role="customer"
        basePath="/profile/messages"
        emptyTitle="No conversations yet"
        emptyDescription="When you book a provider, that booking thread will appear here for live conversation updates."
        emptyActionHref="/profile/bookings"
        emptyActionLabel="Open My Bookings"
        theme={{
          accentText: "text-[#8E5EB5]",
          accentBg: "bg-[#8E5EB5]",
          accentSoftBg: "bg-[#faf5ff]",
          accentBorder: "border-[#d9c5f1]",
          badgeBg: "bg-[#f5f1fa]",
          badgeText: "text-[#8E5EB5]",
          ownBubble: "bg-[#8E5EB5]",
          ownBubbleText: "text-white",
          otherBubble: "bg-[#f7f4fb]",
          otherBubbleText: "text-[#24193a]",
          threadUnreadBorder: "border-[#d9c5f1]",
          threadUnreadBg: "bg-[#fcf8ff]",
          composerButton: "bg-[#8E5EB5]",
        }}
      />
    </ProfileShell>
  );
}

function PushNotificationCard({
  pushState,
  notice,
  busy,
  onEnable,
  onDisable,
}: {
  pushState: PushSetupState;
  notice: string;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const enabled = pushState.permission === "granted" && pushState.hasSavedToken;
  const statusLabel =
    pushState.permission === "unsupported"
      ? "Not supported"
      : pushState.permission === "denied"
        ? "Blocked"
        : enabled
          ? "Enabled"
          : pushState.permission === "granted"
            ? "Ready to enable"
            : "Permission needed";

  return (
    <div className="rounded-[18px] border border-[#dbe8df] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold text-[#111827]">
            Push Notifications
          </p>
          <p className="mt-1 text-[13px] leading-6 text-[#4b5563]">
            Get booking updates even when this app is closed.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            enabled
              ? "bg-[#f5f1fa] text-[#8E5EB5]"
              : "bg-[#eef2f7] text-[#64748b]"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || pushState.permission === "unsupported"}
          onClick={onEnable}
          className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#8E5EB5] px-4 text-[13px] font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "Updating..." : enabled ? "Enable Again" : "Enable Push"}
        </button>
        <button
          type="button"
          disabled={busy || (!enabled && pushState.permission !== "granted")}
          onClick={onDisable}
          className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#dbe8df] bg-white px-4 text-[13px] font-extrabold text-[#111827] disabled:opacity-60"
        >
          Disable Push
        </button>
      </div>

      {notice ? (
        <p className="mt-3 text-[12px] font-semibold text-[#4b5563]">{notice}</p>
      ) : null}
    </div>
  );
}

function LocationSettingsCard() {
  const [location, setLocation] = useState<StoredLiveLocation | null>(() =>
    loadStoredLiveLocation()
  );
  const [savedPlaces, setSavedPlaces] = useState<StoredLiveLocation[]>(() =>
    loadSavedPlaces()
  );
  const [isLocating, setIsLocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    setStatusMessage("");

    void resolveCurrentLiveLocation("Current location", { persist: "saved" })
      .then((nextLocation) => {
        if (!nextLocation) {
          setStatusMessage("Location services are unavailable on this device.");
          return;
        }

        setLocation(nextLocation);
        setSavedPlaces(loadSavedPlaces());
        setStatusMessage("Current location updated successfully.");
      })
      .catch(() => {
        setStatusMessage("Location permission was denied or unavailable.");
      })
      .finally(() => {
        setIsLocating(false);
      });
  };

  return (
    <SectionCard title="Live Location">
      <div className="rounded-[16px] bg-[#f8fcf9] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-[#111827]">
              Use my current location
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#4b5563]">
              Save your live GPS coordinates for accurate map-based service matching,
              then tap the saved location to fine-tune it on the map.
            </p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eff9f0] text-[#16a34a]">
            <PinIcon className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-4 rounded-[14px] border border-[#e4ece7] bg-white px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
            Saved location
          </p>
          <div className="mt-1">
            <LiveLocationChip
              mode="saved"
              fallbackLabel={location?.label ?? "No live location saved yet"}
              className="text-[14px] font-semibold"
              onLocationChange={(nextLocation) => {
                setLocation(nextLocation);
                setSavedPlaces(loadSavedPlaces());
              }}
              onLocationClear={() => {
                setLocation(null);
                setSavedPlaces(loadSavedPlaces());
              }}
            />
          </div>
          {location ? (
            <p className="mt-1 text-[12px] text-[#6b7280]">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          ) : null}
        </div>

        {location ? (
          <div className="mt-4 overflow-hidden rounded-[20px] border border-[#dcecdf] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="bg-[#eef9ff] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
                    {location.addressLabel ?? "Home"}
                  </p>
                  <p className="mt-1 text-[18px] font-extrabold text-[#111827]">
                    {[location.houseNumber, location.buildingName || location.label]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="mt-1 text-[13px] text-[#4b5563]">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                </div>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#ef4444] shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
                  <PinIcon className="h-5 w-5 fill-current" />
                </span>
              </div>
            </div>
            <div className="space-y-2 px-4 py-4">
              <p className="text-[14px] font-semibold text-[#111827]">
                {location.formattedAddress ?? location.label}
              </p>
              <p className="text-[13px] text-[#4b5563]">
                {[
                  location.floor && `Floor ${location.floor}`,
                  location.unitNumber && `Unit ${location.unitNumber}`,
                ]
                  .filter(Boolean)
                  .join(" • ") || "No floor or unit details yet"}
              </p>
              <p className="text-[13px] text-[#2563eb]">
                {location.pickupNote || "No pickup note added yet"}
              </p>
            </div>
          </div>
        ) : null}

        {savedPlaces.length > 0 ? (
          <div className="mt-4 rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-extrabold text-[#111827]">
                Saved Places
              </h3>
              <span className="text-[12px] font-semibold text-[#6b7280]">
                {savedPlaces.length} saved
              </span>
            </div>
            <div className="space-y-3">
              {savedPlaces.map((place) => (
                <div
                  key={place.id}
                  className="rounded-[14px] border border-[#edf1ef] px-3 py-3"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
                    {place.addressLabel ?? "Place"}
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[#111827]">
                    {[place.houseNumber, place.buildingName || place.label]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="mt-1 text-[13px] text-[#4b5563]">
                    {place.formattedAddress ?? place.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {statusMessage ? (
          <p className="mt-3 text-[12px] font-semibold text-[#16a34a]">
            {statusMessage}
          </p>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-[#16a34a] px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(22,163,74,0.18)] disabled:opacity-70"
          >
            {isLocating ? "Getting location..." : "Use My Current Location"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function ProfileSummaryCard({
  profile,
  fullName,
}: {
  profile: CustomerProfile;
  fullName: string;
}) {
  return (
    <Link
      href="/profile/edit"
      className="block rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition hover:border-[#d9c8ee] hover:shadow-[0_14px_30px_rgba(106,69,160,0.08)]"
    >
      <div className="flex items-center gap-4">
        {profile.avatarUrl ? (
          <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-full shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
            <Image
              src={profile.avatarUrl}
              alt={fullName || "Customer profile"}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : (
          <AvatarCircle
            initials={customerInitials(profile)}
            size="lg"
            accent="from-[#8E5EB5] to-[#7B4EA1]"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#111827]">
                {fullName}
              </h2>
              <div className="mt-1 flex items-center gap-1 text-[13px] text-[#6b7280]">
                <PinIcon className="h-3.5 w-3.5" />
                {profile.city}, {profile.region}
              </div>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-[#6b7280]" />
          </div>

          {profile.verified ? (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#f5f1fa] px-2.5 py-1 text-[12px] font-bold text-[#8E5EB5]">
              <CheckShieldIcon className="h-4 w-4" />
              Phone Verified
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function ProfileCompletion({ completion }: { completion: number }) {
  return (
    <SectionCard title="Profile Completion">
      <div className="mb-2 flex items-center justify-between text-[13px] text-[#6b7280]">
        <span />
        <span>
          <strong className="text-[#8E5EB5]">{completion}%</strong> Complete
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#e5e7eb]">
        <div
          className="h-2 rounded-full bg-[#8E5EB5]"
          style={{ width: `${completion}%` }}
        />
      </div>
    </SectionCard>
  );
}

function WalletSummaryCard({
  walletBalance,
  walletPanel,
  selectedBank,
  walletMessage,
  onSelectedBankChange,
  onWithdrawClick,
  onConnectBank,
  onClosePanel,
}: {
  walletBalance: number;
  walletPanel: "closed" | "withdraw";
  selectedBank: string;
  walletMessage: string;
  onSelectedBankChange: (value: string) => void;
  onWithdrawClick: () => void;
  onConnectBank: () => void;
  onClosePanel: () => void;
}) {
  const router = useRouter();
  const bankOptions = ["Maybank", "CIMB", "Public Bank", "RHB Bank"];
  const withdrawDisabled = walletBalance <= 0;

  return (
    <section className="mt-4 overflow-hidden rounded-[22px] border border-[#e7def4] bg-[linear-gradient(135deg,#ffffff_0%,#f8f3fd_100%)] p-4 shadow-[0_16px_36px_rgba(104,63,155,0.1)]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push("/profile/wallet")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push("/profile/wallet");
          }
        }}
        className="cursor-pointer rounded-[18px] border border-[#ede4f8] bg-white/90 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#8E5EB5]">
              Wallet Balance
            </p>
            <p className="mt-2 text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">
              {formatRinggit(walletBalance)}
            </p>
            <p className="mt-1 text-[12px] text-[#7c728f]">
              Available for withdrawal to your bank account
            </p>
          </div>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#edf7ee] text-[#22c55e]">
            <WalletIcon className="h-6 w-6" />
          </span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onWithdrawClick();
          }}
          disabled={withdrawDisabled}
          className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] px-4 text-[14px] font-extrabold transition ${
            withdrawDisabled
              ? "cursor-not-allowed bg-[#d8cde6] text-white shadow-none"
              : "bg-[#8E5EB5] text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]"
          }`}
        >
          Withdraw
        </button>
        {walletPanel === "withdraw" ? (
          <div className="mt-4 rounded-[18px] border border-[#e8def6] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-extrabold text-[#1f1630]">Connect bank account</p>
                <p className="mt-1 text-[12px] text-[#7c728f]">
                  Choose the bank account to receive {formatRinggit(walletBalance)}.
                </p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClosePanel();
                }}
                className="text-[12px] font-bold text-[#8E5EB5]"
              >
                Close
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {bankOptions.map((bank) => (
                <button
                  key={bank}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectedBankChange(bank);
                  }}
                  className={`rounded-[12px] border px-3 py-3 text-left text-[13px] font-bold ${
                    selectedBank === bank
                      ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]"
                      : "border-[#e5e7eb] bg-white text-[#374151]"
                  }`}
                >
                  {bank}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onConnectBank();
              }}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#22c55e] px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(34,197,94,0.18)]"
            >
              Connect and Withdraw
            </button>
          </div>
        ) : null}
      </div>

      {walletMessage ? (
        <p className="mt-4 rounded-[14px] border border-[#d7efdb] bg-[#effbf1] px-4 py-3 text-[12px] font-semibold text-[#1f6b37]">
          {walletMessage}
        </p>
      ) : null}
    </section>
  );
}

function RewardsSummaryCard({
  availablePoints,
}: {
  availablePoints: number;
}) {
  return (
    <Link
      href="/profile/rewards"
      className="mt-4 block rounded-[18px] border border-[#e8def6] bg-[linear-gradient(180deg,#ffffff_0%,#faf6ff_100%)] p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#8E5EB5_0%,#7A49A7_100%)] text-white">
            <CoinsIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-[#1f1630]">Available Points</p>
            <p className="mt-1 text-[12px] text-[#7c728f]">
              Tap to view referral link, points and redeem options
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[1.4rem] font-black tracking-[-0.05em] text-[#1f1630]">
            {availablePoints.toLocaleString()}
          </p>
          <p className="text-[12px] font-bold text-[#8E5EB5]">pts</p>
        </div>
      </div>
    </Link>
  );
}

function ReferralRewardsCard({
  referralCode,
  referralLink,
  availablePoints,
  rewards,
  feedbackMessage,
  onFeedbackChange,
}: {
  referralCode: string;
  referralLink: string;
  availablePoints: number;
  rewards: Array<{
    id: string;
    title: string;
    description: string;
    points: number;
  }>;
  feedbackMessage: string;
  onFeedbackChange: (value: string) => void;
}) {
  async function handleCopyLink() {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard is not supported.");
      }

      await navigator.clipboard.writeText(referralLink);
      onFeedbackChange("Referral link copied successfully.");
    } catch {
      onFeedbackChange("Unable to copy the referral link right now.");
    }
  }

  async function handleShareLink() {
    try {
      if (typeof navigator === "undefined") {
        throw new Error("Share is not supported.");
      }

      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "Join DELLA",
          text: `Use my referral code ${referralCode} when you join DELLA.`,
          url: referralLink,
        });
        onFeedbackChange("Referral link shared successfully.");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
        onFeedbackChange("Share is not supported here, so the referral link was copied instead.");
        return;
      }

      throw new Error("Share is not supported.");
    } catch {
      onFeedbackChange("Unable to share the referral link right now.");
    }
  }

  return (
    <section className="mt-4 rounded-[22px] border border-[#eadff7] bg-[linear-gradient(180deg,#fdfbff_0%,#ffffff_100%)] p-4 shadow-[0_16px_34px_rgba(104,63,155,0.08)]">
      <div className="rounded-[20px] bg-[radial-gradient(circle_at_top_right,#f4e6ff_0%,#ffffff_52%,#fbf8ff_100%)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(180deg,#8E5EB5_0%,#7A49A7_100%)] text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]">
              <GiftIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-[1.25rem] font-black tracking-[-0.04em] text-[#1f1630]">
              Refer & Earn
            </h3>
            <p className="mt-1 text-[13px] leading-6 text-[#746a88]">
              Invite friends and earn reward points for future bookings.
            </p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_center,#fff3cf_0%,#f2e7ff_58%,#ffffff_100%)]">
            <GiftBoxStackIcon className="h-14 w-14 text-[#8E5EB5]" />
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-dashed border-[#d8c6ef] bg-white/90 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9d83c4]">
            Your Referral Code
          </p>
          <p className="mt-2 text-[1.5rem] font-black tracking-[-0.05em] text-[#7A49A7]">
            {referralCode}
          </p>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#ece4f7] bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9d83c4]">
            Your Referral Link
          </p>
          <p className="mt-2 break-all text-[13px] font-semibold text-[#3a3050]">
            {referralLink}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#8E5EB5] px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]"
            >
              <CopyIcon className="h-4 w-4" />
              Copy Link
            </button>
            <button
              type="button"
              onClick={() => void handleShareLink()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#d8c6ef] bg-white px-4 text-[14px] font-extrabold text-[#8E5EB5]"
            >
              <ShareArrowIcon className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[#e8def6] bg-[linear-gradient(180deg,#ffffff_0%,#faf6ff_100%)] p-4">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#8E5EB5_0%,#7A49A7_100%)] text-white">
            <CoinsIcon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-[13px] font-bold text-[#64587c]">Available Points</p>
          <p className="mt-1 text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">
            {availablePoints.toLocaleString()}
            <span className="ml-2 text-[1rem] font-bold text-[#8E5EB5]">pts</span>
          </p>
          <p className="mt-1 text-[12px] text-[#7c728f]">Keep referring and earn more rewards.</p>
        </div>

        <div className="rounded-[18px] border border-[#f1e7d6] bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-4">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f59e0b_0%,#f97316_100%)] text-white">
            <SparkGiftIcon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-[13px] font-bold text-[#7a5c2d]">Redeem Points</p>
          <p className="mt-1 text-[14px] leading-6 text-[#7c728f]">
            Use your points for vouchers and booking discounts.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-[12px] bg-[#8E5EB5] px-4 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(142,94,181,0.18)]"
          >
            Redeem Now
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-[#ece4f7] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[15px] font-extrabold text-[#1f1630]">Redeem Options</h4>
          <span className="text-[12px] font-bold text-[#8E5EB5]">How it works</span>
        </div>
        <div className="mt-3 space-y-3">
          {rewards.map((reward) => {
            const disabled = availablePoints < reward.points;

            return (
              <div
                key={reward.id}
                className="flex items-center justify-between gap-3 rounded-[16px] border border-[#f1ebf8] bg-[#fcfbfe] px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f5f1fa] text-[#8E5EB5]">
                    <VoucherIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-[#1f1630]">{reward.title}</p>
                    <p className="text-[12px] text-[#7c728f]">{reward.description}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-black text-[#8E5EB5]">{reward.points} pts</p>
                  <button
                    type="button"
                    disabled={disabled}
                    className={`mt-2 inline-flex h-9 items-center justify-center rounded-[10px] px-4 text-[12px] font-extrabold ${
                      disabled
                        ? "cursor-not-allowed bg-[#ece6f5] text-[#b8a9cf]"
                        : "bg-[#8E5EB5] text-white shadow-[0_10px_20px_rgba(142,94,181,0.16)]"
                    }`}
                  >
                    Redeem
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {feedbackMessage ? (
        <p className="mt-4 rounded-[14px] border border-[#d7efdb] bg-[#effbf1] px-4 py-3 text-[12px] font-semibold text-[#1f6b37]">
          {feedbackMessage}
        </p>
      ) : null}
    </section>
  );
}

function SectionCard({
  title,
  actionLabel,
  actionHref,
  children,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-extrabold text-[#111827]">{title}</h3>
        {actionLabel ? (
          actionHref ? (
            <Link href={actionHref} className="text-[13px] font-bold text-[#8E5EB5]">
              {actionLabel}
            </Link>
          ) : (
            <span className="text-[13px] font-bold text-[#8E5EB5]">{actionLabel}</span>
          )
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ProfileInfoRow({
  icon,
  label,
  value,
  valueTone = "default",
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueTone?: "default" | "green" | "purple";
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3 text-[14px] text-[#111827]">
        <span className="text-[#8E5EB5]">{icon}</span>
        <span>{label}</span>
      </div>
      <span
        className={`text-[13px] ${
          valueTone === "green" || valueTone === "purple"
            ? "font-bold text-[#8E5EB5]"
            : "text-[#374151]"
        }`}
      >
        {value}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-3 border-t border-[#edf1ef] py-3 first:border-t-0 first:pt-0 last:pb-0"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#edf1ef] py-3 first:border-t-0 first:pt-0 last:pb-0">
      {content}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  icon,
  rightIcon,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-[#111827]">
        {label}
      </span>
      <div className="flex items-center rounded-[12px] border border-[#d9e2dd] px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
        <span className="mr-3 text-[#16a34a]">{icon}</span>
        <input
          value={value}
          onChange={onChange}
          className="h-11 flex-1 border-0 bg-transparent text-[14px] text-[#111827] outline-none"
        />
        {rightIcon ? <span className="ml-3 text-[#6b7280]">{rightIcon}</span> : null}
      </div>
    </label>
  );
}

function LabeledDateInput({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [maxDate, setMaxDate] = useState("");

  useEffect(() => {
    setMaxDate(getTodayIso());
  }, []);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    pickerInput.showPicker?.();
  };

  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-[#111827]">
        {label}
      </span>
      <div className="flex items-center rounded-[12px] border border-[#d9e2dd] px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
        <span className="mr-3 text-[#16a34a]">{icon}</span>
        <input
          ref={inputRef}
          type="date"
          max={maxDate || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPicker}
          className="h-11 flex-1 border-0 bg-transparent text-[14px] text-[#111827] outline-none"
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label="Open date picker"
          className="ml-3 text-[#6b7280]"
        >
          <CalendarIcon className="h-5 w-5" />
        </button>
      </div>
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  icon,
  options,
  hidePlaceholder = false,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  icon: React.ReactNode;
  options: string[];
  hidePlaceholder?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-[#111827]">
        {label}
      </span>
      <div className="flex items-center rounded-[12px] border border-[#d9e2dd] px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
        <span className="mr-3 text-[#16a34a]">{icon}</span>
        <select
          value={value}
          onChange={onChange}
          className="h-11 flex-1 appearance-none border-0 bg-transparent text-[14px] text-[#111827] outline-none"
        >
          {!hidePlaceholder ? <option value="">Select</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="ml-3 text-[#6b7280]">
          <ChevronDownIcon className="h-4 w-4" />
        </span>
      </div>
    </label>
  );
}

function AvatarCircle({
  initials,
  size,
  accent,
}: {
  initials: string;
  size: "md" | "lg" | "xl";
  accent: string;
}) {
  const sizeClass =
    size === "xl"
      ? "h-24 w-24 text-[28px]"
      : size === "lg"
        ? "h-[4.5rem] w-[4.5rem] text-[22px]"
        : "h-14 w-14 text-[16px]";

  return (
    <div
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full bg-gradient-to-br ${accent} font-extrabold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]`}
    >
      {initials}
    </div>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const activeTab = useClientSearchParam("tab");
  const isBookingsRoute = pathname.startsWith("/profile/bookings");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-[#E8ECE8] bg-white/97 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-1 text-[10.5px] font-medium text-[#8A94A6]">
        <NavItem href="/home" label="Home" icon={<HomeIcon className="h-5 w-5" />} active={pathname === "/home"} />
        <NavItem
          href="/profile/bookings"
          label="Task"
          icon={<CalendarIcon className="h-5 w-5" />}
          active={isBookingsRoute && activeTab !== "ongoing"}
        />
        <NavItem
          href="/profile/favourites"
          label="Favourite"
          icon={<FavoriteHeartIcon className="h-5 w-5" />}
          active={pathname.startsWith("/profile/favourites")}
        />
        <NavItem
          href="/profile/bookings?tab=ongoing"
          label="On Going"
          icon={<CheckCircleIcon className="h-5 w-5" />}
          active={isBookingsRoute && activeTab === "ongoing"}
        />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-w-[3.1rem] flex-col items-center gap-1 ${
        active ? "text-[#8E5EB5]" : "text-[#8A94A6]"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="flex h-3 items-end">
        <span
          className={`rounded-full transition-all ${
            active ? "h-[3px] w-10 bg-[#8E5EB5]" : "h-[3px] w-6 bg-transparent"
          }`}
        />
      </span>
    </Link>
  );
}

function BookingThumb({
  kind,
  imageSrc,
  avatarSrc,
  service,
  providerName,
}: {
  kind: string;
  imageSrc?: string;
  avatarSrc?: string;
  service: string;
  providerName?: string;
}) {
  const tones =
    kind === "food"
      ? "from-amber-500 via-orange-500 to-emerald-700"
      : kind === "cleaning"
        ? "from-sky-300 via-slate-200 to-cyan-600"
        : "from-slate-800 via-slate-600 to-stone-400";

  if (avatarSrc) {
    return (
      <div className="relative h-[4.9rem] w-[4.9rem] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
        <Image
          src={avatarSrc}
          alt={providerName || service}
          fill
          unoptimized
          className="object-cover"
        />
      </div>
    );
  }

  if (imageSrc) {
    return (
      <div className="relative h-[4.9rem] w-[4.9rem] shrink-0 overflow-hidden rounded-[16px] shadow-[0_8px_18px_rgba(15,23,42,0.16)]">
        <Image
          src={imageSrc}
          alt={service}
          fill
          unoptimized
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`h-[4.9rem] w-[4.9rem] shrink-0 rounded-[16px] bg-gradient-to-br ${tones} p-2 shadow-[0_8px_18px_rgba(15,23,42,0.16)]`}>
      <div className="flex h-full w-full items-end rounded-[10px] bg-black/20 p-2">
        {kind === "food" ? <ChefHatIcon className="h-5 w-5 text-white" /> : null}
        {kind === "cleaning" ? <SparklesCleanIcon className="h-5 w-5 text-white" /> : null}
        {kind === "car" ? <CarIcon className="h-5 w-5 text-white" /> : null}
      </div>
    </div>
  );
}

function badgeToneClass(tone: Booking["badgeTone"]) {
  if (tone === "green") {
    return "bg-[#f5f1fa] text-[#8E5EB5]";
  }

  if (tone === "amber") {
    return "bg-[#fff3e3] text-[#f59e0b]";
  }

  return "bg-[#eef2f7] text-[#64748b]";
}

function formatBookingAmount(value?: number) {
  return `RM${Number(value ?? 0).toFixed(2)}`;
}

function bookingTone(booking: Booking) {
  if (booking.status === "cancelled") {
    return "cancelled" as const;
  }

  if (booking.status === "completed") {
    return "completed" as const;
  }

  if (booking.statusLabel.toLowerCase().includes("confirm")) {
    return "accepted" as const;
  }

  if (booking.statusLabel.toLowerCase().includes("declin")) {
    return "declined" as const;
  }

  return "pending" as const;
}

function customerInitials(profile: CustomerProfile) {
  const first = profile.firstName.trim();
  const last = profile.lastName.trim();

  if (first && last) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  }

  if (first.length >= 2) {
    return first.slice(0, 2).toUpperCase();
  }

  if (first) {
    return first[0].toUpperCase();
  }

  return "DE";
}

function formatRinggit(amount: number) {
  return `RM ${amount.toFixed(2)}`;
}

function getBookingFilterDate(booking: Booking) {
  const source =
    booking.scheduledStartAt ||
    booking.completedAt ||
    booking.acceptedAt ||
    booking.createdAt ||
    "";

  if (!source) {
    return null;
  }

  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBookingSortTimestamp(booking: Booking) {
  return getBookingFilterDate(booking)?.getTime() ?? 0;
}

function isSameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function useClientSearchParam(name: string) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const readValue = () => {
      setValue(new URLSearchParams(window.location.search).get(name));
    };

    readValue();

    const handleLocationChange = () => {
      readValue();
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushStateWrapper(...args) {
      const result = originalPushState.apply(this, args);
      handleLocationChange();
      return result;
    };

    window.history.replaceState = function replaceStateWrapper(...args) {
      const result = originalReplaceState.apply(this, args);
      handleLocationChange();
      return result;
    };

    window.addEventListener("popstate", handleLocationChange);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, [name]);

  return value;
}

function providerNameInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "DE";
}

function buildReferralCode(firstName: string, lastName: string, phoneNumber: string) {
  const first = firstName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) || "DEL";
  const last = lastName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) || "USR";
  const digits = phoneNumber.replace(/\D/g, "").slice(-3) || "001";

  return `${first}${last}${digits}`;
}

function buildReferralLink(referralCode: string) {
  return `https://app.dellaapp.com/invite/${referralCode}`;
}

function SettingIcon({
  name,
  className,
}: {
  name: SettingGroup["items"][number]["icon"];
  className?: string;
}) {
  switch (name) {
    case "user":
      return <UserIcon className={className} />;
    case "lock":
      return <LockIcon className={className} />;
    case "bell":
      return <BellIcon className={className} />;
    case "help":
      return <HelpIcon className={className} />;
    case "alert":
      return <AlertIcon className={className} />;
    case "privacy":
      return <PrivacyIcon className={className} />;
    case "terms":
      return <DocumentIcon className={className} />;
    case "trash":
      return <TrashIcon className={className} />;
    case "logout":
      return <LogoutIcon className={className} />;
    default:
      return <UserIcon className={className} />;
  }
}

function AddressKindIcon({
  kind,
  className,
}: {
  kind: Address["kind"];
  className?: string;
}) {
  if (kind === "home") return <HomeIcon className={className} />;
  if (kind === "office") return <OfficeIcon className={className} />;
  return <PinIcon className={className} />;
}

function iconClass(className?: string) {
  return className ?? "h-5 w-5 stroke-[1.9]";
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" className={iconClass(className)}>
      <path d="M15 18 9 12l6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={iconClass(className)}>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsVerticalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass(className)}>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.7-3 4.4-4.5 8-4.5s6.3 1.5 8 4.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M6.6 3h3.1l1.2 4.6-1.8 1.8a15 15 0 0 0 5.4 5.4l1.8-1.8L21 14.3v3.1c0 .9-.7 1.6-1.6 1.6C10.8 19 5 13.2 5 6.6 5 5.7 5.7 5 6.6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M6 16.5h12l-1.2-1.4a3 3 0 0 1-.8-2V10a4 4 0 1 0-8 0v3.1a3 3 0 0 1-.8 2L6 16.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="m4 11 8-7 8 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V20h12v-9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OfficeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M4 21h16" strokeLinecap="round" />
      <path d="M7 21V7l10-3v17" />
      <path d="M10 10h.01M10 14h.01M14 10h.01M14 14h.01" strokeLinecap="round" />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 1 1 5.4 1.8c-.7.9-1.5 1.3-2 2.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 4v8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M4 20h16" strokeLinecap="round" />
      <path d="M6 20V6a6 6 0 1 1 12 0v14" />
    </svg>
  );
}

function PrivacyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v6h6M10 13h6M10 17h6" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M10 17v2a2 2 0 0 0 2 2h6V3h-6a2 2 0 0 0-2 2v2" />
      <path d="M15 12H4m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M6 17.5 3 20V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6Z" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M4 8h3l1.2-2h7.6L17 8h3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={iconClass(className)}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.3 2.3 4.7-4.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" strokeLinecap="round" />
    </svg>
  );
}

function CheckShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 3 5.5 5.7v5.1c0 4.2 2.6 7 6.5 8.9 3.9-1.9 6.5-4.7 6.5-8.9V5.7L12 3Z" />
      <path d="m9.5 11.8 1.8 1.8 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M16 12h3" strokeLinecap="round" />
    </svg>
  );
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M4 10h16v10H4z" />
      <path d="M12 10v10M4 10h16M12 10H7.5a2.5 2.5 0 1 1 0-5c2 0 3.3 2 4.5 5Zm0 0h4.5a2.5 2.5 0 1 0 0-5c-2 0-3.3 2-4.5 5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GiftBoxStackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass(className)}>
      <path d="M4 10h16v10H4z" />
      <path d="M12 10v10M4 10h16M7 7.5h10" strokeLinecap="round" />
      <path d="M7.2 7.5a2.2 2.2 0 1 1 0-4.4c1.8 0 3 1.8 4.8 4.4m4.8 0a2.2 2.2 0 1 0 0-4.4c-1.8 0-3 1.8-4.8 4.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.5" cy="18.5" r="2.3" fill="currentColor" stroke="none" opacity="0.18" />
      <path d="M18.5 17.2v2.6M17.2 18.5h2.6" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <rect x="9" y="9" width="10" height="11" rx="2" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" strokeLinecap="round" />
    </svg>
  );
}

function ShareArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="m8 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <ellipse cx="12" cy="6" rx="5.5" ry="2.5" />
      <path d="M6.5 6v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V6M6.5 10v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" />
    </svg>
  );
}

function SparkGiftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M4 10h16v10H4z" />
      <path d="M12 10v10M4 10h16" strokeLinecap="round" />
      <path d="M9 7.5a2 2 0 1 1 0-4c1.5 0 2.4 1.3 3 4m3 0a2 2 0 1 0 0-4c-1.5 0-2.4 1.3-3 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 4v3M17.5 5.5h3" strokeLinecap="round" />
    </svg>
  );
}

function VoucherIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M12 7v10" strokeLinecap="round" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

function FavoriteHeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path
        d="M12 20.4s-6.7-4.2-9.2-8.1C.9 9.3 2 5.6 5.4 4.8c2-.5 4 .2 5.2 1.8 1.2-1.6 3.2-2.3 5.2-1.8 3.4.8 4.5 4.5 2.6 7.5-2.5 3.9-9.2 8.1-9.2 8.1Z"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m12 3.5 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6L3.27 9.85l6.03-.88L12 3.5Z" />
    </svg>
  );
}

function MalaysiaFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className}>
      <rect width="28" height="20" rx="3" fill="#ffffff" />
      <path d="M0 0h14v10H0z" fill="#1d4ed8" />
      <path d="M0 0h28v2H0zm0 4h28v2H0zm0 8h28v2H0zm0 12h28v2H0z" fill="#ef4444" />
      <path d="M0 8h28v2H0zm0 8h28v2H0z" fill="#ef4444" />
      <circle cx="7" cy="5" r="3.3" fill="#facc15" />
      <circle cx="8.1" cy="5" r="2.6" fill="#1d4ed8" />
      <path d="m10.2 2.4.6 1.5 1.6.1-1.2 1 .4 1.5-1.4-.8-1.4.8.4-1.5-1.2-1 1.6-.1.6-1.5Z" fill="#facc15" />
    </svg>
  );
}

function ChefHatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M8 10a3 3 0 1 1 0-6 3.7 3.7 0 0 1 4 2 3.8 3.8 0 0 1 6 3 3 3 0 0 1-2 5H8a3 3 0 0 1 0-4Z" />
      <path d="M9 14v4h6v-4" strokeLinecap="round" />
    </svg>
  );
}

function SparklesCleanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 4l1.3 3.7L17 9l-3.7 1.3L12 14l-1.3-3.7L7 9l3.7-1.3L12 4Z" />
      <path d="M6 15l.8 2.2L9 18l-2.2.8L6 21l-.8-2.2L3 18l2.2-.8L6 15Z" />
    </svg>
  );
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M5 16V9l2-3h10l2 3v7" />
      <path d="M3 13h18M7 16a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  );
}
