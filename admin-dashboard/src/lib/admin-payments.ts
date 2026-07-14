import { payments as mockPayments } from "../data/mock-data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { PaymentRow } from "../types";

type LivePaymentRecord = {
  id: string;
  amount?: number | null;
  status?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
  company_payment_status?: string | null;
  company_payment_submission_id?: string | null;
  provider_company_payment_proof_data_url?: string | null;
  provider_company_payment_proof_file_name?: string | null;
};

type ProfileNameRow = {
  id: string;
  full_name?: string | null;
};

type CompanyPaymentSubmissionRow = {
  id: string;
  proof_data_url?: string | null;
  proof_file_name?: string | null;
};

function formatCurrency(value: number) {
  return `RM${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function formatStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "Pending";
  }

  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function resolvePaymentProofUrl(value?: string | null) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || isDataUrl(trimmed) || isHttpUrl(trimmed) || !supabase) {
    return trimmed;
  }

  const signed = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(trimmed, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return "";
  }

  return signed.data.signedUrl;
}

async function fetchProfileNames(ids: string[]) {
  if (!supabase || ids.length === 0) {
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

  return new Map(
    (data as ProfileNameRow[]).map((row) => [row.id, row.full_name?.trim() || ""]),
  );
}

async function fetchSubmissionProofs(ids: string[]) {
  if (!supabase || ids.length === 0) {
    return new Map<string, CompanyPaymentSubmissionRow>();
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, CompanyPaymentSubmissionRow>();
  }

  const { data, error } = await supabase
    .from("provider_company_payment_submissions")
    .select("id, proof_data_url, proof_file_name")
    .in("id", uniqueIds);

  if (error || !data) {
    return new Map<string, CompanyPaymentSubmissionRow>();
  }

  return new Map(
    (data as CompanyPaymentSubmissionRow[]).map((row) => [row.id, row]),
  );
}

export async function listPaymentsWithFallback() {
  if (!isSupabaseConfigured || !supabase) {
    return mockPayments;
  }

  const { data, error } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      status,
      payment_method,
      created_at,
      customer_id,
      provider_id,
      company_payment_status,
      company_payment_submission_id,
      provider_company_payment_proof_data_url,
      provider_company_payment_proof_file_name
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) {
    return mockPayments;
  }

  const paymentRows = data as LivePaymentRecord[];
  const names = await fetchProfileNames([
    ...paymentRows.map((row) => row.customer_id ?? ""),
    ...paymentRows.map((row) => row.provider_id ?? ""),
  ]);
  const submissionProofs = await fetchSubmissionProofs(
    paymentRows.map((row) => row.company_payment_submission_id ?? ""),
  );

  return Promise.all(
    paymentRows.map(async (row) => {
      const submission = submissionProofs.get(row.company_payment_submission_id ?? "");
      const companySlipName =
        row.provider_company_payment_proof_file_name?.trim() ||
        submission?.proof_file_name?.trim() ||
        "";
      const companySlipSource =
        row.provider_company_payment_proof_data_url?.trim() ||
        submission?.proof_data_url?.trim() ||
        "";

      return {
        id: row.id.startsWith("#") ? row.id : `#${row.id.slice(0, 8).toUpperCase()}`,
        rawId: row.id,
        customer: names.get(row.customer_id ?? "") || "Customer",
        customerId: row.customer_id ?? "",
        provider: names.get(row.provider_id ?? "") || "Provider",
        providerId: row.provider_id ?? "",
        amount: formatCurrency(Number(row.amount ?? 0)),
        method: row.payment_method?.trim() || "Cash",
        status: formatStatus(row.status),
        date: formatDate(row.created_at),
        createdAt: row.created_at ?? "",
        settlementStatus: formatStatus(row.company_payment_status),
        companySlipName,
        companySlipUrl: await resolvePaymentProofUrl(companySlipSource),
      };
    }),
  );
}

export async function getPaymentDetailWithFallback(paymentId: string) {
  const all = await listPaymentsWithFallback();
  return all.find((row) => row.rawId === paymentId || row.id === paymentId) ?? null;
}

export function buildPaymentStats(rows: PaymentRow[]) {
  const parseAmount = (value: string) =>
    Number(value.replace(/[^0-9.-]+/g, "")) || 0;

  const totalVolume = rows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
  const pendingVolume = rows
    .filter((row) => row.status.toLowerCase() === "pending")
    .reduce((sum, row) => sum + parseAmount(row.amount), 0);
  const refundedVolume = rows
    .filter((row) => row.status.toLowerCase() === "refunded")
    .reduce((sum, row) => sum + parseAmount(row.amount), 0);

  return [
    {
      label: "Total volume",
      value: formatCurrency(totalVolume),
      note: "Live payment collections",
    },
    {
      label: "Pending",
      value: formatCurrency(pendingVolume),
      note: "Awaiting settlement or capture",
    },
    {
      label: "Refunds",
      value: formatCurrency(refundedVolume),
      note: "Requires finance review where needed",
    },
  ];
}
