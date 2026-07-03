"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppButton, LoadingState } from "@/app/_components/della-ui";
import { BookingDetailScreen } from "@/app/profile/_components/profile-ui";
import { getSupabaseClient } from "@/lib/supabase";
import type { Booking } from "@/lib/profile-types";

export default function ProfileBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [missing, setMissing] = useState(false);
  const [resolvedId, setResolvedId] = useState("");

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

    async function loadBooking() {
      const { id } = await params;

      if (!active) {
        return;
      }

      setResolvedId(id);

      if (!client) {
        setMissing(true);
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!active || !session) {
        setMissing(true);
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
        setMissing(true);
        return;
      }

      const match = result.bookings.find((item) => item.id === id) ?? null;
      setBooking(match);
      setMissing(!match);

      if (!bookingsChannel) {
        bookingsChannel = client
          .channel(`customer-booking-detail-${session.user.id}-${id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `customer_id=eq.${session.user.id}`,
            },
            () => {
              scheduleRefresh(loadBooking);
            },
          )
          .subscribe();
      }

      if (!paymentsChannel) {
        paymentsChannel = client
          .channel(`customer-booking-detail-payments-${session.user.id}-${id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "payments",
              filter: `booking_id=eq.${id}`,
            },
            () => {
              scheduleRefresh(loadBooking);
            },
          )
          .subscribe();
      }
    }

    void loadBooking();

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
  }, [params]);

  if (booking) {
    return <BookingDetailScreen booking={booking} />;
  }

  if (!missing) {
    return <LoadingState title="Loading booking" description="Please wait while we load your booking details." />;
  }

  return (
    <main className="min-h-[100dvh] bg-[#f6fff8] px-4 py-6">
      <div className="mx-auto max-w-[430px]">
        <div className="rounded-[24px] border border-[#e4ece7] bg-white p-6 text-center shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <h1 className="text-[20px] font-extrabold text-[#0f172a]">
            Booking not found
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-[#64748b]">
            We could not find booking {resolvedId ? `#${resolvedId}` : "details"} for this account.
          </p>
          <div className="mt-5 flex justify-center">
            <AppButton
              type="button"
              onClick={() => router.replace("/profile/bookings")}
            >
              Back to Bookings
            </AppButton>
          </div>
        </div>
      </div>
    </main>
  );
}
