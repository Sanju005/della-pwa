"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  Landmark,
  MessageCircleMore,
  UserRound,
  Wallet,
} from "lucide-react";

import { subscribeToForegroundPush } from "@/lib/notifications";
import { getFreshSupabaseSession, getSupabaseClient, signOutLocally } from "@/lib/supabase";

export type ProviderDashboardData = {
  providerId: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContactNumber: string;
  avatarUrl: string;
  accountStatus: string;
  marketingName: string;
  serviceLocation: string;
  serviceRadiusKm: number;
  country: string;
  bio: string;
  averageRating: number;
  totalReviews: number;
  approvalStatus: string;
  isVisible: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  identityVerificationStatus: "pending" | "processing" | "verified" | "rejected";
  identityDocumentType?: "ic" | "passport";
  identityFrontImageUrl: string;
  identityBackImageUrl: string;
  kycVerified: boolean;
  backgroundCheckVerified: boolean;
  services: Array<{
    id: string;
    serviceType: string;
    yearsExperience: string;
    hourlyRate: number;
    dailyRate: number;
    specialties: string[];
    imageDataUrls: string[];
    imageCaptions: string[];
    certificateDataUrls: string[];
    certificateCaptions: string[];
  }>;
};

export type ProviderBookingItem = {
  id: string;
  customerId: string;
  customerName: string;
  serviceLabel: string;
  serviceKey: string;
  location: string;
  bookingMode: "hourly" | "daily";
  bookingStatus:
    | "pending"
    | "pending_provider_response"
    | "declined"
    | "declined_by_provider"
    | "accepted"
    | "on_the_way"
    | "arrived"
    | "work_finished_by_provider"
    | "work_confirmed_by_user"
    | "final_payment_sent"
    | "cash_paid_by_user"
    | "payment_received_by_provider"
    | "completed"
    | "paid"
    | "review_requested"
    | "reviewed"
    | "cancelled";
  statusLabel: string;
  bucket: "requests" | "active" | "completed" | "closed";
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  schedule: string;
  customerNote: string;
  providerResponseNote: string;
  declineReason: string;
  quotedAmount: number;
  baseAmount: number;
  paymentStatus?: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  paymentOption?: "cash" | "online";
  companyCommissionAmount: number;
  companyPaymentStatus: "pending" | "payment_process" | "paid";
  providerCompanyPaymentAmount?: number;
  adminCompanyReceivedAmount?: number;
  providerNetAmount: number;
  customerPaymentProofDataUrl?: string;
  customerPaymentProofFileName?: string;
  customerPaymentProofMimeType?: string;
  providerCompanyPaymentProofDataUrl?: string;
  providerCompanyPaymentProofFileName?: string;
  providerCompanyPaymentProofMimeType?: string;
  additionalCharge: number;
  additionalChargeDescription: string;
  paymentBreakdown?: Array<{
    description: string;
    amount: number;
  }>;
  workFinishedImages?: string[];
  cashPaymentProofImages?: string[];
  userReviewStatus?: "pending" | "submitted" | "skipped";
  providerReviewStatus?: "pending" | "submitted" | "skipped";
  paymentNote: string;
  createdAt: string;
  acceptedAt?: string;
  onTheWayAt?: string;
  arrivedAt?: string;
  workFinishedAt?: string;
  workConfirmedByUserAt?: string;
  paymentSentAt?: string;
  cashPaidByUserAt?: string;
  paymentReceivedByProviderAt?: string;
  completedAt?: string;
  paidAt?: string;
  reviewRequestedAt?: string;
  reviewedAt?: string;
  providerReviewRating?: number;
  providerReviewComment?: string;
  providerReviewedAt?: string;
  customerStatusLabel: string;
};

export type ProviderNotificationItem = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type ProviderAvailabilityItem = {
  id: string;
  day: string;
  dayKey: string;
  timeMode: string;
  startTime: string;
  endTime: string;
};

export type ProviderMessageThread = {
  bookingId: string;
  customerId: string;
  customerName: string;
  serviceLabel: string;
  location: string;
  schedule: string;
  preview: string;
  lastMessageAt: string;
  lastSenderRole: "customer" | "provider" | "admin" | "system";
  unreadCount: number;
};

export type ProviderReviewItem = {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  createdLabel: string;
};

export function formatCurrency(value: number) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactCurrency(value: number) {
  return `RM${value.toLocaleString("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatServiceLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatTimeLabel(date: string, time: string) {
  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(`${date}T${time}`));
}

export function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.max(1, Math.round((now.getTime() - date.getTime()) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good Morning,";
  }

  if (hour < 18) {
    return "Good Afternoon,";
  }

  return "Good Evening,";
}

export function providerStatusTone(status: ProviderBookingItem["bookingStatus"]) {
  switch (status) {
    case "accepted":
    case "on_the_way":
    case "arrived":
    case "work_finished_by_provider":
    case "work_confirmed_by_user":
    case "final_payment_sent":
    case "cash_paid_by_user":
    case "payment_received_by_provider":
      return "accepted" as const;
    case "completed":
      return "completed" as const;
    case "declined_by_provider":
      return "declined" as const;
    case "cancelled":
      return "cancelled" as const;
    default:
      return "pending" as const;
  }
}

export function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

async function safeJsonResponse<T>(response: Response): Promise<T | { error?: string }> {
  try {
    return (await response.json()) as T | { error?: string };
  } catch {
    return { error: `Unable to read ${response.url || "response"}."` };
  }
}

export function useProviderAppData() {
  const router = useRouter();
  const [data, setData] = useState<ProviderDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookings, setBookings] = useState<ProviderBookingItem[]>([]);
  const [notifications, setNotifications] = useState<ProviderNotificationItem[]>([]);
  const [availability, setAvailability] = useState<ProviderAvailabilityItem[]>([]);
  const [availabilityEnabled, setAvailabilityEnabled] = useState(true);
  const [messages, setMessages] = useState<ProviderMessageThread[]>([]);
  const [reviews, setReviews] = useState<ProviderReviewItem[]>([]);
  const [actionBookingId, setActionBookingId] = useState("");
  const [, startTransition] = useTransition();

  async function loadWorkspace(accessToken: string) {
    setError("");
    let profileResponse: Response;
    let bookingsResponse: Response;
    let notificationsResponse: Response;
    let availabilityResponse: Response;
    let messagesResponse: Response;
    let reviewsResponse: Response;

    try {
      [
        profileResponse,
        bookingsResponse,
        notificationsResponse,
        availabilityResponse,
        messagesResponse,
        reviewsResponse,
      ] = await Promise.all([
        fetch("/api/provider/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch("/api/provider/bookings", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch("/api/provider/availability", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch("/api/provider/messages", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch("/api/provider/reviews", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load provider data.");
      setLoading(false);
      return false;
    }

    const profileResult = (await safeJsonResponse<ProviderDashboardData>(profileResponse)) as
      | ProviderDashboardData
      | { error?: string };
    const bookingsResult = (await safeJsonResponse<{ bookings: ProviderBookingItem[] }>(bookingsResponse)) as
      | { bookings: ProviderBookingItem[] }
      | { error?: string };
    const notificationsResult = (await safeJsonResponse<{ notifications: ProviderNotificationItem[] }>(notificationsResponse)) as
      | { notifications: ProviderNotificationItem[] }
      | { error?: string };
    const availabilityResult = (await safeJsonResponse<{ enabled: boolean; entries: ProviderAvailabilityItem[] }>(availabilityResponse)) as
      | { enabled: boolean; entries: ProviderAvailabilityItem[] }
      | { error?: string };
    const messagesResult = (await safeJsonResponse<{ threads: ProviderMessageThread[] }>(messagesResponse)) as
      | { threads: ProviderMessageThread[] }
      | { error?: string };
    const reviewsResult = (await safeJsonResponse<{ reviews: ProviderReviewItem[] }>(reviewsResponse)) as
      | { reviews: ProviderReviewItem[] }
      | { error?: string };

    if (!profileResponse.ok || !("providerId" in profileResult)) {
      setError(
        "error" in profileResult && profileResult.error
          ? profileResult.error
          : "Unable to load provider data.",
      );
      setLoading(false);
      return false;
    }

    setData(profileResult);
    if (!bookingsResponse.ok && "error" in bookingsResult && bookingsResult.error) {
      setError(bookingsResult.error);
    }
    setBookings(
      bookingsResponse.ok && "bookings" in bookingsResult ? bookingsResult.bookings : [],
    );
    setNotifications(
      notificationsResponse.ok && "notifications" in notificationsResult
        ? notificationsResult.notifications
        : [],
    );
    setAvailabilityEnabled(
      availabilityResponse.ok && "enabled" in availabilityResult
        ? availabilityResult.enabled
        : true,
    );
    setAvailability(
      availabilityResponse.ok && "entries" in availabilityResult ? availabilityResult.entries : [],
    );
    setMessages(
      messagesResponse.ok && "threads" in messagesResult ? messagesResult.threads : [],
    );
    setReviews(
      reviewsResponse.ok && "reviews" in reviewsResult ? reviewsResult.reviews : [],
    );
    setLoading(false);
    return true;
  }

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    let unsubscribeForegroundPush: (() => void) | undefined;
    let bookingsChannel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;
    let notificationsChannel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;
    let messagesChannel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let latestAccessToken = "";

    const scheduleWorkspaceRefresh = (delayMs = 500) => {
      if (!active || !latestAccessToken) {
        return;
      }

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        refreshTimeout = null;

        if (!active || !latestAccessToken) {
          return;
        }

        void loadWorkspace(latestAccessToken);
      }, delayMs);
    };

    const handleWindowFocus = () => {
      scheduleWorkspaceRefresh(0);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleWorkspaceRefresh(0);
      }
    };

    async function load() {
      if (!client) {
        if (active) {
          setError("Supabase is not configured yet.");
          setLoading(false);
        }
        return;
      }

      const session = await getFreshSupabaseSession(client);

      if (!active) {
        return;
      }

      if (!session) {
        router.replace("/login");
        return;
      }

      if (!active) {
        return;
      }

      latestAccessToken = session.access_token;

      await loadWorkspace(session.access_token);

      if (!active) {
        return;
      }

      bookingsChannel = client
        .channel(`provider-bookings-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `provider_id=eq.${session.user.id}`,
          },
          () => {
            scheduleWorkspaceRefresh();
          },
        )
        .subscribe();

      notificationsChannel = client
        .channel(`provider-notifications-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            scheduleWorkspaceRefresh();
          },
        )
        .subscribe();

      messagesChannel = client
        .channel(`provider-messages-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "booking_messages",
          },
          () => {
            scheduleWorkspaceRefresh();
          },
        )
        .subscribe();

      window.addEventListener("focus", handleWindowFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      unsubscribeForegroundPush = await subscribeToForegroundPush((path) => {
        router.push(path);
        scheduleWorkspaceRefresh(0);
      });
    }

    void load();

    return () => {
      active = false;
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeForegroundPush?.();
      if (client && bookingsChannel) {
        void client.removeChannel(bookingsChannel);
      }
      if (client && notificationsChannel) {
        void client.removeChannel(notificationsChannel);
      }
      if (client && messagesChannel) {
        void client.removeChannel(messagesChannel);
      }
    };
  }, [router]);

  async function reloadWorkspace() {
    const client = getSupabaseClient();

    if (!client) {
      return false;
    }

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      return false;
    }

    return loadWorkspace(session.access_token);
  }

  function handleBookingAction(
    bookingId: string,
    status: ProviderBookingItem["bookingStatus"],
    note = "",
    actionDetails?: {
      finalAmount?: number;
      workFinishedImages?: string[];
      paymentBreakdown?: Array<{
        description: string;
        amount: number;
      }>;
    },
  ) {
    const client = getSupabaseClient();

    startTransition(async () => {
      setError("");
      setNotice("");
      setActionBookingId(bookingId);

      if (!client) {
        setError("Supabase is not configured yet.");
        setActionBookingId("");
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session) {
        router.replace("/login");
        setActionBookingId("");
        return;
      }

      const response = await fetch(`/api/provider/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status,
          note,
          finalAmount: actionDetails?.finalAmount,
          workFinishedImages: actionDetails?.workFinishedImages,
          paymentBreakdown: actionDetails?.paymentBreakdown,
        }),
      }).catch((error) => {
        console.error("[Provider app] Booking action request failed:", error);
        return null;
      });

      if (!response) {
        setError("Unable to reach the server. Please try again.");
        setActionBookingId("");
        return;
      }

      const result = (await response.json().catch(() => ({}))) as {
        success?: true;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setError(result.error || "Unable to update booking.");
        setActionBookingId("");
        return;
      }

      await reloadWorkspace();
      setNotice(
        status === "accepted"
          ? "Booking accepted."
          : status === "declined_by_provider"
            ? "Booking declined."
            : "Booking updated.",
      );
      setActionBookingId("");
    });
  }

  async function handleCommissionSettlement(
    bookingIdOrProof?:
      | string
      | {
          proofDataUrl?: string;
          proofFileName?: string;
          proofMimeType?: string;
          depositedAmount?: number;
        },
    maybeProof?: {
      proofDataUrl?: string;
      proofFileName?: string;
      proofMimeType?: string;
      depositedAmount?: number;
    },
  ) {
    const client = getSupabaseClient();
    const proof =
      typeof bookingIdOrProof === "string" ? (maybeProof ?? {}) : (bookingIdOrProof ?? {});
    const actionKey = typeof bookingIdOrProof === "string" ? bookingIdOrProof : "provider-company-payment";
    setError("");
    setNotice("");
    setActionBookingId(actionKey);

    if (!client) {
      setError("Supabase is not configured yet.");
      setActionBookingId("");
      return false;
    }

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      router.replace("/login");
      setActionBookingId("");
      return false;
    }

    const response = await fetch("/api/provider/company-payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(proof),
    }).catch(() => null);

    const result = response
      ? ((await response.json().catch(() => ({}))) as { success?: true; error?: string })
      : null;

    if (!response || !response.ok || !result?.success) {
      setError(result?.error || "Unable to settle company commission.");
      setActionBookingId("");
      return false;
    }

    await reloadWorkspace();
    setNotice("Company commission submitted for admin approval.");
    setActionBookingId("");
    return true;
  }

  async function handleSignOut() {
    const client = getSupabaseClient();

    if (!client) {
      await signOutLocally(null);
      router.replace("/login");
      return;
    }

    await signOutLocally(client);
    router.replace("/login");
  }

  return {
    data,
    bookings,
    notifications,
    availability,
    availabilityEnabled,
    messages,
    reviews,
    loading,
    error,
    notice,
    actionBookingId,
    setError,
    setNotice,
    reloadWorkspace,
    handleBookingAction,
    handleCommissionSettlement,
    handleSignOut,
  };
}

export function ProviderBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLedgerView, setIsLedgerView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncLedgerView = () => {
      const params = new URLSearchParams(window.location.search);
      setIsLedgerView(pathname === "/provider/payments" && params.get("view") === "ledger");
    };

    syncLedgerView();
    window.addEventListener("popstate", syncLedgerView);

    return () => {
      window.removeEventListener("popstate", syncLedgerView);
    };
  }, [pathname]);

  const items = [
    {
      href: "/provider/dashboard",
      label: "Home",
      icon: <BriefcaseBusiness className="h-5 w-5" />,
      active: pathname === "/provider/dashboard",
    },
    {
      href: "/provider/bookings",
      label: "Bookings",
      icon: <CalendarDays className="h-5 w-5" />,
      active: pathname === "/provider/bookings" || pathname === "/provider/calendar",
    },
    {
      href: "https://app.dellaapp.com/provider/payments?view=ledger",
      label: "Ledger",
      icon: <Landmark className="h-5 w-5" />,
      active: isLedgerView,
    },
    {
      href: "/provider/payments",
      label: "Payments",
      icon: <Wallet className="h-5 w-5" />,
      active:
        (pathname === "/provider/payments" && !isLedgerView) ||
        pathname === "/provider/tasks" ||
        pathname === "/provider/earnings",
    },
    {
      href: "/provider/profile",
      label: "Profile",
      icon: <UserRound className="h-5 w-5" />,
      active: pathname === "/provider/profile" || pathname === "/provider/more",
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-[#ede4f7] bg-white/97 px-3 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-1 text-[10.5px] font-medium text-[#7f849f]">
        {items.map((item) => (
          item.label === "Ledger" || item.label === "Payments" ? (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign(item.href);
                  return;
                }

                router.push(item.href);
              }}
              className={`flex min-w-[3.1rem] flex-col items-center gap-1 transition ${
                item.active ? "text-[#8E5EB5]" : "text-[#7f849f]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              <span className="flex h-3 items-end">
                <span
                  className={`rounded-full transition-all ${
                    item.active ? "h-[3px] w-10 bg-[#8E5EB5]" : "h-[3px] w-6 bg-transparent"
                  }`}
                />
              </span>
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[3.1rem] flex-col items-center gap-1 transition ${
                item.active ? "text-[#8E5EB5]" : "text-[#7f849f]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              <span className="flex h-3 items-end">
                <span
                  className={`rounded-full transition-all ${
                    item.active ? "h-[3px] w-10 bg-[#8E5EB5]" : "h-[3px] w-6 bg-transparent"
                  }`}
                />
              </span>
            </Link>
          )
        ))}
      </div>
    </nav>
  );
}
