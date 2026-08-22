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
  summaryCards: DashboardSummaryCard[];
  recentBookings: DashboardBooking[];
  recentPayments: PaymentRow[];
  recentReviews: ReviewRow[];
  recentComplaints: ComplaintRow[];
  userRows: UserRow[];
};

type DashboardSummaryItem = {
  label: string;
  value: string;
};

type DashboardSummaryCard = {
  title: string;
  accent: string;
  icon: (typeof dashboardMetrics)[number]["icon"];
  items: DashboardSummaryItem[];
};

type LiveBookingStatusRow = {
  booking_status?: string | null;
};

type LivePaymentSummaryRow = {
  amount?: number | null;
  company_commission_amount?: number | null;
  company_payment_status?: string | null;
};

type LiveIssueReportRow = {
  reporterUserId: string;
};

type LiveProfileRoleRow = {
  id: string;
  role?: string | null;
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

async function fetchBookingStatuses() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("booking_status")
    .limit(5000);

  if (error || !data) {
    return null;
  }

  return data as LiveBookingStatusRow[];
}

async function fetchPaymentSummaries() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("payments")
    .select("amount, company_commission_amount, company_payment_status")
    .limit(5000);

  if (error || !data) {
    return null;
  }

  return data as LivePaymentSummaryRow[];
}

async function fetchIssueReports() {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  try {
    const response = await fetch("https://app.myswiper.my/api/reports", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as { reports?: LiveIssueReportRow[] };
    return result.reports ?? null;
  } catch {
    return null;
  }
}

async function fetchProfileRoles(ids: string[]) {
  if (!supabase || ids.length === 0) {
    return new Map<string, string>();
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map(
    (data as LiveProfileRoleRow[]).map((row) => [row.id, row.role?.trim().toLowerCase() ?? ""])
  );
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

function formatCurrencyDetailed(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      metrics: dashboardMetrics,
      approvals: approvalItems,
      complaintsOpen: fallbackComplaintCount(),
      summaryCards: [],
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
    bookingStatuses,
    paymentSummaries,
    issueReports,
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
    fetchBookingStatuses(),
    fetchPaymentSummaries(),
    fetchIssueReports(),
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

  const normalizeStatus = (value?: string | null) => value?.trim().toLowerCase() ?? "";
  const totalTasksCount = bookingStatuses?.length ?? 0;
  const completedTasksCount =
    bookingStatuses?.filter((row) => normalizeStatus(row.booking_status) === "completed").length ?? 0;
  const ongoingTasksCount =
    bookingStatuses?.filter((row) =>
      ["accepted", "confirmed", "in_progress", "on_the_way", "arrived", "payment_requested"].includes(
        normalizeStatus(row.booking_status),
      ),
    ).length ?? 0;
  const pendingTasksCount =
    bookingStatuses?.filter((row) =>
      ["pending", "pending_provider_response", "awaiting_action"].includes(normalizeStatus(row.booking_status)),
    ).length ?? 0;
  const grossSales =
    paymentSummaries?.reduce((sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0), 0) ?? 0;
  const totalCommission =
    paymentSummaries?.reduce(
      (sum, row) => sum + (typeof row.company_commission_amount === "number" ? row.company_commission_amount : 0),
      0,
    ) ?? 0;
  const paidCommission =
    paymentSummaries?.reduce((sum, row) => {
      if (normalizeStatus(row.company_payment_status) !== "paid") {
        return sum;
      }

      return sum + (typeof row.company_commission_amount === "number" ? row.company_commission_amount : 0);
    }, 0) ?? 0;
  const payableCommission = Math.max(totalCommission - paidCommission, 0);
  const netSales = Math.max(grossSales - totalCommission, 0);
  const issueReporterRoles = await fetchProfileRoles((issueReports ?? []).map((report) => report.reporterUserId));
  const customerReportsCount =
    issueReports?.filter((report) => {
      const role = issueReporterRoles.get(report.reporterUserId) ?? "";
      return role === "customer" || role === "user";
    }).length ?? 0;
  const providerReportsCount =
    issueReports?.filter((report) => (issueReporterRoles.get(report.reporterUserId) ?? "") === "provider").length ?? 0;

  const summaryCards: DashboardSummaryCard[] = [
    {
      title: "Users",
      accent: "from-[#d946ef] to-[#ec4899]",
      icon: dashboardMetrics[0]!.icon,
      items: [
        { label: "Total users", value: formatCompactNumber(totalUsers ?? userRows.length) },
      ],
    },
    {
      title: "Service providers",
      accent: "from-[#f472b6] to-[#ec4899]",
      icon: dashboardMetrics[1]!.icon,
      items: [
        { label: "Total providers", value: formatCompactNumber(providerCount ?? 0) },
        { label: "Pending providers", value: formatCompactNumber(pendingApprovals ?? approvalRows.length) },
      ],
    },
    {
      title: "Task",
      accent: "from-[#fb7185] to-[#ec4899]",
      icon: dashboardMetrics[2]!.icon,
      items: [
        { label: "Total tasks", value: formatCompactNumber(totalTasksCount) },
        { label: "Completed", value: formatCompactNumber(completedTasksCount) },
        { label: "On going", value: formatCompactNumber(ongoingTasksCount) },
        { label: "Pending", value: formatCompactNumber(pendingTasksCount || activeTasks || 0) },
      ],
    },
    {
      title: "Cash Sales",
      accent: "from-[#f97316] to-[#ec4899]",
      icon: dashboardMetrics[3]!.icon,
      items: [
        { label: "Total Sales (Gross)", value: formatCurrencyDetailed(grossSales) },
        { label: "Commission", value: formatCurrencyDetailed(totalCommission) },
        { label: "Net Sales", value: formatCurrencyDetailed(netSales) },
      ],
    },
    {
      title: "Cash Commission",
      accent: "from-[#fb7185] to-[#e11d48]",
      icon: dashboardMetrics[4]!.icon,
      items: [
        { label: "Total Commission", value: formatCurrencyDetailed(totalCommission) },
        { label: "Paid Commission", value: formatCurrencyDetailed(paidCommission) },
        { label: "Payable Commission", value: formatCurrencyDetailed(payableCommission) },
      ],
    },
    {
      title: "Reports",
      accent: "from-[#c026d3] to-[#ec4899]",
      icon: dashboardMetrics[5]!.icon,
      items: [
        { label: "Customer reports", value: formatCompactNumber(customerReportsCount) },
        { label: "Provider reports", value: formatCompactNumber(providerReportsCount) },
      ],
    },
  ];

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
    summaryCards,
    recentBookings: recentBookings.slice(0, 5),
    recentPayments: recentPayments.slice(0, 5),
    recentReviews: recentReviews.slice(0, 4),
    recentComplaints: recentComplaints.slice(0, 5),
    userRows: userRows.slice(0, 200),
  };
}
