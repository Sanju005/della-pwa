import { complaints as mockComplaints } from "../data/mock-data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { ComplaintRow } from "../types";

const APP_BASE_URL =
  (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim() ||
  "https://app.myswiper.my";

type IssueReportRecord = {
  id: string;
  createdAt: string;
  status: "new";
  bookingId: string;
  bookingTitle: string;
  providerName: string;
  schedule: string;
  location: string;
  paymentAmount: number;
  paymentMethod: string;
  reporterUserId: string;
  reporterEmail: string;
  reporterName: string;
  message: string;
};

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

function inferPriority(report: IssueReportRecord) {
  const text = `${report.bookingTitle} ${report.message}`.toLowerCase();

  if (
    ["damage", "unsafe", "fraud", "injury", "harassment", "stolen"].some((keyword) =>
      text.includes(keyword),
    )
  ) {
    return "Critical";
  }

  if (["late", "missing", "wrong charge", "overcharge", "not completed"].some((keyword) => text.includes(keyword))) {
    return "High";
  }

  return "Medium";
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

  const response = await fetch(`${APP_BASE_URL}/api/reports`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as {
    reports?: IssueReportRecord[];
  };

  return result.reports ?? null;
}

export async function listComplaintsWithFallback() {
  if (!isSupabaseConfigured || !supabase) {
    return mockComplaints;
  }

  try {
    const reports = await fetchIssueReports();

    if (!reports?.length) {
      return mockComplaints;
    }

    return reports.map((report, index) => ({
      id: report.id.startsWith("CMP-") ? report.id : `CMP-${report.id.slice(0, 8).toUpperCase()}`,
      ticket: report.bookingId.startsWith("#") ? report.bookingId : `#${report.bookingId}`,
      subject: report.bookingTitle || "Booking issue",
      customer: report.reporterName || report.reporterEmail || "Customer",
      owner: "Customer Care",
      status: report.status === "new" ? "Open" : "In Progress",
      priority: inferPriority(report),
      updated: formatDate(report.createdAt),
      sortOrder: index,
    })) satisfies Array<ComplaintRow & { sortOrder: number }>;
  } catch {
    return mockComplaints;
  }
}

export function buildComplaintStats(rows: ComplaintRow[]) {
  const openCount = rows.filter((row) => row.status.toLowerCase() === "open").length;
  const escalatedCount = rows.filter((row) => row.priority.toLowerCase() === "critical").length;
  const resolvedCount = rows.filter((row) => row.status.toLowerCase() === "resolved").length;

  return [
    {
      label: "Open",
      value: openCount.toLocaleString("en-MY"),
      note: "Cases needing immediate attention",
    },
    {
      label: "Escalated",
      value: escalatedCount.toLocaleString("en-MY"),
      note: "High-risk incidents",
    },
    {
      label: "Resolved",
      value: resolvedCount.toLocaleString("en-MY"),
      note: "Closed this cycle",
    },
  ];
}
