import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, FileText, Image as ImageIcon, MapPin, Star, User } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { SurfaceCard, InfoRow, MiniStatus } from "../components/user-detail-ui";
import { getBookingDetailWithFallback } from "../lib/admin-bookings";
import type { DashboardBooking } from "../types";

function isPdfAsset(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  return normalized.startsWith("data:application/pdf") || normalized.includes(".pdf");
}

function MediaGrid({
  title,
  images,
  empty,
}: {
  title: string;
  images?: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="size-4 text-slate-400" />
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      {images?.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <a
              key={`${title}-${index}`}
              href={image}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              {isPdfAsset(image) ? (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 px-3 text-center text-violet-700">
                  <span className="rounded-full border border-current px-3 py-1 text-[11px] font-extrabold">PDF</span>
                  <span className="text-[12px] font-semibold">File {index + 1}</span>
                </div>
              ) : (
                <img src={image} alt={`${title} ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
              )}
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

export function BookingTaskDetails({
  booking,
  action,
}: {
  booking: DashboardBooking;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <SurfaceCard
        title="Task Details"
        action={action}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#fff8fb] px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Booking ID</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{booking.id}</p>
            </div>
            <MiniStatus status={booking.status} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoRow label="Service" value={booking.service} icon={<FileText className="size-4" />} />
            <InfoRow label="Customer" value={booking.customer} icon={<User className="size-4" />} />
            <InfoRow label="Provider" value={booking.provider} icon={<User className="size-4" />} />
            <InfoRow label="Schedule" value={booking.schedule} icon={<CalendarDays className="size-4" />} />
            <InfoRow label="Booking Mode" value={booking.bookingMode ?? "-"} icon={<Clock3 className="size-4" />} />
            <InfoRow label="Duration" value={booking.durationHours ?? "-"} icon={<Clock3 className="size-4" />} />
            <InfoRow label="Hourly Rate" value={booking.hourlyRate ?? "RM0.00"} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Daily Rate" value={booking.dailyRate ?? "RM0.00"} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Fixed Amount" value={booking.fixedAmount ?? booking.amount} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Additional Amount" value={booking.additionalAmount ?? "RM0.00"} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Total Amount" value={booking.totalAmount ?? booking.amount} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Location" value={booking.location ?? "No location stored."} icon={<MapPin className="size-4" />} />
          </div>

          <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Description</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {booking.description || "No additional charge description provided."}
            </p>
          </div>

          <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Payment Breakdown</p>
            {booking.paymentBreakdown?.length ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white">
                {booking.paymentBreakdown.map((item, index) => (
                  <div
                    key={`${item.description}-${index}`}
                    className="flex items-center justify-between gap-4 border-b border-slate-50 px-4 py-3 last:border-b-0"
                  >
                    <span className="text-sm font-medium text-slate-700">{item.description}</span>
                    <span className="shrink-0 text-sm font-bold text-slate-950">{item.amount}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-[#fcf7ff] px-4 py-3">
                  <span className="text-sm font-bold text-[#8E5EB5]">Total Amount</span>
                  <span className="shrink-0 text-sm font-black text-[#8E5EB5]">{booking.totalAmount ?? booking.amount}</span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No payment breakdown stored.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Customer Note</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{booking.customerNote || "No customer note."}</p>
            </div>
            <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Provider Payment Note</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{booking.providerNote || "No provider note."}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-900">Full Task Path & Timings</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(booking.taskPath ?? []).map((step) => (
                <div key={step.key} className={`rounded-2xl border px-4 py-3 ${step.done ? "border-emerald-100 bg-white" : "border-slate-100 bg-white/60"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${step.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {step.done ? "Done" : "Waiting"}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-slate-500">{step.value}</p>
                </div>
              ))}
            </div>
          </div>

          <MediaGrid title="Completion Images" images={booking.completionImages} empty="No completion images attached." />
          <MediaGrid title="Customer Payment Proof" images={booking.paymentProofImages} empty="No customer payment proof attached." />
          <MediaGrid
            title="Provider Company Payment Proof"
            images={booking.companyPaymentProofUrl ? [booking.companyPaymentProofUrl] : []}
            empty="No provider company payment proof attached."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
              <div className="flex items-center gap-2">
                <Star className="size-4 text-amber-500" />
                <p className="text-sm font-semibold text-slate-900">Customer Review</p>
              </div>
              {booking.customerReview ? (
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-950">Rating:</span> {booking.customerReview.rating}</p>
                  <p><span className="font-semibold text-slate-950">Recommend:</span> {booking.customerReview.recommend}</p>
                  <p><span className="font-semibold text-slate-950">Tags:</span> {booking.customerReview.tags.join(", ") || "-"}</p>
                  <p className="leading-6">{booking.customerReview.comment}</p>
                  <p className="text-[12px] text-slate-400">{booking.customerReview.date}</p>
                  <MediaGrid title="Customer Review Photos" images={booking.customerReview.photos} empty="No review photos." />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No customer review submitted yet.</p>
              )}
            </div>
            <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
              <div className="flex items-center gap-2">
                <Star className="size-4 text-amber-500" />
                <p className="text-sm font-semibold text-slate-900">Provider Review About Customer</p>
              </div>
              {booking.providerReview ? (
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-950">Rating:</span> {booking.providerReview.rating}</p>
                  <p className="leading-6">{booking.providerReview.comment}</p>
                  <p className="text-[12px] text-slate-400">{booking.providerReview.date}</p>
                  <MediaGrid title="Provider Review Photos" images={booking.providerReview.photos} empty="No review photos." />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No provider review submitted yet.</p>
              )}
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

export function BookingDetailPage() {
  const { bookingId = "" } = useParams();
  const [booking, setBooking] = useState<DashboardBooking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadBooking() {
      setLoading(true);
      const detail = await getBookingDetailWithFallback(bookingId);

      if (!active) {
        return;
      }

      setBooking(detail);
      setLoading(false);
    }

    void loadBooking();

    return () => {
      active = false;
    };
  }, [bookingId]);

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <SurfaceCard title="Task Details">
        <p className="text-sm text-slate-500">Booking record was not found.</p>
      </SurfaceCard>
    );
  }

  return (
    <BookingTaskDetails
      booking={booking}
      action={<Link to="/tasks-bookings" className="text-sm font-semibold text-[#b4236b]">Back to tasks</Link>}
    />
  );
}
