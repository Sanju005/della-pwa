import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { StatusBadge, statusToTone } from "./status-badge";

export function SurfaceCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-[#E7ECE7] bg-white px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:px-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[1.1rem] font-bold text-slate-950">{title}</h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  note,
  accent,
  action,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  accent: string;
  action?: string;
}) {
  return (
    <article className="rounded-[24px] border border-[#E7ECE7] bg-white px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid size-11 place-items-center rounded-full ${accent}`}>{icon}</div>
        {action ? (
          <span className="text-[12px] font-semibold text-emerald-700">{action}</span>
        ) : null}
      </div>
      <p className="mt-4 text-[13px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-display text-[1.8rem] font-extrabold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-[12px] text-slate-500">{note}</p>
    </article>
  );
}

export function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[24px_minmax(120px,160px)_1fr] items-start gap-3 text-sm">
      <div className="pt-0.5 text-slate-400">{icon}</div>
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function TimelineItem({
  title,
  note,
  time,
  tone,
  icon,
}: {
  title: string;
  note: string;
  time: string;
  tone: string;
  icon: ReactNode;
}) {
  const ringClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50 text-sky-600"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-600"
          : tone === "violet"
            ? "border-violet-200 bg-violet-50 text-violet-600"
            : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className="grid grid-cols-[46px_1fr_auto] gap-3">
      <div className="relative flex justify-center">
        <div className={`grid size-9 place-items-center rounded-full border ${ringClass}`}>{icon}</div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-[13px] text-slate-500">{note}</p>
      </div>
      <p className="text-[12px] text-slate-400">{time}</p>
    </div>
  );
}

export function PillBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "emerald" | "blue" | "slate" | "amber" | "rose";
}) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function TableShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#E7ECE7] bg-white px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[1.1rem] font-bold text-slate-950">{title}</h3>
        {action}
      </div>
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

export function MiniStatus({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

export function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-amber-400">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`size-3.5 ${index < rating ? "fill-current" : "text-slate-200"}`}
        />
      ))}
    </div>
  );
}

export function VerificationDot({ status }: { status: string }) {
  const tone = statusToTone(status);
  const bg =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "rose"
          ? "bg-rose-500"
          : "bg-slate-400";

  return <span className={`inline-block size-2 rounded-full ${bg}`} />;
}
