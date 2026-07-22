import { DataTable } from "../components/data-table";
import type { ReactNode } from "react";
import type { TableColumn } from "../types";

type ResourcePageProps<T extends Record<string, unknown>> = {
  title: string;
  description: string;
  rows: T[];
  columns: TableColumn<T>[];
  statusKey?: keyof T;
  hiddenStatusOptions?: string[];
  extraControls?: ReactNode;
  searchPlaceholder: string;
  stats: Array<{
    label: string;
    value: string;
    note: string;
  }>;
};

export function ResourcePage<T extends Record<string, unknown>>({
  title,
  description,
  rows,
  columns,
  statusKey,
  hiddenStatusOptions,
  extraControls,
  searchPlaceholder,
  stats,
}: ResourcePageProps<T>) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {stat.label}
            </p>
            <p className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-950">
              {stat.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{stat.note}</p>
          </article>
        ))}
      </section>

      <DataTable
        title={title}
        description={description}
        rows={rows}
        columns={columns}
        statusKey={statusKey}
        hiddenStatusOptions={hiddenStatusOptions}
        extraControls={extraControls}
        searchPlaceholder={searchPlaceholder}
      />
    </div>
  );
}
