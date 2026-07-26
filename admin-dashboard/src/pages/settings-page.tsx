import { CheckCircle2, Globe2, LockKeyhole, Shield, Sparkles } from "lucide-react";

const settingsGroups = [
  {
    title: "Sign in",
    icon: LockKeyhole,
    items: [
      "Supabase Auth handles sign-in with email and password.",
      "Correct credentials sign in immediately.",
      "Wrong credentials show a simple error message.",
    ],
  },
  {
    title: "Platform controls",
    icon: Shield,
    items: [
      "Review approval queues before exposing new provider listings.",
      "Use complaints and reviews to monitor trust and quality signals.",
      "Keep payout review tightly scoped to finance and management roles.",
    ],
  },
  {
    title: "Deployment",
    icon: Globe2,
    items: [
      "Deploy this app separately to Cloudflare Workers.",
      "Map the Worker to admin.myswiper.my after deploy.",
      "Reuse the same Supabase project but keep frontend code isolated.",
    ],
  },
];

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,#08140f,#0f8b3d_48%,#6d28d9)] p-6 text-white shadow-[0_28px_90px_rgba(8,20,15,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-100">
              DELLA admin settings
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight">
              Operational guardrails, not just UI preferences.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/90">
              This dashboard is intentionally separate from the consumer app so admin
              deployment and routing stay isolated while still using the
              same Supabase backend.
            </p>
          </div>
          <div className="rounded-[26px] border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-emerald-100" />
              <p className="font-semibold">Recommended next step</p>
            </div>
            <p className="mt-3 text-sm text-emerald-50/90">
              Pair this frontend with stricter Supabase RLS or privileged admin APIs before
              wiring sensitive writes like payouts, account suspensions, or manual refunds.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {settingsGroups.map((group) => {
          const Icon = group.icon;

          return (
            <article
              key={group.title}
              className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold text-slate-950">
                {group.title}
              </h3>
              <div className="mt-5 space-y-3">
                {group.items.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl bg-slate-50/90 p-4">
                    <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                    <p className="text-sm leading-7 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
