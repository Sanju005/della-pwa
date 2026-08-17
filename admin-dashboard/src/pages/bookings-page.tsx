import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResourcePage } from "./resource-page";
import { listBookingsWithFallback } from "../lib/admin-bookings";
import type { DashboardBooking } from "../types";

export function BookingsPage() {
  const [rows, setRows] = useState<DashboardBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadBookings() {
      setLoading(true);
      const nextRows = await listBookingsWithFallback();

      if (!active) {
        return;
      }

      setRows(nextRows);
      setLoading(false);
    }

    void loadBookings();

    return () => {
      active = false;
    };
  }, []);

  if (loading && rows.length === 0) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
      </div>
    );
  }

  const isCancelledLikeStatus = (status: string) => {
    const normalized = status.trim().toLowerCase();
    return normalized === "cancelled" || normalized === "canceled" || normalized.includes("declined");
  };

  const openCount = rows.filter((row) => {
    const normalized = row.status.trim().toLowerCase();
    return normalized !== "completed" && !isCancelledLikeStatus(row.status);
  }).length;
  const completedCount = rows.filter((row) => row.status === "Completed").length;
  const cancelledCount = rows.filter((row) => isCancelledLikeStatus(row.status)).length;

  return (
    <ResourcePage
      title="Tasks / Bookings"
      description="Real-time service operations and fulfilment pipeline."
      rows={rows}
      columns={[
        {
          key: "id",
          label: "ID",
          render: (row) => (
            <Link
              to={`/tasks-bookings/${row.rawId ?? row.id}`}
              className="font-semibold text-[#b4236b] hover:text-[#8f1d63]"
            >
              {row.id}
            </Link>
          ),
        },
        { key: "service", label: "Service" },
        { key: "provider", label: "Provider" },
        { key: "customer", label: "Customer" },
        { key: "status", label: "Status" },
        { key: "amount", label: "Amount" },
        { key: "schedule", label: "Date & Time" },
      ]}
      statusKey="status"
      searchPlaceholder="Search bookings, customers, or providers..."
      stats={[
        { label: "Open tasks", value: String(openCount), note: "Pending, accepted, and in progress" },
        { label: "Completed today", value: String(completedCount), note: "Freshly settled jobs" },
        { label: "Cancelled / Declined", value: String(cancelledCount), note: "Provider and user cancellations" },
      ]}
    />
  );
}
