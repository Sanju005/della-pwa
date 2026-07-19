import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { approvalItems, dashboardMetrics } from "../data/mock-data";
import { DataTable } from "../components/data-table";
import { StatusBadge, statusToTone } from "../components/status-badge";
import { AdminStatCard, LoadingState, SectionTitle } from "../components/ui-kit";
import { getDashboardSnapshot } from "../lib/dashboard-metrics";
import type { ComplaintRow, DashboardBooking, PaymentRow, ReviewRow, UserRow } from "../types";

const bookingColumns = [
  { key: "id", label: "ID" },
  { key: "service", label: "Service" },
  { key: "provider", label: "Provider" },
  { key: "customer", label: "Customer" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount" },
  { key: "schedule", label: "Date & Time" },
] as const;

const paymentColumns = [
  { key: "id", label: "ID" },
  { key: "customer", label: "Customer" },
  { key: "provider", label: "Provider" },
  { key: "amount", label: "Amount" },
  { key: "method", label: "Method" },
  { key: "status", label: "Status" },
  { key: "date", label: "Date" },
] as const;

export function DashboardPage() {
  const [metrics, setMetrics] = useState(dashboardMetrics);
  const [approvals, setApprovals] = useState(approvalItems);
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSnapshot() {
      const snapshot = await getDashboardSnapshot();

      if (!active) {
        return;
      }

      setMetrics(snapshot.metrics);
      setApprovals(snapshot.approvals);
      setBookings(snapshot.recentBookings);
      setPayments(snapshot.recentPayments);
      setReviews(snapshot.recentReviews);
      setComplaints(snapshot.recentComplaints);
      setUsers(snapshot.userRows);
      setLoading(false);
    }

    void loadSnapshot();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  const totalTasks = bookings.length;
  const pendingTasks = bookings.filter((row) => row.status.toLowerCase() === "pending").length;
  const acceptedTasks = bookings.filter((row) => row.status.toLowerCase() === "accepted").length;
  const inProgressTasks = bookings.filter((row) => row.status.toLowerCase() === "in progress").length;
  const completedTasks = bookings.filter((row) => row.status.toLowerCase() === "completed").length;
  const activeUsers = users.filter((row) => ["active", "verified"].includes(row.status.toLowerCase())).length;
  const inactiveUsers = users.filter((row) => row.status.toLowerCase() === "inactive").length;
  const bannedUsers = users.filter((row) => ["banned", "suspended", "deleted"].includes(row.status.toLowerCase())).length;
  const totalUsers = users.length;

  const taskMix = [
    ["Pending", String(pendingTasks), totalTasks ? `${((pendingTasks / totalTasks) * 100).toFixed(1)}%` : "0.0%", "amber"],
    ["Accepted", String(acceptedTasks), totalTasks ? `${((acceptedTasks / totalTasks) * 100).toFixed(1)}%` : "0.0%", "sky"],
    ["In Progress", String(inProgressTasks), totalTasks ? `${((inProgressTasks / totalTasks) * 100).toFixed(1)}%` : "0.0%", "violet"],
    ["Completed", String(completedTasks), totalTasks ? `${((completedTasks / totalTasks) * 100).toFixed(1)}%` : "0.0%", "emerald"],
  ] as const;

  const userOverview = [
    ["Active users", activeUsers, totalUsers ? `${((activeUsers / totalUsers) * 100).toFixed(1)}%` : "0.0%", "bg-[#2563eb]"],
    ["Inactive users", inactiveUsers, totalUsers ? `${((inactiveUsers / totalUsers) * 100).toFixed(1)}%` : "0.0%", "bg-[#8b5cf6]"],
    ["Banned users", bannedUsers, totalUsers ? `${((bannedUsers / totalUsers) * 100).toFixed(1)}%` : "0.0%", "bg-[#fb7185]"],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <AdminStatCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              delta={metric.delta}
              trend={metric.trend}
              accent={metric.accent}
              icon={<Icon className="size-6" />}
            />
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-[30px] border border-[#f5dae8] bg-white/92 p-5 shadow-[0_24px_80px_rgba(214,51,132,0.08)] xl:p-6">
          <SectionTitle
            title="Bookings / tasks overview"
            description="Service flow over the last seven days."
            action={<div className="rounded-full bg-[#fff1f6] px-3 py-2 text-xs font-semibold text-[#b4236b]">Last 7 days</div>}
          />

          <div className="mt-8 grid h-[280px] grid-cols-7 items-end gap-3">
            {[
              { day: "30 May", active: 56, completed: 24, cancelled: 12 },
              { day: "31 May", active: 78, completed: 38, cancelled: 18 },
              { day: "1 Jun", active: 94, completed: 51, cancelled: 24 },
              { day: "2 Jun", active: 80, completed: 47, cancelled: 19 },
              { day: "3 Jun", active: 82, completed: 49, cancelled: 18 },
              { day: "4 Jun", active: 97, completed: 58, cancelled: 23 },
              { day: "5 Jun", active: 112, completed: 76, cancelled: 31 },
            ].map((point) => (
              <div key={point.day} className="flex h-full flex-col justify-end gap-3">
                <div className="flex h-full items-end gap-1">
                  <div className="w-full rounded-t-2xl bg-[#f472b6]" style={{ height: `${point.active}%` }} />
                  <div className="w-full rounded-t-2xl bg-[#ec4899]" style={{ height: `${point.completed}%` }} />
                  <div className="w-full rounded-t-2xl bg-[#fb7185]" style={{ height: `${point.cancelled}%` }} />
                </div>
                <p className="text-center text-xs font-medium text-slate-400">{point.day}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#f472b6]" />
              Active
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#ec4899]" />
              Completed
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#fb7185]" />
              Cancelled
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[30px] border border-[#f5dae8] bg-white/92 p-5 shadow-[0_24px_80px_rgba(214,51,132,0.08)]">
            <SectionTitle title="Task mix" />
            <div className="mt-6 flex items-center justify-center">
              <div className="relative grid size-52 place-items-center rounded-full bg-[conic-gradient(#fb7185_0deg_92deg,#f472b6_92deg_210deg,#d946ef_210deg_292deg,#ec4899_292deg_360deg)]">
                <div className="grid size-32 place-items-center rounded-full bg-white shadow-inner">
                  <div className="text-center">
                    <p className="font-display text-4xl font-extrabold text-slate-950">{totalTasks || 0}</p>
                    <p className="text-sm text-slate-500">Total</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              {taskMix.map(([label, value, percent, status]) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`size-2.5 rounded-full ${
                      status === "amber"
                        ? "bg-[#fb7185]"
                        : status === "sky"
                          ? "bg-[#f472b6]"
                          : status === "violet"
                            ? "bg-[#d946ef]"
                            : "bg-[#ec4899]"
                    }`} />
                    <span className="font-medium text-slate-600">{label}</span>
                  </div>
                  <span className="font-semibold text-slate-950">
                    {value} <span className="text-slate-400">{percent}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#f5dae8] bg-white/92 p-5 shadow-[0_24px_80px_rgba(214,51,132,0.08)]">
            <SectionTitle title="Pending approvals" action={<span className="text-sm font-semibold text-[#b4236b]">View all</span>} />
            <div className="mt-5 space-y-3">
              {approvals.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between rounded-2xl border border-[#f7e3ec] bg-[#fff8fb] px-4 py-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.note}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${item.accent}`}>
                    {item.pending}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Recent bookings / tasks"
          description="Latest customer activity across the marketplace."
          rows={bookings}
          columns={[...bookingColumns]}
          statusKey="status"
          searchPlaceholder="Search tasks, providers, or customers..."
        />
        <DataTable
          title="Recent payments"
          description="Settlement and payment monitoring."
          rows={payments}
          columns={[...paymentColumns]}
          statusKey="status"
          searchPlaceholder="Search payment IDs or customer names..."
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
        <div className="rounded-[30px] border border-[#f5dae8] bg-white/92 p-5 shadow-[0_24px_80px_rgba(214,51,132,0.08)]">
          <SectionTitle title="Recent reviews" action={<span className="text-sm font-semibold text-[#b4236b]">View all</span>} />
          <div className="mt-5 space-y-4">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-[#f7e3ec] bg-[#fff8fb] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">{review.customer}</p>
                    <p className="text-sm text-slate-500">for {review.provider}</p>
                  </div>
                  <StatusBadge status={review.status} />
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">"{review.comment}"</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#f5dae8] bg-white/92 p-5 shadow-[0_24px_80px_rgba(214,51,132,0.08)]">
          <SectionTitle title="Recent complaints" action={<span className="text-sm font-semibold text-[#b4236b]">View all</span>} />
          <div className="mt-5 space-y-3">
            {complaints.map((complaint) => (
              <div
                key={complaint.id}
                className="rounded-2xl border border-[#f7e3ec] bg-[#fff8fb] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">{complaint.subject}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {complaint.ticket} • {complaint.customer}
                    </p>
                  </div>
                  <StatusBadge status={complaint.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{complaint.owner}</span>
                  <span className={`font-semibold ${
                    statusToTone(complaint.priority) === "rose"
                      ? "text-rose-600"
                      : statusToTone(complaint.priority) === "amber"
                        ? "text-amber-600"
                        : "text-sky-600"
                  }`}>
                    {complaint.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#f5dae8] bg-white/92 p-5 shadow-[0_24px_80px_rgba(214,51,132,0.08)]">
          <SectionTitle title="Users overview" action={<span className="text-sm font-semibold text-[#b4236b]">View report</span>} />
          <div className="mt-8 flex justify-center">
            <div className="grid size-52 place-items-center rounded-full bg-[conic-gradient(#2563eb_0deg_276deg,#8b5cf6_276deg_336deg,#fb7185_336deg_360deg)]">
              <div className="grid size-32 place-items-center rounded-full bg-white shadow-inner">
                  <div className="text-center">
                    <p className="font-display text-4xl font-extrabold text-slate-950">{totalUsers || 0}</p>
                    <p className="text-sm text-slate-500">Total users</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm">
            {userOverview.map(([label, value, percent, tone]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="flex items-center gap-3 text-slate-600">
                  <span className={`size-2.5 rounded-full ${tone}`} />
                  {label}
                </span>
                <span className="font-semibold text-slate-950">
                  {value.toLocaleString("en-MY")} <span className="text-slate-400">{percent}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
