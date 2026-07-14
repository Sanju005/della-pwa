import { CalendarDays, CircleDollarSign, FileText, Image as ImageIcon, MapPin, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SurfaceCard, InfoRow, MiniStatus } from "../components/user-detail-ui";
import { getBookingDetailWithFallback } from "../lib/admin-bookings";
import type { DashboardBooking } from "../types";

function isPdfAsset(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  return normalized.startsWith("data:application/pdf") || normalized.includes(".pdf");
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
    <div className="space-y-4">
      <SurfaceCard
        title="Task Details"
        action={<Link to="/tasks-bookings" className="text-sm font-semibold text-[#b4236b]">Back to tasks</Link>}
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
            <InfoRow label="Fixed Amount" value={booking.fixedAmount ?? booking.amount} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Additional Amount" value={booking.additionalAmount ?? "RM0.00"} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Total Amount" value={booking.totalAmount ?? booking.amount} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Location" value="View customer/provider pages for full address" icon={<MapPin className="size-4" />} />
          </div>

          <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Description</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {booking.description || "No additional description provided."}
            </p>
          </div>

          <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-900">Completion Images</p>
            </div>
            {booking.completionImages?.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {booking.completionImages.map((image, index) => (
                  <a
                    key={`${booking.id}-completion-${index}`}
                    href={image}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    {isPdfAsset(image) ? (
                      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 px-3 text-center text-violet-700">
                        <span className="rounded-full border border-current px-3 py-1 text-[11px] font-extrabold">PDF</span>
                        <span className="text-[12px] font-semibold">Completion file {index + 1}</span>
                      </div>
                    ) : (
                      <img src={image} alt={`Completion ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No completion images attached.</p>
            )}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
