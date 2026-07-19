import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ResourcePage } from "./resource-page";
import { buildApprovalStats, listApprovalQueueWithFallback } from "../lib/admin-approvals";
import type { ProviderRow } from "../types";

export function ProviderApprovalsPage() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadApprovals() {
      setLoading(true);
      const nextRows = await listApprovalQueueWithFallback();

      if (!active) {
        return;
      }

      setRows(nextRows);
      setLoading(false);
    }

    void loadApprovals();

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

  return (
    <ResourcePage
      title="Provider Approvals"
      description="Pending provider and listing approval decisions."
      rows={rows}
      columns={[
        {
          key: "id",
          label: "ID",
          render: (row) => (
            <Link
              to={`/service-providers/${row.id}`}
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {String(row.id)}
            </Link>
          ),
        },
        { key: "provider", label: "Provider" },
        { key: "service", label: "Service" },
        { key: "status", label: "Status" },
        { key: "zone", label: "Zone" },
        { key: "verification", label: "Verification" },
      ]}
      statusKey="status"
      searchPlaceholder="Search pending approvals..."
      stats={buildApprovalStats(rows)}
    />
  );
}
