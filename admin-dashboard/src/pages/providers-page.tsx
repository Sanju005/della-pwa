import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ResourcePage } from "./resource-page";
import { buildProviderStats, listProvidersWithFallback } from "../lib/admin-providers";
import type { ProviderRow } from "../types";

export function ProvidersPage() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All Categories");
  const [sortMode, setSortMode] = useState("latest-registration");

  useEffect(() => {
    let active = true;

    async function loadProviders() {
      setLoading(true);
      const nextRows = await listProvidersWithFallback();

      if (!active) {
        return;
      }

      setRows(nextRows);
      setLoading(false);
    }

    void loadProviders();

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

  const categoryOptions = useMemo(() => {
    return [
      "All Categories",
      ...Array.from(new Set(rows.map((row) => row.service).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    ];
  }, [rows]);

  useEffect(() => {
    if (!categoryOptions.includes(category)) {
      setCategory("All Categories");
    }
  }, [category, categoryOptions]);

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      category === "All Categories" || row.service.toLowerCase() === category.toLowerCase(),
    );

    return [...filtered].sort((left, right) => {
      if (sortMode === "latest-task") {
        return new Date(right.latestTaskAt || 0).getTime() - new Date(left.latestTaskAt || 0).getTime();
      }

      return new Date(right.registeredAt || 0).getTime() - new Date(left.registeredAt || 0).getTime();
    });
  }, [category, rows, sortMode]);

  return (
    <ResourcePage
      title="Service Providers"
      description="Provider health, approval state, and geographic coverage."
      rows={visibleRows}
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
        { key: "rating", label: "Rating" },
        { key: "status", label: "Status" },
        { key: "zone", label: "Zone" },
        { key: "verification", label: "Verification" },
      ]}
      statusKey="status"
      hiddenStatusOptions={["Approved"]}
      extraControls={
        <>
          <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="bg-transparent font-semibold outline-none"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            Sort
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="bg-transparent font-semibold outline-none"
            >
              <option value="latest-registration">Latest registration</option>
              <option value="latest-task">Latest task</option>
            </select>
          </label>
        </>
      }
      searchPlaceholder="Search providers, zones, or service types..."
      stats={buildProviderStats(visibleRows)}
    />
  );
}
