import "server-only";

import { createClient } from "@supabase/supabase-js";

import type {
  ProviderRegistrationData,
  ProviderRegistrationRecord,
} from "./provider-registration-types";
import { getSupabaseServiceKey, getSupabaseUrl } from "./supabase-env";

const expectedOtp = "123456";

declare global {
  // eslint-disable-next-line no-var
  var __dellaProviderRegistrations:
    | ProviderRegistrationRecord[]
    | undefined;
}

function isWorkerdRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

type ProviderRegistrationSubmissionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "pending_admin_approval";
  phone_verified: boolean;
  email_verified: boolean;
  identity_verified: boolean;
  data: ProviderRegistrationData;
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

function isMissingRegistrationsSchemaError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("provider_registration_submissions") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("relation"))
  );
}

function mapRowToRecord(row: ProviderRegistrationSubmissionRow): ProviderRegistrationRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    phoneVerified: row.phone_verified,
    emailVerified: row.email_verified,
    identityVerified: row.identity_verified,
    data: row.data,
  };
}

async function ensureNodeDataFile() {
  const path = await import("node:path");
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const registrationsFile = path.join(
    process.cwd(),
    "data",
    "provider-registrations.json",
  );
  const dataDir = path.dirname(registrationsFile);

  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(registrationsFile, "utf8");
  } catch {
    await writeFile(registrationsFile, "[]", "utf8");
  }
}

async function readNodeRegistrations() {
  const path = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const registrationsFile = path.join(
    process.cwd(),
    "data",
    "provider-registrations.json",
  );
  await ensureNodeDataFile();
  const raw = await readFile(registrationsFile, "utf8");
  return JSON.parse(raw) as ProviderRegistrationRecord[];
}

async function writeNodeRegistrations(records: ProviderRegistrationRecord[]) {
  const path = await import("node:path");
  const { writeFile } = await import("node:fs/promises");
  const registrationsFile = path.join(
    process.cwd(),
    "data",
    "provider-registrations.json",
  );
  await ensureNodeDataFile();
  await writeFile(registrationsFile, JSON.stringify(records, null, 2), "utf8");
}

function readWorkerRegistrations() {
  return globalThis.__dellaProviderRegistrations ?? [];
}

function writeWorkerRegistrations(records: ProviderRegistrationRecord[]) {
  globalThis.__dellaProviderRegistrations = records;
}

async function readRegistrations() {
  const adminClient = getAdminClient();

  if (adminClient) {
    const { data, error } = await adminClient
      .from("provider_registration_submissions")
      .select("id, created_at, updated_at, status, phone_verified, email_verified, identity_verified, data")
      .order("created_at", { ascending: false });

    if (!error && data) {
      return (data as ProviderRegistrationSubmissionRow[]).map(mapRowToRecord);
    }

    if (error && !isMissingRegistrationsSchemaError(error.message)) {
      throw new Error(error.message || "Unable to load provider registrations.");
    }
  }

  if (isWorkerdRuntime()) {
    return readWorkerRegistrations();
  }

  return readNodeRegistrations();
}

async function writeRegistrations(records: ProviderRegistrationRecord[]) {
  const adminClient = getAdminClient();

  if (adminClient) {
    const payload = records.map((record) => ({
      id: record.id,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      status: record.status,
      phone_verified: record.phoneVerified,
      email_verified: record.emailVerified,
      identity_verified: record.identityVerified,
      data: record.data,
    }));

    const { error } = await adminClient
      .from("provider_registration_submissions")
      .upsert(payload, { onConflict: "id" });

    if (!error) {
      return;
    }

    if (!isMissingRegistrationsSchemaError(error.message)) {
      throw new Error(error.message || "Unable to save provider registrations.");
    }
  }

  if (isWorkerdRuntime()) {
    writeWorkerRegistrations(records);
    return;
  }

  await writeNodeRegistrations(records);
}

export async function createProviderRegistration(
  data: ProviderRegistrationData,
  idOverride?: string,
  verificationOverrides?: {
    phoneVerified?: boolean;
    emailVerified?: boolean;
    identityVerified?: boolean;
  },
) {
  const records = await readRegistrations();
  const now = new Date().toISOString();
  const phoneOtp = data.verification.phoneOtp.join("");
  const emailOtp = data.verification.emailOtp.join("");

  const record: ProviderRegistrationRecord = {
    id: idOverride ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "pending_admin_approval",
    phoneVerified: verificationOverrides?.phoneVerified ?? phoneOtp === expectedOtp,
    emailVerified: verificationOverrides?.emailVerified ?? emailOtp === expectedOtp,
    identityVerified:
      verificationOverrides?.identityVerified ??
      Boolean(
        data.verification.documentType &&
          data.verification.frontImageName &&
          data.verification.backImageName,
      ),
    data,
  };

  records.unshift(record);
  await writeRegistrations(records);
  return record;
}

export async function getProviderRegistration(id: string) {
  const adminClient = getAdminClient();

  if (adminClient) {
    const { data, error } = await adminClient
      .from("provider_registration_submissions")
      .select("id, created_at, updated_at, status, phone_verified, email_verified, identity_verified, data")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return mapRowToRecord(data as ProviderRegistrationSubmissionRow);
    }

    if (error && !isMissingRegistrationsSchemaError(error.message)) {
      throw new Error(error.message || "Unable to load provider registration.");
    }
  }

  const records = await readRegistrations();
  return records.find((record) => record.id === id) ?? null;
}

export async function listProviderRegistrations() {
  return readRegistrations();
}
