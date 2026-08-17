import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ResourcePage } from "./resource-page";
import { buildUserStats, listUsersWithFallback } from "../lib/admin-users";
import type { UserRow } from "../types";

export function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setLoading(true);
      const nextRows = await listUsersWithFallback();

      if (!active) {
        return;
      }

      setRows(nextRows);
      setLoading(false);
    }

    void loadUsers();

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
      title="Users"
      description="Customer accounts only."
      rows={rows}
      columns={[
        {
          key: "id",
          label: "ID",
          render: (row) => (
            <Link
              to={`/users/${row.id}`}
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {String(row.id)}
            </Link>
          ),
        },
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role" },
        { key: "status", label: "Status" },
        { key: "city", label: "City" },
        { key: "joined", label: "Joined" },
      ]}
      statusKey="status"
      searchPlaceholder="Search customers by name, email, or role..."
      stats={buildUserStats(rows)}
    />
  );
}
