import { providers as mockProviders } from "../data/mock-data";
import { listProvidersWithFallback } from "./admin-providers";
import type { ProviderRow } from "../types";

function needsApproval(row: ProviderRow) {
  const status = row.status.trim().toLowerCase();
  const verification = row.verification.trim().toLowerCase();

  if (status === "pending") {
    return true;
  }

  return !["approved", "verified", "complete"].some((value) => verification.includes(value));
}

export async function listApprovalQueueWithFallback() {
  const liveRows = await listProvidersWithFallback();
  const filtered = liveRows.filter(needsApproval);

  if (filtered.length > 0) {
    return filtered;
  }

  return mockProviders.filter(needsApproval);
}

export function buildApprovalStats(rows: ProviderRow[]) {
  const pendingProfiles = rows.filter((row) => row.status.trim().toLowerCase() === "pending").length;
  const documentReview = rows.filter((row) =>
    ["document review", "processing", "pending"].some((value) =>
      row.verification.trim().toLowerCase().includes(value),
    ),
  ).length;
  const listingReview = rows.filter((row) =>
    !["approved", "verified", "complete"].some((value) =>
      row.verification.trim().toLowerCase().includes(value),
    ),
  ).length;

  return [
    {
      label: "Profiles",
      value: String(pendingProfiles || rows.length),
      note: "Profiles waiting for initial ops review",
    },
    {
      label: "Documents",
      value: String(documentReview),
      note: "KYC and compliance checks",
    },
    {
      label: "Listings",
      value: String(listingReview),
      note: "Marketplace visibility approvals",
    },
  ];
}
