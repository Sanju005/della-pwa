import { useEffect, useState } from "react";
import { ResourcePage } from "./resource-page";
import { buildComplaintStats, listComplaintsWithFallback } from "../lib/admin-complaints";
import type { ComplaintRow } from "../types";

export function ComplaintsPage() {
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadComplaints() {
      setLoading(true);
      const nextRows = await listComplaintsWithFallback();

      if (!active) {
        return;
      }

      setRows(nextRows);
      setLoading(false);
    }

    void loadComplaints();

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
      title="Complaints"
      description="Trust, support, and service recovery queue."
      rows={rows}
      columns={[
        { key: "ticket", label: "Ticket" },
        { key: "subject", label: "Subject" },
        { key: "customer", label: "Customer" },
        { key: "owner", label: "Owner" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
        { key: "updated", label: "Updated" },
      ]}
      statusKey="status"
      searchPlaceholder="Search complaints, owners, or ticket IDs..."
      stats={buildComplaintStats(rows)}
    />
  );
}
