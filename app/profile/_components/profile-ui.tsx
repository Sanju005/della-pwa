"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AppButton,
  BookingCard as SharedBookingCard,
  EmptyState as SharedEmptyState,
  StatusBadge as SharedStatusBadge,
} from "@/app/_components/della-ui";
import { BookingMessagesPanel } from "@/app/_components/booking-messages-panel";

import { LiveLocationChip } from "@/app/_components/live-location-chip";
import {
  disablePushNotifications,
  getLastPushError,
  getPushSupportDiagnostics,
  getPushSetupState,
  requestNotificationPermission,
  saveFCMToken,
  type PushSetupState,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabase";
import {
  loadSavedPlaces,
  loadStoredLiveLocation,
  resolveCurrentLiveLocation,
  type StoredLiveLocation,
} from "@/lib/live-location";
import { saveCustomerProfile } from "@/lib/profile-browser";
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

const TODAY_ISO = new Date().toISOString().split("T")[0];

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

type BookingsProps = {
  bookings: Booking[];
  initialTab?: BookingStatus;
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
    <div className="relative flex gap-4">
      <div className="flex w-14 flex-col items-center">
        <span
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full border-4 text-lg font-black ${
            done || current
              ? "border-[#8E5EB5] bg-[#8E5EB5] text-white"
              : "border-[#e5e7eb] bg-white text-[#94a3b8]"
          }`}
        >
          {done ? <CheckCircleIcon className="h-6 w-6" /> : number}
        </span>
        <span className={`mt-2 h-full min-h-16 w-[2px] ${done || current ? "bg-[#8E5EB5]" : "bg-[#e5e7eb]"}`} />
      </div>
      <div
        className={`flex-1 rounded-[24px] border p-5 shadow-[0_16px_34px_rgba(106,69,160,0.08)] ${
          current
            ? "border-[#dcc7f7] bg-[linear-gradient(180deg,#fcf7ff_0%,#fffefe_100%)]"
            : "border-[#ebe2f8] bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[1.1rem] font-black tracking-[-0.04em] text-[#1f1630]">
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
            className={`inline-flex items-center rounded-full px-4 py-2 text-[12px] font-bold ${
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
    <div className="mt-4 rounded-[18px] border border-[#ebe2f8] bg-[#fcfaff] p-4">
      <p className="text-[13px] font-semibold text-[#111827]">{title}</p>
      {isPdfProof(mimeType, fileName) ? (
        <div className="mt-3 rounded-[14px] border border-dashed border-[#d9c7ef] bg-white px-4 py-4 text-[13px] text-[#6d6480]">
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
        <p className="mt-2 text-[12px] text-[#6d6480]">{fileName}</p>
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
  const [profile, setProfile] = useState(initialData.profile);
  const [favoriteProviders, setFavoriteProviders] = useState(initialData.favoriteProviders);
  const [bookingSummary, setBookingSummary] = useState(initialData.bookingSummary);
  const [paymentSummary, setPaymentSummary] = useState(initialData.paymentSummary);
  const [walletPanel, setWalletPanel] = useState<"closed" | "withdraw" | "payable">("closed");
  const [selectedBank, setSelectedBank] = useState("Maybank");
  const [walletMessage, setWalletMessage] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const router = useRouter();

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

  const handleLogout = () => {
    startLogoutTransition(async () => {
      setLogoutError("");
      const client = getSupabaseClient();

      if (!client) {
        setLogoutError("Supabase is not configured yet.");
        return;
      }

      const { error } = await client.auth.signOut();

      if (error) {
        setLogoutError(error.message || "Unable to log out right now.");
        return;
      }

      router.replace("/login");
      router.refresh();
    });
  };

  const handleWithdrawClick = () => {
    setWalletMessage("");
    setWalletPanel("withdraw");
  };

  const handlePayableClick = () => {
    setWalletMessage("");
    setWalletPanel("payable");
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

  const handlePayCompany = () => {
    if (paymentSummary.companyPayable <= 0) {
      setWalletMessage("No payable amount due to the company right now.");
      setWalletPanel("closed");
      return;
    }

    const amount = paymentSummary.companyPayable;
    setPaymentSummary((current) => ({
      ...current,
      companyPayable: 0,
      totalPaid: Number((current.totalPaid + amount).toFixed(2)),
      lastPaymentLabel: `Company payment on ${new Intl.DateTimeFormat("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date())}`,
    }));
    setWalletMessage(`${formatRinggit(amount)} paid to DELLA successfully.`);
    setWalletPanel("closed");
  };

  useEffect(() => {
    let active = true;

    async function loadLiveProfile() {
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

      const favoritesResponse = await fetch("/api/profile/favorites", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as
        | {
            profile: CustomerProfile;
            bookingSummary: ProfileOverviewData["bookingSummary"];
            paymentSummary: ProfileOverviewData["paymentSummary"];
          }
        | { error?: string };
      const favoritesResult = (await favoritesResponse.json()) as
        | { favoriteProviders: FavoriteProvider[] }
        | { error?: string };

      if (!active || !response.ok || !("profile" in result)) {
        return;
      }

      setProfile(result.profile);
      setBookingSummary(result.bookingSummary);
      setPaymentSummary(result.paymentSummary);

      if (favoritesResponse.ok && "favoriteProviders" in favoritesResult) {
        setFavoriteProviders(favoritesResult.favoriteProviders);
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
      <WalletSummaryCard
        walletBalance={paymentSummary.walletBalance}
        companyPayable={paymentSummary.companyPayable}
        walletPanel={walletPanel}
        selectedBank={selectedBank}
        walletMessage={walletMessage}
        onSelectedBankChange={setSelectedBank}
        onWithdrawClick={handleWithdrawClick}
        onPayableClick={handlePayableClick}
        onConnectBank={handleConnectBank}
        onPayCompany={handlePayCompany}
        onClosePanel={() => setWalletPanel("closed")}
      />

      <SectionCard
        title="Personal Information"
        actionHref="/profile/edit"
        actionLabel="View All"
      >
        <ProfileInfoRow icon={<UserIcon className="h-4 w-4" />} label="First Name" value={profile.firstName} />
        <ProfileInfoRow icon={<UserIcon className="h-4 w-4" />} label="Last Name" value={profile.lastName} />
        <ProfileInfoRow icon={<UserIcon className="h-4 w-4" />} label="Gender" value={profile.sex || "Male"} />
        <ProfileInfoRow icon={<CalendarIcon className="h-4 w-4" />} label="Date of Birth" value={profile.dateOfBirth} />
        <ProfileInfoRow icon={<MailIcon className="h-4 w-4" />} label="Email" value={profile.email} />
        <ProfileInfoRow icon={<PhoneIcon className="h-4 w-4" />} label="Phone Number" value={`${profile.countryCode} ${profile.phoneNumber}`} />
      </SectionCard>

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

      const {
        data: { session },
      } = await client.auth.getSession();

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
        setError(("error" in result ? result.error : "") || "Unable to load favourite providers right now.");
        return;
      }

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

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      setError("Your session expired. Please log in again.");
      return;
    }

    const previousItems = items;
    const nextItems = previousItems.filter((item) => item.id !== providerId);
    setItems(nextItems);
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
      setError(result.error || "Unable to remove favourite provider right now.");
      setItems(previousItems);
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
  const [verificationBusy, startVerificationTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function loadLiveProfile() {
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

    if (!file) {
      return;
    }

    void (async () => {
      const cropped = await cropImageToSquareDataUrl(file);
      setForm((current) => ({
        ...current,
        avatarUrl: cropped,
      }));
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
              accept="image/png,image/jpeg,image/jpg"
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
        </div>

        <div className="mt-5 rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-extrabold text-[#111827]">
                Verification
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-[#4b5563]">
                Your account can use all functions now. You can still mark the profile as verified here.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${form.verified ? "bg-[#f5f1fa] text-[#8E5EB5]" : "bg-[#fff7ed] text-[#f59e0b]"}`}>
              {form.verified ? "Verified" : "Pending"}
            </span>
          </div>
          <button
            type="button"
            disabled={verificationBusy || form.verified}
            onClick={() => {
              startVerificationTransition(async () => {
                setForm((current) => ({ ...current, verified: true, completion: Math.max(current.completion, 100) }));
                await saveCustomerProfile({
                  ...form,
                  verified: true,
                  completion: Math.max(form.completion, 100),
                });
                setSavedMessage("Verification updated.");
              });
            }}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-[12px] bg-[#8E5EB5] px-4 text-[14px] font-extrabold text-white disabled:opacity-70"
          >
            {verificationBusy ? "Updating..." : form.verified ? "Already Verified" : "Verify Account"}
          </button>
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

      const {
        data: { session },
      } = await client.auth.getSession();

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

      const {
        data: { session },
      } = await client.auth.getSession();

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

export function BookingsScreen({ bookings, initialTab = "pending" }: BookingsProps) {
  const [items, setItems] = useState(bookings);
  const filtered = items;

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

    async function loadLiveBookings() {
      if (!client) {
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!active || !session) {
        return;
      }

      const response = await fetch("/api/bookings", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as
        | { bookings: Booking[] }
        | { error?: string };

      if (!active || !response.ok || !("bookings" in result)) {
        return;
      }

      setItems(result.bookings);

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
        {filtered.length === 0 ? (
          <SharedEmptyState
            title="No bookings yet"
            description="When you create or finish bookings, they will appear here with live status updates."
            action={<AppButton href="/providers">Find Providers</AppButton>}
          />
        ) : null}
        {filtered.map((booking) => (
          <div
            key={booking.id}
            className="rounded-[26px] border border-[#eadff8] bg-[linear-gradient(180deg,#fffefe_0%,#fffafc_100%)] p-4 shadow-[0_18px_38px_rgba(106,69,160,0.1)]"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-[18px] border border-[#f2e8fb] bg-[#fffaf0] p-1.5 shadow-[0_12px_24px_rgba(106,69,160,0.08)]">
                <BookingThumb
                  kind={booking.thumbnail}
                  imageSrc={booking.imageSrc}
                  avatarSrc={booking.providerAvatarUrl}
                  service={booking.service}
                  providerName={booking.providerFullName || booking.provider}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[1.35rem] font-black leading-7 tracking-[-0.04em] text-[#1f1630]">
                      {booking.providerFullName || booking.provider}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-[#7b728a]">{booking.service}</p>
                  </div>
                  <SharedStatusBadge label={booking.statusLabel} tone={bookingTone(booking)} />
                </div>
                <div className="mt-4 space-y-0 overflow-hidden rounded-[20px] border border-[#f0e7fb] bg-white/90">
                  <div className="flex items-start gap-3 px-4 py-3 text-[13px] text-[#544b66]">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f6effd] text-[#8E5EB5]">
                      <CalendarIcon className="h-4.5 w-4.5" />
                    </span>
                    <span className="pt-1 font-semibold leading-6">{booking.schedule}</span>
                  </div>
                  <div className="h-px bg-[#f3ebfb]" />
                  <div className="flex items-start gap-3 px-4 py-3 text-[13px] text-[#544b66]">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f6effd] text-[#8E5EB5]">
                      <PinIcon className="h-4.5 w-4.5" />
                    </span>
                    <span className="pt-1 font-semibold leading-6">{booking.location}</span>
                  </div>
                  <div className="h-px bg-[#f3ebfb]" />
                  <div className="flex items-center gap-3 px-4 py-3 text-[13px] text-[#544b66]">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f6effd] text-[#8E5EB5]">
                      <WalletIcon className="h-4.5 w-4.5" />
                    </span>
                    <span className="font-black text-[#1f1630]">{formatBookingAmount(booking.paymentAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Link
              href={`/profile/bookings/${booking.id}`}
              className="mt-4 flex h-12 w-full items-center justify-between rounded-[16px] bg-[linear-gradient(135deg,#7c3aed_0%,#5b21b6_100%)] px-4 text-[15px] font-extrabold text-white shadow-[0_16px_32px_rgba(91,33,182,0.25)]"
            >
              <span>Track Task</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Link>

            <div className="mt-4 rounded-[22px] border border-[#efe4fb] bg-white p-4 shadow-[0_12px_24px_rgba(106,69,160,0.05)]">
              <p className="text-[1rem] font-black tracking-[-0.03em] text-[#1f1630]">Current Status</p>
              <BookingStatusSummary booking={booking} />
            </div>

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
        setLogoutError("Supabase is not configured yet.");
        return;
      }

      const { error } = await client.auth.signOut();

      if (error) {
        setLogoutError(error.message || "Unable to log out right now.");
        return;
      }

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
  const searchParams = useSearchParams();
  const [paymentError, setPaymentError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [paymentLoading, startPaymentTransition] = useTransition();
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState("");
  const [paymentProofFileName, setPaymentProofFileName] = useState("");
  const [paymentProofMimeType, setPaymentProofMimeType] = useState("");
  const paymentMarkedPaid =
    booking.paymentStatus === "paid" ||
    ["cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus);
  const canPayNow = booking.workflowStatus === "final_payment_sent" && !paymentMarkedPaid;
  const canReview =
    ["cash_paid_by_user", "payment_received_by_provider", "completed"].includes(booking.workflowStatus) &&
    booking.userReviewStatus !== "submitted";
  const paidDateLabel =
    canPayNow
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
    if (searchParams.get("payment") === "success") {
      setPaymentNotice("Cash payment confirmed successfully.");
    }
  }, [searchParams]);

  function handleCashPaid() {
    const client = getSupabaseClient();

    startPaymentTransition(async () => {
      setPaymentError("");
      setPaymentNotice("");

      if (!client) {
        setPaymentError("Supabase is not configured yet.");
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

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
      setPaymentProofDataUrl(dataUrl);
      setPaymentProofFileName(file.name);
      setPaymentProofMimeType(file.type);
      setPaymentError("");
    } catch {
      setPaymentError("Unable to read the payment proof file.");
    }
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
                    <img src={image} alt={`Job photo ${index + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-[20px] border border-[#ebe2f8] bg-white p-4">
            <p className="text-[15px] font-black text-[#8E5EB5]">Payment Summary</p>
            <div className="mt-4 space-y-3 text-[14px] text-[#24193a]">
              <div className="flex items-center justify-between gap-3">
                <span>Fixed Amount</span>
                <span className="font-semibold">RM {booking.baseAmount ?? booking.paymentAmount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Additional Amount</span>
                <span className="font-semibold">RM {booking.additionalCharge ?? 0}</span>
              </div>
              <div className="rounded-[16px] bg-[#faf6ff] px-4 py-3">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8E5EB5]">Description</p>
                <p className="mt-2 text-[13px] leading-6 text-[#4c4561]">
                  {booking.additionalChargeDescription || booking.paymentNote || "No additional description provided."}
                </p>
              </div>
              <div className="border-t border-dashed border-[#ddd4ea] pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[1rem] font-black text-[#8E5EB5]">Total Amount</span>
                  <span className="text-[1.6rem] font-black text-[#8E5EB5]">RM {booking.paymentAmount ?? 0}</span>
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
                <label className="flex cursor-pointer items-center justify-between rounded-[16px] border border-[#d9c7ef] bg-white px-4 py-4 text-[14px] font-semibold text-[#8E5EB5]">
                  <span>Attach images or take photo</span>
                  <span className="text-[12px] text-[#7f7692]">JPG, PNG, GIF, WebP, PDF</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,application/pdf,image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(event) => void handlePaymentProofChange(event)}
                  />
                </label>
                {paymentProofDataUrl ? (
                  <PaymentProofPreview
                    title="New Payment Proof"
                    dataUrl={paymentProofDataUrl}
                    fileName={paymentProofFileName}
                    mimeType={paymentProofMimeType}
                  />
                ) : null}
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

      <section className="mt-4 rounded-[24px] border border-[#ebe2f8] bg-white p-4 shadow-[0_14px_30px_rgba(106,69,160,0.07)]">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
          Payment Method
        </p>
        <div className="mt-4">
          <div className="rounded-[18px] border-2 border-[#8E5EB5] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(142,94,181,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-black text-[#1f1630]">Cash</p>
                <p className="mt-1 text-[12px] text-[#6d6480]">Pay directly to provider</p>
              </div>
              <span className="rounded-full bg-[#8E5EB5] px-2 py-1 text-[11px] font-bold text-white">
                Active
              </span>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-[#8f86a2]">
            Cash is the only customer payment option available for now. More payment methods can be added later.
          </p>
        </div>
      </section>

      {paymentError ? (
        <p className="mt-4 rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
          {paymentError}
        </p>
      ) : null}

      {paymentNotice || searchParams.get("payment") === "success" ? (
        <p className="mt-4 rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
          {paymentNotice || "Cash payment confirmed successfully."}
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

      <SectionCard title="Notes">
        <p className="text-[14px] leading-6 text-[#374151]">
          {booking.notes || "No additional note added for this booking."}
        </p>
      </SectionCard>

    </ProfileShell>
  );
}

export function BookingReviewScreen({ booking }: BookingReviewProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
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

    const {
      data: { session },
    } = await client.auth.getSession();

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
            <BookingThumb kind={booking.thumbnail} imageSrc={booking.imageSrc} service={booking.service} />
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
                .then((items) => setPhotos(items))
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
  const [selectedMonth, setSelectedMonth] = useState(TODAY_ISO.slice(0, 7));
  const [dateFrom, setDateFrom] = useState(() => {
    const initial = new Date();
    initial.setDate(initial.getDate() - 90);
    return initial.toISOString().split("T")[0] ?? TODAY_ISO;
  });
  const [dateTo, setDateTo] = useState(TODAY_ISO);

  useEffect(() => {
    let active = true;

    async function loadLivePayments() {
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

      const response = await fetch("/api/profile/payments", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as
        | { payments: PaymentHistoryItem[] }
        | { error?: string };

      if (!active || !response.ok || !("payments" in result)) {
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

    return months.length > 0 ? months : [TODAY_ISO.slice(0, 7)];
  }, [items]);

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0] ?? TODAY_ISO.slice(0, 7));
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

      const {
        data: { session },
      } = await client.auth.getSession();

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

    const {
      data: { session },
    } = await client.auth.getSession();

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
    <div className="rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
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
    </div>
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
  companyPayable,
  walletPanel,
  selectedBank,
  walletMessage,
  onSelectedBankChange,
  onWithdrawClick,
  onPayableClick,
  onConnectBank,
  onPayCompany,
  onClosePanel,
}: {
  walletBalance: number;
  companyPayable: number;
  walletPanel: "closed" | "withdraw" | "payable";
  selectedBank: string;
  walletMessage: string;
  onSelectedBankChange: (value: string) => void;
  onWithdrawClick: () => void;
  onPayableClick: () => void;
  onConnectBank: () => void;
  onPayCompany: () => void;
  onClosePanel: () => void;
}) {
  const bankOptions = ["Maybank", "CIMB", "Public Bank", "RHB Bank"];

  return (
    <section className="mt-4 overflow-hidden rounded-[22px] border border-[#e7def4] bg-[linear-gradient(135deg,#ffffff_0%,#f8f3fd_100%)] p-4 shadow-[0_16px_36px_rgba(104,63,155,0.1)]">
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

      <div className="mt-4 rounded-[18px] border border-[#ede4f8] bg-white/90 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8E5EB5]">
              Payable to Company
            </p>
            <p className="mt-1 text-[1.4rem] font-black tracking-[-0.05em] text-[#1f1630]">
              {formatRinggit(companyPayable)}
            </p>
          </div>
          <span className="rounded-full bg-[#f5f1fa] px-3 py-1 text-[11px] font-bold text-[#8E5EB5]">
            DELLA
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onWithdrawClick}
          className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#8E5EB5] px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]"
        >
          Withdraw
        </button>
        <button
          type="button"
          onClick={onPayableClick}
          className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#d9c8ee] bg-white px-4 text-[14px] font-extrabold text-[#8E5EB5]"
        >
          Pay to Company
        </button>
      </div>

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
              onClick={onClosePanel}
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
                onClick={() => onSelectedBankChange(bank)}
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
            onClick={onConnectBank}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#22c55e] px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(34,197,94,0.18)]"
          >
            Connect and Withdraw
          </button>
        </div>
      ) : null}

      {walletPanel === "payable" ? (
        <div className="mt-4 rounded-[18px] border border-[#e8def6] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-extrabold text-[#1f1630]">Pay company now</p>
              <p className="mt-1 text-[12px] text-[#7c728f]">
                Confirm payment of {formatRinggit(companyPayable)} to DELLA.
              </p>
            </div>
            <button
              type="button"
              onClick={onClosePanel}
              className="text-[12px] font-bold text-[#8E5EB5]"
            >
              Close
            </button>
          </div>
          <button
            type="button"
            onClick={onPayCompany}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#8E5EB5] px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]"
          >
            Pay {formatRinggit(companyPayable)}
          </button>
        </div>
      ) : null}

      {walletMessage ? (
        <p className="mt-4 rounded-[14px] border border-[#d7efdb] bg-[#effbf1] px-4 py-3 text-[12px] font-semibold text-[#1f6b37]">
          {walletMessage}
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
          max={TODAY_ISO}
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-[#E8ECE8] bg-white/97 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-1 text-[10.5px] font-medium text-[#8A94A6]">
        <NavItem href="/home" label="Home" icon={<HomeIcon className="h-5 w-5" />} active={pathname === "/home"} />
        <NavItem href="/profile/bookings" label="Bookings" icon={<CalendarIcon className="h-5 w-5" />} active={pathname.startsWith("/profile/bookings")} />
        <NavItem href="/profile/notifications" label="Alerts" icon={<BellIcon className="h-5 w-5" />} active={pathname.startsWith("/profile/notifications")} />
        <NavItem href="/profile/favourites" label="Favourite" icon={<UserIcon className="h-5 w-5" />} active={pathname.startsWith("/profile/favourites")} />
        <NavItem href="/profile" label="Profile" icon={<UserIcon className="h-5 w-5" />} active={pathname === "/profile" || pathname.startsWith("/profile/edit") || pathname.startsWith("/profile/addresses") || pathname.startsWith("/profile/settings")} />
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

async function cropImageToSquareDataUrl(file: File) {
  const sourceDataUrl = await readFileAsDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const size = Math.min(image.width, image.height);
      const offsetX = Math.max(0, (image.width - size) / 2);
      const offsetY = Math.max(0, (image.height - size) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Unable to process this image."));
        return;
      }

      context.drawImage(image, offsetX, offsetY, size, size, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => reject(new Error("Unable to process this image."));
    image.src = sourceDataUrl;
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
