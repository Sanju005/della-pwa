import { useEffect, useState } from "react";
import { ResourcePage } from "./resource-page";
import { buildReviewStats, listReviewsWithFallback } from "../lib/admin-reviews";
import type { ReviewRow } from "../types";

export function ReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      setLoading(true);
      const nextRows = await listReviewsWithFallback();

      if (!active) {
        return;
      }

      setRows(nextRows);
      setLoading(false);
    }

    void loadReviews();

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
      title="Reviews"
      description="Moderation and quality signals from marketplace feedback."
      rows={rows}
      columns={[
        { key: "id", label: "ID" },
        { key: "customer", label: "Customer" },
        { key: "provider", label: "Provider" },
        { key: "rating", label: "Rating" },
        { key: "comment", label: "Comment" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ]}
      statusKey="status"
      searchPlaceholder="Search reviews, comments, or providers..."
      stats={buildReviewStats(rows)}
    />
  );
}
