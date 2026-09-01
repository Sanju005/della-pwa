import { CircleDollarSign, CreditCard, FileText, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SurfaceCard, InfoRow, MiniStatus } from "../components/user-detail-ui";
import { getPaymentDetailWithFallback, rejectCompanyPayment } from "../lib/admin-payments";
import type { PaymentRow } from "../types";

export function PaymentDetailPage() {
  const { paymentId = "" } = useParams();
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPayment() {
      setLoading(true);
      const detail = await getPaymentDetailWithFallback(paymentId);

      if (!active) {
        return;
      }

      setPayment(detail);
      setLoading(false);
    }

    void loadPayment();

    return () => {
      active = false;
    };
  }, [paymentId]);

  async function handleRejectPayment() {
    if (!payment?.rawId || saving) {
      return;
    }

    const reason = window.prompt("Enter a reason for rejecting this company payment (e.g. not credited to account):");
    if (!reason || !reason.trim()) {
      setMessage("A rejection reason is required.");
      return;
    }

    setSaving(true);
    const result = await rejectCompanyPayment(payment.rawId, reason.trim());
    setSaving(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setPayment((current) =>
      current ? { ...current, settlementStatus: "Rejected", settlementStatusRaw: "rejected" } : current,
    );
    setMessage("Company payment rejected.");
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
      </div>
    );
  }

  if (!payment) {
    return (
      <SurfaceCard title="Payment Details">
        <p className="text-sm text-slate-500">Payment record was not found.</p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      <SurfaceCard
        title="Payment Details"
        action={<Link to="/payments" className="text-sm font-semibold text-[#b4236b]">Back to payments</Link>}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#fff8fb] px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Payment ID</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{payment.id}</p>
            </div>
            <MiniStatus status={payment.status} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoRow label="Customer" value={payment.customer} icon={<User className="size-4" />} />
            <InfoRow label="Provider" value={payment.provider} icon={<User className="size-4" />} />
            <InfoRow label="Amount" value={payment.amount} icon={<CircleDollarSign className="size-4" />} />
            <InfoRow label="Method" value={payment.method} icon={<CreditCard className="size-4" />} />
            <InfoRow label="Payment Status" value={payment.status} icon={<FileText className="size-4" />} />
            <InfoRow label="Settlement Status" value={payment.settlementStatus || "Pending"} icon={<FileText className="size-4" />} />
            <InfoRow label="Date" value={payment.date} icon={<FileText className="size-4" />} />
          </div>

          <div className="rounded-2xl bg-[#fff8fb] px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Company Slip</p>
            {payment.companySlipUrl ? (
              <a
                href={payment.companySlipUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex font-semibold text-violet-700 underline decoration-violet-200 underline-offset-2"
              >
                {payment.companySlipName || "View uploaded slip"}
              </a>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No company slip attached.</p>
            )}
          </div>

          {payment.settlementStatusRaw !== "paid" && payment.settlementStatusRaw !== "rejected" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleRejectPayment()}
                disabled={saving || !payment.rawId}
                className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              >
                Reject Company Payment
              </button>
            </div>
          ) : null}

          {message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
