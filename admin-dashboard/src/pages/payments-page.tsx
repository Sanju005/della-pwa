import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResourcePage } from "./resource-page";
import { buildPaymentStats, listPaymentsWithFallback } from "../lib/admin-payments";
import type { PaymentRow } from "../types";

export function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadPayments() {
      setLoading(true);
      const nextRows = await listPaymentsWithFallback();

      if (!active) {
        return;
      }

      setRows(nextRows);
      setLoading(false);
    }

    void loadPayments();

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
      title="Payments"
      description="Customer collections, settlement state, and refund monitoring."
      rows={rows}
      columns={[
        {
          key: "id",
          label: "ID",
          render: (row) => (
            <Link
              to={`/payments/${row.rawId ?? row.id}`}
              className="font-semibold text-[#b4236b] hover:text-[#8f1d63]"
            >
              {row.id}
            </Link>
          ),
        },
        { key: "customer", label: "Customer" },
        { key: "provider", label: "Provider" },
        { key: "amount", label: "Amount" },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
        { key: "settlementStatus", label: "Settlement" },
        {
          key: "companySlipName",
          label: "Company Slip",
          render: (row) =>
            row.companySlipUrl ? (
              <a
                href={row.companySlipUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-violet-700 underline decoration-violet-200 underline-offset-2"
              >
                {row.companySlipName || "View slip"}
              </a>
            ) : (
              row.companySlipName || "No slip"
            ),
        },
        { key: "date", label: "Date" },
      ]}
      statusKey="status"
      searchPlaceholder="Search payments, customers, or methods..."
      stats={buildPaymentStats(rows)}
    />
  );
}
