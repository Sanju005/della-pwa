import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceKey, getSupabaseUrl } from "./supabase-env";

export type IssueReportRecord = {
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

type IssueReportInsertPayload = Omit<IssueReportRecord, "id" | "createdAt" | "status">;

type IssueReportRow = {
  id: string;
  created_at: string;
  status: "new";
  booking_id: string;
  booking_title: string;
  provider_name: string;
  schedule: string;
  location: string;
  payment_amount: number | string | null;
  payment_method: string;
  reporter_user_id: string;
  reporter_email: string;
  reporter_name: string;
  message: string;
};

function getAdminClient() {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isMissingIssueReportsSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("issue_reports") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("relation"))
  );
}

function mapIssueReportRow(row: IssueReportRow): IssueReportRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    bookingId: row.booking_id,
    bookingTitle: row.booking_title,
    providerName: row.provider_name,
    schedule: row.schedule,
    location: row.location,
    paymentAmount: Number(row.payment_amount ?? 0),
    paymentMethod: row.payment_method,
    reporterUserId: row.reporter_user_id,
    reporterEmail: row.reporter_email,
    reporterName: row.reporter_name,
    message: row.message,
  };
}

async function ensureReportsFile() {
  const path = await import("node:path");
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const reportsFile = path.join(process.cwd(), "data", "issue-reports.json");
  const dataDir = path.dirname(reportsFile);

  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(reportsFile, "utf8");
  } catch {
    await writeFile(reportsFile, "[]", "utf8");
  }
}

async function readReportsFallback() {
  const path = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const reportsFile = path.join(process.cwd(), "data", "issue-reports.json");

  await ensureReportsFile();
  const raw = await readFile(reportsFile, "utf8");
  return JSON.parse(raw) as IssueReportRecord[];
}

async function writeReportsFallback(records: IssueReportRecord[]) {
  const path = await import("node:path");
  const { writeFile } = await import("node:fs/promises");
  const reportsFile = path.join(process.cwd(), "data", "issue-reports.json");

  await ensureReportsFile();
  await writeFile(reportsFile, JSON.stringify(records, null, 2), "utf8");
}

async function createIssueReportFallback(payload: IssueReportInsertPayload) {
  const records = await readReportsFallback();
  const nextRecord: IssueReportRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    ...payload,
  };

  records.unshift(nextRecord);
  await writeReportsFallback(records);
  return nextRecord;
}

export async function createIssueReport(payload: IssueReportInsertPayload) {
  const adminClient = getAdminClient();

  if (!adminClient) {
    return createIssueReportFallback(payload);
  }

  const { data, error } = await adminClient
    .from("issue_reports")
    .insert({
      booking_id: payload.bookingId,
      booking_title: payload.bookingTitle,
      provider_name: payload.providerName,
      schedule: payload.schedule,
      location: payload.location,
      payment_amount: payload.paymentAmount,
      payment_method: payload.paymentMethod,
      reporter_user_id: payload.reporterUserId,
      reporter_email: payload.reporterEmail,
      reporter_name: payload.reporterName,
      message: payload.message,
    })
    .select(`
      id,
      created_at,
      status,
      booking_id,
      booking_title,
      provider_name,
      schedule,
      location,
      payment_amount,
      payment_method,
      reporter_user_id,
      reporter_email,
      reporter_name,
      message
    `)
    .single();

  if (error) {
    if (isMissingIssueReportsSchemaError(error.message)) {
      return createIssueReportFallback(payload);
    }

    throw new Error(error.message || "Unable to create issue report.");
  }

  return mapIssueReportRow(data as IssueReportRow);
}

export async function listIssueReports() {
  const adminClient = getAdminClient();

  if (!adminClient) {
    return readReportsFallback();
  }

  const { data, error } = await adminClient
    .from("issue_reports")
    .select(`
      id,
      created_at,
      status,
      booking_id,
      booking_title,
      provider_name,
      schedule,
      location,
      payment_amount,
      payment_method,
      reporter_user_id,
      reporter_email,
      reporter_name,
      message
    `)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingIssueReportsSchemaError(error.message)) {
      return readReportsFallback();
    }

    throw new Error(error.message || "Unable to load issue reports.");
  }

  return ((data ?? []) as IssueReportRow[]).map(mapIssueReportRow);
}
