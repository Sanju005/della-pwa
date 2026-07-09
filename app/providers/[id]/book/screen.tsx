"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  IdCard,
  MapPin,
  Minus,
  Phone,
  Plus,
  Star,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";

import { FavoriteProviderButton } from "@/app/_components/favorite-provider-button";
import { ProviderDistanceText } from "@/app/_components/provider-distance";
import type { ProviderBookedTimeRange, ProviderDetail } from "@/lib/provider-detail";
import {
  loadSelectedProviderSearchLocation,
  loadCurrentLiveLocation,
  loadSavedPlaces,
  resolveCurrentLiveLocation,
  type StoredLiveLocation,
} from "@/lib/live-location";
import { getFreshSupabaseSession, getSupabaseClient } from "@/lib/supabase";

type BookingMode = "hourly" | "daily";

function toIsoDateFromBookingLabel(value: string) {
  const parts = value.split(",").map((part) => part.trim());
  const datePart = parts.length >= 2 ? parts.slice(1).join(", ") : value.trim();
  const parsed = new Date(datePart);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function getCurrentKualaLumpurNow() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const getValue = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${getValue("year")}-${getValue("month")}-${getValue("day")}`,
    minutes: Number(getValue("hour")) * 60 + Number(getValue("minute")),
  };
}

function waitForBookingRetry(attempt: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 400 * (attempt + 1));
  });
}

async function fetchBookingJsonWithRetry<T>(init: RequestInit, attempts = 3) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch("/api/bookings", init);
      const result = (await response.json().catch(() => null)) as T | null;
      return { response, result };
    } catch (error) {
      lastError = error;

      if (attempt < attempts - 1) {
        await waitForBookingRetry(attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to fetch");
}

function timeToMinutes(label: string) {
  const [time, period] = label.split(" ");
  const [rawHour, rawMinute] = time.split(":").map(Number);
  let hour = rawHour % 12;
  if (period === "PM") {
    hour += 12;
  }
  return hour * 60 + rawMinute;
}

function minutesToTimeLabel(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function addHours(label: string, hours: number) {
  return minutesToTimeLabel(timeToMinutes(label) + hours * 60);
}

function hoursBetween(start: string, end: string) {
  const difference = timeToMinutes(end) - timeToMinutes(start);
  return Math.max(1, Math.round(difference / 60));
}

function toDateLabel(dayLabel: string, dateLabel: string) {
  return `${dayLabel}, ${dateLabel}`;
}

function buildHourlyStartOptions(startLabel: string, endLabel: string) {
  if (!startLabel || !endLabel) {
    return [];
  }

  const startMinutes = timeToMinutes(startLabel);
  const endMinutes = timeToMinutes(endLabel);
  const options: string[] = [];

  for (let current = startMinutes; current < endMinutes; current += 60) {
    options.push(minutesToTimeLabel(current));
  }

  return options;
}

function doesTimeRangeOverlap(
  startLabel: string,
  endLabel: string,
  bookedRange: ProviderBookedTimeRange,
) {
  const startMinutes = timeToMinutes(startLabel);
  const endMinutes = timeToMinutes(endLabel);
  const bookedStartMinutes = timeToMinutes(bookedRange.startTimeLabel);
  const bookedEndMinutes = timeToMinutes(bookedRange.endTimeLabel);

  return startMinutes < bookedEndMinutes && endMinutes > bookedStartMinutes;
}

export function BookingFormScreen({
  detail,
  serviceQuery,
  initialDateQuery,
}: {
  detail: ProviderDetail;
  serviceQuery: string | null;
  initialDateQuery: string | null;
}) {
  const router = useRouter();
  const availableSlots = detail.availability.filter((slot) => slot.state === "available");
  const defaultSlot = availableSlots[0] ?? detail.availability[0];
  const queriedCalendarDate = initialDateQuery
    ? detail.calendarDates.find((date) => date.isoDate === initialDateQuery)
    : null;
  const defaultDateLabel = queriedCalendarDate
    ? `${queriedCalendarDate.weekdayShort}, ${new Date(
        `${queriedCalendarDate.isoDate}T00:00:00`
      ).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    : initialDateQuery ?? toDateLabel(defaultSlot.dayLabel, defaultSlot.dateLabel);
  const defaultStartTime = defaultSlot?.startTimeLabel || "10:00 AM";
  const defaultEndTime = defaultSlot?.endTimeLabel || addHours(defaultStartTime, 1);

  const [bookingMode, setBookingMode] = useState<BookingMode>("hourly");
  const [selectedDate, setSelectedDate] = useState(defaultDateLabel);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [hourlyDuration, setHourlyDuration] = useState(1);
  const [serviceAddress, setServiceAddress] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<StoredLiveLocation[]>([]);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowInKl, setNowInKl] = useState(() => ({
    date: "",
    minutes: -1,
  }));
  const selectedDateIso = toIsoDateFromBookingLabel(selectedDate);
  const selectedAvailabilitySlot =
    detail.availability.find((slot) => toDateLabel(slot.dayLabel, slot.dateLabel) === selectedDate) ??
    defaultSlot;
  const bookedTimeRangesForSelectedDate =
    (selectedAvailabilitySlot?.isoDate
      ? detail.bookedTimeRangesByDate[selectedAvailabilitySlot.isoDate]
      : []) ?? [];
  const providerStartTime = selectedAvailabilitySlot?.startTimeLabel || "";
  const providerEndTime = selectedAvailabilitySlot?.endTimeLabel || "";
  const providerStartTimeOptions = useMemo(
    () => buildHourlyStartOptions(providerStartTime, providerEndTime),
    [providerEndTime, providerStartTime],
  );
  useEffect(() => {
    setNowInKl(getCurrentKualaLumpurNow());
  }, []);

  const filteredStartTimeOptions = useMemo(() => {
    if (providerStartTimeOptions.length === 0) {
      return [];
    }

    if (selectedDateIso !== nowInKl.date) {
      return providerStartTimeOptions.filter((option) => {
        const candidateEnd = addHours(option, hourlyDuration);
        return !bookedTimeRangesForSelectedDate.some((bookedRange) =>
          doesTimeRangeOverlap(option, candidateEnd, bookedRange),
        );
      });
    }

    return providerStartTimeOptions
      .filter((option) => timeToMinutes(option) > nowInKl.minutes)
      .filter((option) => {
        const candidateEnd = addHours(option, hourlyDuration);
        return !bookedTimeRangesForSelectedDate.some((bookedRange) =>
          doesTimeRangeOverlap(option, candidateEnd, bookedRange),
        );
      });
  }, [
    bookedTimeRangesForSelectedDate,
    hourlyDuration,
    nowInKl.date,
    nowInKl.minutes,
    providerStartTimeOptions,
    selectedDateIso,
  ]);

  useEffect(() => {
    if (!filteredStartTimeOptions.includes(startTime)) {
      const nextStart = filteredStartTimeOptions[0];
      if (nextStart) {
        setStartTime(nextStart);
      }
    }
  }, [filteredStartTimeOptions, startTime]);

  useEffect(() => {
    const selectedSearchLocation = loadSelectedProviderSearchLocation();
    const currentLocation = loadCurrentLiveLocation();
    const availablePlaces = loadSavedPlaces();
    setSavedPlaces(availablePlaces);
    setServiceAddress(
      selectedSearchLocation?.formattedAddress ||
        selectedSearchLocation?.label ||
      currentLocation?.formattedAddress ||
        currentLocation?.label ||
        availablePlaces[0]?.formattedAddress ||
        availablePlaces[0]?.label ||
        ""
    );
  }, []);

  const computedEndTime = bookingMode === "daily"
    ? providerEndTime || addHours(startTime, 9)
    : addHours(startTime, hourlyDuration);
  const durationHours =
    bookingMode === "daily"
      ? hoursBetween(startTime, computedEndTime)
      : hourlyDuration;
  const totalAmount =
    bookingMode === "daily"
      ? detail.dailyRate
      : detail.hourlyRate * durationHours;
  const bookingDateLabel = selectedDate;
  const bookingStartLabel = startTime;
  const bookingEndLabel = computedEndTime;
  const bookingTimeLabel = `${startTime} - ${computedEndTime}`;

  async function handleBooking() {
    try {
      setPending(true);
      setError(null);

      if (!serviceAddress.trim()) {
        throw new Error("Please choose or enter the service address.");
      }

      const client = getSupabaseClient();

      if (!client) {
        throw new Error("Supabase is not configured yet.");
      }

      const session = await getFreshSupabaseSession(client);

      if (!session) {
        router.push("/login");
        return;
      }

      const { response, result: payload } = await fetchBookingJsonWithRetry<
        { error?: string; booking?: unknown }
      >({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          providerId: detail.id,
          providerName: detail.name,
          serviceKey: detail.serviceKey,
          serviceLabel: detail.serviceLabel,
          location: serviceAddress.trim(),
          bookingMode,
          dateLabel: bookingDateLabel,
          startTimeLabel: bookingStartLabel,
          endTimeLabel: bookingEndLabel,
          timeLabel: bookingTimeLabel,
          durationHours,
          notes: [locationNote.trim(), notes.trim()].filter(Boolean).join("\n"),
          hourlyRate: detail.hourlyRate,
          dailyRate: detail.dailyRate,
          totalAmount,
        }),
      });

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to create booking right now.");
      }

      router.push("/profile/bookings?created=1");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create booking right now."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#faf7fd]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-white px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="py-4 pb-34">
          <header className="flex items-center justify-between">
            <Link
              href={
                serviceQuery
                  ? `/providers/${encodeURIComponent(detail.id)}?service=${encodeURIComponent(serviceQuery)}`
                  : `/providers/${encodeURIComponent(detail.id)}`
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0F172A]"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-[15px] font-extrabold text-[#0F172A]">
              Book {detail.name}
            </h1>
            <FavoriteProviderButton
              providerId={detail.id}
              serviceKey={detail.serviceKey}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full"
              activeClassName="text-[#E11D48]"
              inactiveClassName="text-[#0F172A]"
            />
          </header>

          <section className="mt-4 rounded-[22px] border border-[#E7ECE8] bg-white p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
            <div className="flex gap-3">
              <div className="relative h-[9rem] w-[7.4rem] shrink-0 overflow-hidden rounded-[18px]">
                <Image
                  src={detail.profileImage}
                  alt={detail.name}
                  width={280}
                  height={336}
                  unoptimized
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2.5 left-2.5 rounded-full bg-[#8E5EB5] px-2.5 py-1 text-[11px] font-bold text-white">
                  {detail.availabilityLabel}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h2 className="truncate text-[15px] font-extrabold text-[#0F172A]">
                    {detail.name}
                  </h2>
                  <BadgeCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 fill-[#8E5EB5] text-[#8E5EB5]" />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#475467]">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                    <span className="font-semibold text-[#0F172A]">{detail.reviewsLabel}</span>
                  </span>
                  <span className="text-[#D0D5DD]">|</span>
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5 fill-[#8E5EB5] text-[#8E5EB5]" />
                    <span className="font-semibold text-[#0F172A]">98%</span>
                    <span>(On-time)</span>
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[13px] text-[#475467]">
                  <MapPin className="h-3.5 w-3.5 text-[#8E5EB5]" />
                  <span>
                    <ProviderDistanceText
                      providerLatitude={detail.latitude}
                      providerLongitude={detail.longitude}
                      fallbackDistanceKm={detail.distanceKm}
                    />
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#F5F1FA] px-3 py-1.5 text-[12px] font-semibold text-[#8E5EB5]">
                    {detail.yearsExperience} Experience
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-[16px] bg-[#FAF7FD] px-3 py-3">
                  <div
                    className={`flex min-w-0 items-center gap-2 rounded-[12px] border px-2.5 py-2 ${
                      detail.identityVerified
                        ? "border-[#CBE8D2] bg-[#F2FBF5]"
                        : "border-[#FDE2B7] bg-[#FFF8EE]"
                    }`}
                  >
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        detail.identityVerified
                          ? "bg-[#E7F8EC] text-[#16A34A]"
                          : "bg-[#FFF3E0] text-[#F59E0B]"
                      }`}
                    >
                      <IdCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-[11px] font-semibold leading-4 ${
                          detail.identityVerified ? "text-[#138A36]" : "text-[#D97706]"
                        }`}
                      >
                        {detail.identityVerified ? "IC Verified" : "IC Pending"}
                      </p>
                    </div>
                    <BadgeCheck
                      className={`ml-auto h-4 w-4 shrink-0 ${
                        detail.identityVerified
                          ? "fill-[#16A34A] text-[#16A34A]"
                          : "fill-[#F59E0B] text-[#F59E0B]"
                      }`}
                    />
                  </div>
                  <div
                    className={`flex min-w-0 items-center gap-2 rounded-[12px] border px-2.5 py-2 ${
                      detail.phoneVerified
                        ? "border-[#CBE8D2] bg-[#F2FBF5]"
                        : "border-[#FDE2B7] bg-[#FFF8EE]"
                    }`}
                  >
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        detail.phoneVerified
                          ? "bg-[#E7F8EC] text-[#16A34A]"
                          : "bg-[#FFF3E0] text-[#F59E0B]"
                      }`}
                    >
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-[11px] font-semibold leading-4 ${
                          detail.phoneVerified ? "text-[#138A36]" : "text-[#D97706]"
                        }`}
                      >
                        {detail.phoneVerified ? "Phone Verified" : "Phone Pending"}
                      </p>
                    </div>
                    <BadgeCheck
                      className={`ml-auto h-4 w-4 shrink-0 ${
                        detail.phoneVerified
                          ? "fill-[#16A34A] text-[#16A34A]"
                          : "fill-[#F59E0B] text-[#F59E0B]"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E7ECE8] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-extrabold text-[#0F172A]">
              1. Service Type
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBookingMode("hourly")}
                className={`rounded-[16px] border px-4 py-3.5 text-left ${
                  bookingMode === "hourly"
                    ? "border-[#8E5EB5] shadow-[0_0_0_1px_rgba(142,94,181,0.16)]"
                    : "border-[#E5ECE7]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F1FA] text-[#8E5EB5]">
                    <Clock3 className="h-5 w-5" />
                  </span>
                  <span
                    className={`h-6 w-6 rounded-full border-2 ${
                      bookingMode === "hourly"
                        ? "border-[#8E5EB5] bg-[#8E5EB5] shadow-[inset_0_0_0_3px_white]"
                        : "border-[#D0D5DD]"
                    }`}
                  />
                </div>
                <p className="mt-3 text-[14px] font-extrabold text-[#0F172A]">Hourly</p>
                <p className="mt-1 text-[13px] font-semibold text-[#8E5EB5]">RM{detail.hourlyRate} / hr</p>
              </button>

              <button
                type="button"
                onClick={() => setBookingMode("daily")}
                className={`rounded-[16px] border px-4 py-3.5 text-left ${
                  bookingMode === "daily"
                    ? "border-[#8E5EB5] shadow-[0_0_0_1px_rgba(142,94,181,0.16)]"
                    : "border-[#E5ECE7]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F7F6] text-[#667085]">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span
                    className={`h-6 w-6 rounded-full border-2 ${
                      bookingMode === "daily"
                        ? "border-[#8E5EB5] bg-[#8E5EB5] shadow-[inset_0_0_0_3px_white]"
                        : "border-[#D0D5DD]"
                    }`}
                  />
                </div>
                <p className="mt-3 text-[14px] font-extrabold text-[#0F172A]">Daily</p>
                <p className="mt-1 text-[13px] font-semibold text-[#667085]">RM{detail.dailyRate} / day</p>
              </button>
            </div>

            <div className="mt-3 rounded-[14px] border border-[#E8ECE8] bg-[#FBFCFC] px-3.5 py-2.5 text-[12px] leading-5 text-[#475467]">
              {bookingMode === "hourly"
                ? "Hourly booking lets you choose date, start time, and end time."
                : "Daily booking uses one date and start time only. End time is automatically set to 9 hours later."}
            </div>
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E7ECE8] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-extrabold text-[#0F172A]">
              2. Date & Time
            </h2>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {detail.availability.map((slot) => {
                const slotValue = toDateLabel(slot.dayLabel, slot.dateLabel);
                const active = selectedDate === slotValue;
                return (
                  <button
                    key={slotValue}
                    type="button"
                    disabled={slot.state !== "available"}
                    onClick={() => setSelectedDate(slotValue)}
                    className={`min-w-[4.6rem] rounded-[16px] border px-3 py-3 text-center ${
                      active
                        ? "border-[#8E5EB5] bg-[#F5F1FA] text-[#8E5EB5]"
                        : slot.state === "available"
                          ? "border-[#E5ECE7] bg-white text-[#0F172A]"
                          : "border-[#ECEFEC] bg-[#F8F9F8] text-[#98A2B3]"
                    }`}
                    >
                      <p className="text-[14px] font-semibold">{slot.dayLabel}</p>
                      <p className="mt-1 text-[13px]">{slot.dateLabel}</p>
                    </button>
                );
              })}
            </div>

            {selectedAvailabilitySlot?.state === "available" ? (
              <p className="mt-3 text-[13px] font-medium text-[#667085]">
                Working hours: {selectedAvailabilitySlot.timeLabel}
              </p>
            ) : null}

            {bookedTimeRangesForSelectedDate.length > 0 ? (
              <div className="mt-3">
                <p className="text-[13px] font-medium text-[#667085]">
                  Already booked
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bookedTimeRangesForSelectedDate.map((bookedRange) => (
                    <span
                      key={`${selectedAvailabilitySlot?.isoDate}-${bookedRange.startTimeLabel}-${bookedRange.endTimeLabel}`}
                      className="rounded-full border border-[#F3D6D6] bg-[#FFF6F6] px-3 py-1.5 text-[12px] font-semibold text-[#B42318]"
                    >
                      {bookedRange.startTimeLabel} - {bookedRange.endTimeLabel}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={`mt-5 grid gap-3 ${bookingMode === "hourly" ? "grid-cols-2" : "grid-cols-1"}`}>
              <label className="block">
                <span className="mb-2 block text-[14px] font-semibold text-[#344054]">
                  Start time
                </span>
                <span className="relative block">
                  <select
                    value={startTime}
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      setStartTime(nextStart);
                    }}
                    className="h-12 w-full appearance-none rounded-[14px] border border-[#E5ECE7] bg-white px-4 pr-10 text-[14px] font-semibold text-[#0F172A] outline-none"
                  >
                    {filteredStartTimeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667085]" />
                </span>
              </label>

              {bookingMode === "hourly" ? (
                <div className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-[#344054]">
                    How many hours
                  </span>
                  <div className="flex h-12 items-center justify-between rounded-[14px] border border-[#E5ECE7] bg-white px-3">
                    <button
                      type="button"
                      onClick={() => setHourlyDuration((current) => Math.max(1, current - 1))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F1FA] text-[#8E5EB5]"
                      aria-label="Decrease hours"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-[14px] font-semibold text-[#0F172A]">
                      {hourlyDuration} {hourlyDuration === 1 ? "Hour" : "Hours"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHourlyDuration((current) => current + 1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F1FA] text-[#8E5EB5]"
                      aria-label="Increase hours"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[16px] bg-[#F8F4FC] px-4 py-3.5">
                <p className="text-[13px] text-[#667085]">Estimated End Time</p>
                <p className="mt-1 text-[18px] font-extrabold text-[#8E5EB5]">
                  {computedEndTime}
                </p>
              </div>
              <div className="rounded-[16px] bg-[#F8F4FC] px-4 py-3.5">
                <p className="text-[13px] text-[#667085]">Duration</p>
                <p className="mt-1 text-[18px] font-extrabold text-[#0F172A]">
                  {durationHours} {durationHours === 1 ? "Hour" : "Hours"}
                </p>
              </div>
            </div>
            {filteredStartTimeOptions.length === 0 ? (
              <p className="mt-3 text-[13px] font-semibold text-[#B42318]">
                No available time slots remain for this date. Please choose another date.
              </p>
            ) : null}
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E7ECE8] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-extrabold text-[#0F172A]">
              3. Service Address
            </h2>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-2 block text-[14px] font-semibold text-[#344054]">
                  Service address
                </span>
                <textarea
                  value={serviceAddress}
                  onChange={(event) => setServiceAddress(event.target.value)}
                  placeholder="Enter the service address"
                  className="min-h-[6rem] w-full rounded-[16px] border border-[#E5ECE7] px-4 py-3.5 text-[14px] text-[#0F172A] outline-none placeholder:text-[#98A2B3]"
                />
              </label>
              {savedPlaces.length > 0 ? (
                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-[#344054]">
                    Saved address
                  </span>
                  <span className="relative block">
                    <select
                      value={serviceAddress}
                      onChange={(event) => setServiceAddress(event.target.value)}
                      className="h-12 w-full appearance-none rounded-[14px] border border-[#E5ECE7] bg-white px-4 pr-10 text-[14px] font-semibold text-[#0F172A] outline-none"
                    >
                      <option value={serviceAddress || ""}>Current / typed address</option>
                      {savedPlaces.map((place) => {
                        const value = place.formattedAddress || place.label;
                        return (
                          <option key={place.id ?? value} value={value}>
                            {place.addressLabel || "Saved address"} - {value}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667085]" />
                  </span>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  void resolveCurrentLiveLocation("Current location", { persist: "current" })
                    .then((location) => {
                      if (!location) {
                        setError("Location services are unavailable on this device.");
                        return;
                      }

                      const nextAddress = location.formattedAddress || location.label;
                      setServiceAddress(nextAddress);
                      setSavedPlaces(loadSavedPlaces());
                    })
                    .catch(() => {
                      setError("Unable to get your current location right now.");
                    })
                }
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#DCC9EF] bg-[#F8F2FD] px-4 text-[14px] font-extrabold text-[#8E5EB5]"
              >
                Use Current Location
              </button>
            </div>
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E7ECE8] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-extrabold text-[#0F172A]">
              4. Notes
            </h2>
            <label className="mt-3 block">
              <span className="mb-2 block text-[14px] font-semibold text-[#344054]">
                Gate number / landmark / access note
              </span>
              <textarea
                value={locationNote}
                onChange={(event) => setLocationNote(event.target.value.slice(0, 160))}
                placeholder="Example: Gate B, near the surau, call when you arrive"
                className="min-h-[5.6rem] w-full rounded-[16px] border border-[#E5ECE7] px-4 py-3.5 text-[14px] text-[#0F172A] outline-none placeholder:text-[#98A2B3]"
              />
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 200))}
              placeholder="Add any special service instructions..."
              className="mt-3 min-h-[7rem] w-full rounded-[16px] border border-[#E5ECE7] px-4 py-3.5 text-[14px] text-[#0F172A] outline-none placeholder:text-[#98A2B3]"
            />
            <p className="mt-2 text-right text-[13px] text-[#667085]">{notes.length}/200</p>
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E7ECE8] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8F4FC_100%)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-extrabold text-[#0F172A]">
              Booking Summary
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-3 text-[14px] text-[#475467]">
              <div>
                <p className="text-[13px] text-[#667085]">Service Type</p>
                <p className="mt-2 font-semibold text-[#0F172A]">
                  {bookingMode === "hourly" ? "Hourly" : "Daily"}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-[#667085]">Date & Time</p>
                <p className="mt-2 font-semibold text-[#0F172A]">
                  {bookingDateLabel}
                  <br />
                  {bookingTimeLabel}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-[#667085]">Duration</p>
                <p className="mt-2 font-semibold text-[#0F172A]">
                  {durationHours} {durationHours === 1 ? "Hour" : "Hours"}
                </p>
              </div>
            </div>
            <div className="mt-5 border-t border-dashed border-[#D9E3DC] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#0F172A]">Total</span>
                <span className="text-[23px] font-extrabold text-[#8E5EB5]">
                  RM{totalAmount.toFixed(2)}
                </span>
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#475467]">
                Payment method: Cash
              </p>
            </div>
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-[#E8ECE8] bg-white px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3.5">
          {error ? (
            <p className="mb-3 text-[13px] font-semibold text-[#B42318]">{error}</p>
          ) : null}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-[#667085]">Total</p>
              <p className="mt-1 text-[20px] font-extrabold text-[#8E5EB5]">
                RM{totalAmount.toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleBooking}
              disabled={pending || filteredStartTimeOptions.length === 0}
              className="inline-flex h-12 min-w-[11.5rem] items-center justify-center gap-2 rounded-[14px] bg-[#8E5EB5] px-5 text-[16px] font-extrabold text-white disabled:opacity-70"
            >
              {pending ? "Booking..." : "Schedule Booking"}
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-2 text-[12px] text-[#667085]">
            <ShieldCheck className="h-4 w-4 text-[#8E5EB5]" />
            <span>Cash payment will be reviewed after task completion</span>
          </div>
        </div>
      </div>
    </main>
  );
}
