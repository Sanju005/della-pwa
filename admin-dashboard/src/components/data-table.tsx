import { Search } from "lucide-react";
import { startTransition, useDeferredValue, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { TableColumn } from "../types";
import { StatusBadge } from "./status-badge";

type DataTableProps<T extends Record<string, unknown>> = {
  columns: TableColumn<T>[];
  rows: T[];
  title: string;
  description: string;
  searchPlaceholder?: string;
  statusKey?: keyof T;
  hiddenStatusOptions?: string[];
  extraControls?: ReactNode;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  title,
  description,
  searchPlaceholder = "Search records...",
  statusKey,
  hiddenStatusOptions = [],
  extraControls,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("All");
  const deferredQuery = useDeferredValue(query);

  const statusOptions = useMemo(() => {
    if (!statusKey) {
      return ["All"];
    }

    const values = new Set<string>(["All"]);

    rows.forEach((row) => {
      const value = row[statusKey];
      if (typeof value === "string" && value.trim()) {
        values.add(value);
      }
    });

    const hidden = new Set(hiddenStatusOptions.map((option) => option.toLowerCase()));
    return [...values].filter((value) => value === "All" || !hidden.has(value.toLowerCase()));
  }, [hiddenStatusOptions, rows, statusKey]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesQuery =
        deferredQuery.trim().length === 0 ||
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(deferredQuery.trim().toLowerCase())
        );

      const matchesStatus =
        !statusKey ||
        activeStatus === "All" ||
        String(row[statusKey]).toLowerCase() === activeStatus.toLowerCase();

      return matchesQuery && matchesStatus;
    });
  }, [activeStatus, deferredQuery, rows, statusKey]);

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_rgba(16,24,40,0.08)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-col gap-3 lg:min-w-[360px]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => setQuery(nextValue));
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setActiveStatus(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeStatus === option
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          {extraControls ? <div className="flex flex-wrap gap-2">{extraControls}</div> : null}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-3 text-left">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 ${column.className ?? ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIndex) => (
              <tr key={String(row.id ?? rowIndex)} className="rounded-2xl bg-slate-50/80">
                {columns.map((column) => {
                  const rawValue = row[column.key as keyof T];
                  return (
                    <td
                      key={String(column.key)}
                      className={`px-4 py-4 text-sm text-slate-700 ${column.className ?? ""}`}
                    >
                      {column.render
                        ? column.render(row)
                        : typeof rawValue === "string" &&
                            column.key === statusKey
                          ? <StatusBadge status={rawValue} />
                          : String(rawValue ?? "-")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            No records match the current search and filter.
          </div>
        ) : null}
      </div>
    </section>
  );
}
