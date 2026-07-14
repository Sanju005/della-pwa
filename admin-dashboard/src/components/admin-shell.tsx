import {
  Bell,
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquareHeart,
  MessageSquareWarning,
  Percent,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";
import type { NavItem } from "../types";

const navigation: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Users", to: "/users", icon: Users },
  { label: "Providers", to: "/service-providers", icon: BriefcaseBusiness },
  { label: "Bookings", to: "/tasks-bookings", icon: ClipboardList },
  { label: "Payments", to: "/payments", icon: CircleDollarSign },
  { label: "Services", to: "/provider-approvals", icon: ShieldCheck },
  { label: "Reviews", to: "/reviews", icon: MessageSquareHeart },
  { label: "Reports", to: "/complaints", icon: MessageSquareWarning, count: 5 },
  { label: "Coupons", to: "/settings", icon: Percent },
  { label: "Support Tickets", to: "/settings", icon: Ticket },
  { label: "Notifications", to: "/settings", icon: Bell },
  { label: "Settings", to: "/settings", icon: Settings },
];

const breadcrumbTitles: Array<{ match: RegExp; items: string[] }> = [
  { match: /^\/$/, items: ["Dashboard"] },
  { match: /^\/users\/[^/]+$/, items: ["Users", "User Details"] },
  { match: /^\/users$/, items: ["Users"] },
  { match: /^\/service-providers\/[^/]+$/, items: ["Providers", "Provider Details"] },
  { match: /^\/service-providers$/, items: ["Providers"] },
  { match: /^\/tasks-bookings$/, items: ["Bookings"] },
  { match: /^\/payments$/, items: ["Payments"] },
  { match: /^\/provider-approvals$/, items: ["Services"] },
  { match: /^\/reviews$/, items: ["Reviews"] },
  { match: /^\/complaints$/, items: ["Reports"] },
  { match: /^\/settings$/, items: ["Settings"] },
];

export function AdminShell() {
  const location = useLocation();
  const { profile, session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = profile?.full_name?.trim() || session?.user.email || "User";
  const displayRole = profile?.role?.replaceAll("_", " ") || "Signed in";

  const breadcrumbs = useMemo(() => {
    return (
      breadcrumbTitles.find((entry) => entry.match.test(location.pathname))?.items ?? ["Dashboard"]
    );
  }, [location.pathname]);
  const initials = useMemo(() => {
    const name = displayName.trim();

    if (!name) {
      return "DA";
    }

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [displayName]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.10),transparent_22%),linear-gradient(180deg,#fffafc_0%,#fff5fa_52%,#fffdfd_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1640px] gap-4 p-3 lg:p-4">
        <aside
          className={`fixed inset-y-3 left-3 z-40 w-[178px] rounded-[30px] border border-white/30 bg-[linear-gradient(180deg,#ffd9eb_0%,#f7a8cd_32%,#e46aa4_68%,#d63384_100%)] px-3 py-4 shadow-[0_30px_90px_rgba(214,51,132,0.26)] transition duration-300 lg:static lg:translate-x-0 ${
            menuOpen ? "translate-x-0" : "-translate-x-[120%]"
          }`}
        >
          <div className="flex items-center justify-between px-2">
            <Link to="/" className="font-display text-[2.15rem] font-extrabold tracking-tight text-[#6f1244]">
              DELLA
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="grid size-9 place-items-center rounded-2xl bg-white/35 text-[#6f1244] lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav className="mt-7 space-y-1.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between rounded-[14px] px-3 py-3 text-[15px] font-semibold transition ${
                    isActive
                      ? "bg-white/75 text-[#8f1d63] shadow-[0_12px_24px_rgba(143,29,99,0.12)]"
                      : "text-[#6f1244] hover:bg-white/28"
                  }`}
                >
                  <span className={`flex items-center gap-3 ${isActive ? "text-[#8f1d63]" : "text-[#6f1244]"}`}>
                    <Icon className={`size-4.5 shrink-0 ${isActive ? "text-[#8f1d63]" : "text-[#6f1244]"}`} />
                    {item.label}
                  </span>
                  {item.count ? (
                    <span className="rounded-full bg-white/45 px-2 py-0.5 text-[11px] text-[#8f1d63]">
                      {item.count}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-white/35 pt-4" />

          <div className="mt-auto flex min-h-[120px] items-end px-1">
            <div className="w-full rounded-[18px] border border-white/35 bg-white/20 p-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-white text-sm font-bold text-[#b4236b]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#6f1244]">
                    {displayName}
                  </p>
                  <p className="truncate text-xs capitalize text-[#8f1d63]/80">
                    {displayRole}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 w-full rounded-2xl border border-white/45 bg-white/55 px-3 py-2.5 text-sm font-semibold text-[#8f1d63] transition hover:bg-white/72"
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {menuOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          />
        ) : null}

        <div className="flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col rounded-[30px] bg-transparent p-1 lg:p-2">
          <header className="flex flex-col gap-4 rounded-[22px] border border-[#f3d7e7] bg-white/92 px-5 py-3 shadow-[0_12px_30px_rgba(214,51,132,0.06)] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="grid size-11 place-items-center rounded-2xl bg-[#d63384] text-white lg:hidden"
              >
                <Menu className="size-5" />
              </button>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb} className="flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        index === breadcrumbs.length - 1 ? "text-slate-950" : "text-slate-500"
                      }`}
                    >
                      {crumb}
                    </span>
                    {index < breadcrumbs.length - 1 ? <span className="text-slate-300">&gt;</span> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="flex min-w-[280px] items-center gap-3 rounded-2xl border border-[#f0d8e5] bg-white px-4 py-3 text-sm text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                <Search className="size-4" />
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                />
              </label>
              <button
                type="button"
                className="relative grid size-11 place-items-center rounded-2xl border border-[#f0d8e5] bg-white text-[#8f1d63]"
              >
                <Bell className="size-5" />
                <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500" />
              </button>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-2xl border border-[#f0d8e5] bg-white text-[#8f1d63]"
              >
                <Menu className="size-5" />
              </button>
            </div>
          </header>

          <main className="mt-4 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
