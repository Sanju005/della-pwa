import { approvalItems, complaints, dashboardMetrics } from "../data/mock-data";
import { listApprovalQueueWithFallback } from "./admin-approvals";
import { listComplaintsWithFallback } from "./admin-complaints";
import type { ApprovalItem, ComplaintRow, DashboardBooking, PaymentRow, ReviewRow } from "../types";
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
  userSummary: {
    total: number;
    active: number;
    inactive: number;
    banned: number;
  };
  recentBookings: DashboardBooking[];
  recentPayments: PaymentRow[];
  recentReviews: ReviewRow[];
  recentComplaints: ComplaintRow[];
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

type LiveProfileStatusRow = {
  status?: string | null;
};

type RecentBookingRow = {
  id: string;
  booking_status?: string | null;
  service_label?: string | null;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  total_amount?: number | null;
  customer_id?: string | null;
  provider_id?: string | null;
  provider_profiles?: { marketing_name?: string | null }[] | { marketing_name?: string | null } | null;
  provider_services?: { service_type?: string | null }[] | { service_type?: string | null } | null;
};

type RecentPaymentRow = {
  id: string;
  amount?: number | null;
  status?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
};

type RecentReviewRow = {
  id: string;
  rating?: number | null;
  comment?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
};

type NameRow = {
  id: string;
  full_name?: string | null;
};

type ProviderNameRow = {
  id: string;
  marketing_name?: string | null;
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

function normalizeStatus(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(dateValue?: string | null, timeValue?: string | null) {
  if (!dateValue || !timeValue) {
    return "-";
  }

  const value = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(value.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function humanizeText(value?: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "";
  }

  return normalized
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function relationItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function fetchProfileNames(ids: string[]) {
  if (!supabase) {
    return new Map<string, string>();
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map((data as NameRow[]).map((row) => [row.id, row.full_name?.trim() || ""]));
}

async function fetchProviderNames(ids: string[]) {
  if (!supabase) {
    return new Map<string, string>();
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("provider_profiles")
    .select("id, marketing_name")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map((data as ProviderNameRow[]).map((row) => [row.id, row.marketing_name?.trim() || ""]));
}

async function fetchProfileStatuses() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("status")
    .limit(5000);

  if (error || !data) {
    return null;
  }

  return data as LiveProfileStatusRow[];
}

async function fetchRecentBookingsSummary() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_status,
      service_label,
      scheduled_date,
      scheduled_start_time,
      total_amount,
      customer_id,
      provider_id,
      provider_profiles (
        marketing_name
      ),
      provider_services (
        service_type
      )
    `)
    .order("scheduled_date", { ascending: false })
    .limit(5);

  if (error || !data) {
    return [];
  }

  const rows = data as RecentBookingRow[];
  const names = await fetchProfileNames(rows.flatMap((row) => [row.customer_id ?? "", row.provider_id ?? ""]));

  return rows.map((row) => {
    const providerProfile = relationItem(row.provider_profiles);
    const providerService = relationItem(row.provider_services);

    return {
      id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
      rawId: row.id,
      service: row.service_label?.trim() || humanizeText(providerService?.service_type) || "Service",
      provider: providerProfile?.marketing_name?.trim() || names.get(row.provider_id ?? "") || "Provider",
      providerId: row.provider_id ?? "",
      customer: names.get(row.customer_id ?? "") || "Customer",
      customerId: row.customer_id ?? "",
      status: humanizeText(row.booking_status) || "Pending",
      amount: formatCurrencyDetailed(Number(row.total_amount ?? 0)),
      schedule: `${formatDate(row.scheduled_date)} ${formatTime(row.scheduled_date, row.scheduled_start_time)}`,
    } satisfies DashboardBooking;
  });
}

async function fetchRecentPaymentsSummary() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, status, payment_method, created_at, customer_id, provider_id")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data) {
    return [];
  }

  const rows = data as RecentPaymentRow[];
  const names = await fetchProfileNames(rows.flatMap((row) => [row.customer_id ?? "", row.provider_id ?? ""]));

  return rows.map((row) => ({
    id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
    rawId: row.id,
    customer: names.get(row.customer_id ?? "") || "Customer",
    customerId: row.customer_id ?? "",
    provider: names.get(row.provider_id ?? "") || "Provider",
    providerId: row.provider_id ?? "",
    amount: formatCurrencyDetailed(Number(row.amount ?? 0)),
    method: row.payment_method?.trim() || "Cash",
    status: humanizeText(row.status) || "Pending",
    date: formatDate(row.created_at),
    createdAt: row.created_at ?? "",
  })) satisfies PaymentRow[];
}

async function fetchRecentReviewsSummary() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, customer_id, provider_id")
    .order("created_at", { ascending: false })
    .limit(4);

  if (error || !data) {
    return [];
  }

  const rows = data as RecentReviewRow[];
  const [customerNames, providerNames] = await Promise.all([
    fetchProfileNames(rows.map((row) => row.customer_id ?? "")),
    fetchProviderNames(rows.map((row) => row.provider_id ?? "")),
  ]);

  return rows.map((row) => ({
    id: row.id.startsWith("REV-") ? row.id : `REV-${row.id.slice(0, 8).toUpperCase()}`,
    customer: customerNames.get(row.customer_id ?? "") || "Customer",
    provider: providerNames.get(row.provider_id ?? "") || "Provider",
    rating: typeof row.rating === "number" ? row.rating.toFixed(1) : "0.0",
    comment: row.comment?.trim() || "Shared feedback",
    status: "Published",
    date: formatDate(row.created_at),
  })) satisfies ReviewRow[];
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      metrics: dashboardMetrics,
      approvals: approvalItems,
      complaintsOpen: fallbackComplaintCount(),
      summaryCards: [],
      userSummary: {
        total: 0,
        active: 0,
        inactive: 0,
        banned: 0,
      },
      recentBookings: [],
      recentPayments: [],
      recentReviews: [],
      recentComplaints: complaints,
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
    profileStatuses,
    approvalRows,
    recentBookings,
    recentPayments,
    recentReviews,
    recentComplaints,
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
    fetchProfileStatuses(),
    listApprovalQueueWithFallback(),
    fetchRecentBookingsSummary(),
    fetchRecentPaymentsSummary(),
    fetchRecentReviewsSummary(),
    listComplaintsWithFallback(),
  ]);

  const liveComplaintsOpen =
    recentComplaints.filter((item) => item.status.toLowerCase() === "open").length ||
    liveComplaintsOpenTable ||
    fallbackComplaintCount();

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
  const activeUsersCount =
    profileStatuses?.filter((row) => ["active", "verified"].includes(normalizeStatus(row.status))).length ?? 0;
  const inactiveUsersCount =
    profileStatuses?.filter((row) => normalizeStatus(row.status) === "inactive").length ?? 0;
  const bannedUsersCount =
    profileStatuses?.filter((row) =>
      ["banned", "suspended", "deleted"].includes(normalizeStatus(row.status)),
    ).length ?? 0;
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
        { label: "Total users", value: formatCompactNumber(totalUsers ?? 0) },
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
    userSummary: {
      total: totalUsers ?? 0,
      active: activeUsersCount,
      inactive: inactiveUsersCount,
      banned: bannedUsersCount,
    },
    recentBookings,
    recentPayments,
    recentReviews,
    recentComplaints: recentComplaints.slice(0, 5),
  };
}
