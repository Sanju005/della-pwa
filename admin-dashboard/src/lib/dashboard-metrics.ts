import { approvalItems, complaints, dashboardMetrics } from "../data/mock-data";
import { listApprovalQueueWithFallback } from "./admin-approvals";
import { listBookingsWithFallback } from "./admin-bookings";
import { listComplaintsWithFallback } from "./admin-complaints";
import { listPaymentsWithFallback } from "./admin-payments";
import { listReviewsWithFallback } from "./admin-reviews";
import { listUsersWithFallback } from "./admin-users";
import type { ApprovalItem, ComplaintRow, DashboardBooking, PaymentRow, ReviewRow, UserRow } from "../types";
import { isSupabaseConfigured, supabase } from "./supabase";

type LiveMetricCard = {
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  accent: string;
  icon: (typeof dashboardMetrics)[number]["icon"];
};

type LiveApprovalItem = {
  title: string;
  pending: number;
  accent: string;
  note: string;
};

type DashboardSnapshot = {
  metrics: LiveMetricCard[];
  approvals: LiveApprovalItem[];
  complaintsOpen: number;
  recentBookings: DashboardBooking[];
  recentPayments: PaymentRow[];
  recentReviews: ReviewRow[];
  recentComplaints: ComplaintRow[];
  userRows: UserRow[];
};

async function countRows(table: string, filters?: Array<[string, string | boolean]>) {
  if (!supabase) {
    return null;
  }

  let query = supabase.from(table).select("*", { count: "exact", head: true });

  for (const [column, value] of filters ?? []) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;

  if (error) {
    return null;
  }

  return count ?? 0;
}

async function sumPaymentAmounts() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .limit(5000);

  if (error || !data) {
    return null;
  }

  return data.reduce((sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0), 0);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-MY", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function fallbackComplaintCount() {
  return complaints.filter((item) => item.status.toLowerCase() === "open").length;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      metrics: dashboardMetrics,
      approvals: approvalItems,
      complaintsOpen: fallbackComplaintCount(),
      recentBookings: [],
      recentPayments: [],
      recentReviews: [],
      recentComplaints: complaints,
      userRows: [],
    };
  }

  const [
    totalUsers,
    providerCount,
    activeTasks,
    paymentTotal,
    pendingApprovals,
    liveComplaintsOpenTable,
    approvalRows,
    recentBookings,
    recentPayments,
    recentReviews,
    recentComplaints,
    userRows,
  ] = await Promise.all([
    countRows("profiles"),
    countRows("profiles", [["role", "provider"]]),
    countRows("bookings", [["booking_status", "pending"]]),
    sumPaymentAmounts(),
    countRows("provider_profiles", [["approval_status", "pending"]]),
    countRows("complaints", [["status", "open"]]),
    listApprovalQueueWithFallback(),
    listBookingsWithFallback(),
    listPaymentsWithFallback(),
    listReviewsWithFallback(),
    listComplaintsWithFallback(),
    listUsersWithFallback(),
  ]);

  const liveComplaintsOpen =
    recentComplaints.filter((item) => item.status.toLowerCase() === "open").length ||
    liveComplaintsOpenTable ||
    fallbackComplaintCount();

  const metrics: LiveMetricCard[] = dashboardMetrics.map((metric) => {
    switch (metric.title) {
      case "Total Users":
        return {
          ...metric,
          value: formatCompactNumber(totalUsers ?? (Number(metric.value.replace(/[^\d]/g, "")) || 0)),
        };
      case "Service Providers":
        return {
          ...metric,
          value: formatCompactNumber(providerCount ?? (Number(metric.value.replace(/[^\d]/g, "")) || 0)),
        };
      case "Active Tasks":
        return {
          ...metric,
          value: formatCompactNumber(activeTasks ?? (Number(metric.value.replace(/[^\d]/g, "")) || 0)),
        };
      case "Total Payments":
        return {
          ...metric,
          value: paymentTotal == null ? metric.value : formatCurrency(paymentTotal),
        };
      case "Pending Approvals":
        return {
          ...metric,
          value: formatCompactNumber(pendingApprovals ?? (Number(metric.value.replace(/[^\d]/g, "")) || 0)),
        };
      case "Open Complaints":
        return {
          ...metric,
          value: formatCompactNumber(
            liveComplaintsOpen ?? fallbackComplaintCount() ?? (Number(metric.value.replace(/[^\d]/g, "")) || 0)
          ),
        };
      default:
        return metric;
    }
  });

  const liveApprovalRows = approvalRows.length ? approvalRows : [];
  const documentApprovals = liveApprovalRows.filter((row) =>
    ["document review", "processing", "pending"].some((value) =>
      row.verification.toLowerCase().includes(value),
    ),
  ).length;
  const listingApprovals = liveApprovalRows.filter((row) =>
    !["approved", "verified", "complete"].some((value) =>
      row.verification.toLowerCase().includes(value),
    ),
  ).length;
  const approvals: LiveApprovalItem[] = approvalItems.map((item) => {
    let pending = item.pending;

    if (item.title === "Service Providers") {
      pending = liveApprovalRows.length || pendingApprovals || item.pending;
    } else if (item.title === "Documents") {
      pending = documentApprovals || item.pending;
    } else if (item.title === "Listings") {
      pending = listingApprovals || item.pending;
    }

    return { ...item, pending };
  });

  return {
    metrics,
    approvals,
    complaintsOpen: liveComplaintsOpen ?? fallbackComplaintCount(),
    recentBookings: recentBookings.slice(0, 5),
    recentPayments: recentPayments.slice(0, 5),
    recentReviews: recentReviews.slice(0, 4),
    recentComplaints: recentComplaints.slice(0, 5),
    userRows: userRows.slice(0, 200),
  };
}
