import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, LoaderCircle } from "lucide-react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminStatCard({
  title,
  value,
  delta,
  trend,
  icon,
  accent,
}: {
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  icon: ReactNode;
  accent: string;
}) {
  const positive = trend === "up";

  return (
    <article className="rounded-[28px] border border-[#f6d8e7] bg-white/92 p-5 shadow-[0_20px_60px_rgba(214,51,132,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className={cx("grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", accent)}>
          {icon}
        </div>
        <span
          className={cx(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            positive ? "bg-[#fff1f6] text-[#c0266b]" : "bg-[#fff1f2] text-[#e11d48]"
          )}
        >
          {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {delta}
        </span>
      </div>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">vs last month</p>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/75 px-5 py-10 text-center">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  title = "Loading dashboard",
  description = "Please wait while we fetch the latest admin data.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/85 px-5 py-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
      <LoaderCircle className="mx-auto size-8 animate-spin text-[#d63384]" />
      <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    </div>
  );
}
