import type { LucideIcon } from "lucide-react";

export function StatsBar({
  stats,
}: {
  stats: ReadonlyArray<{
    value: string;
    label: string;
    icon: LucideIcon;
  }>;
}) {
  return (
    <section className="rounded-[28px] bg-[linear-gradient(135deg,#6231B6_0%,#804DDA_50%,#8D66D8_100%)] px-5 py-5 text-white shadow-[0_28px_56px_rgba(98,49,182,0.28)]">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-0">
        {stats.map(({ value, label, icon: Icon }, index) => (
          <div
            key={label}
            className={`flex items-center gap-4 rounded-[22px] px-2 py-3 lg:px-8 ${
              index > 0 ? "lg:border-l lg:border-white/16" : ""
            }`}
          >
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-white">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[clamp(1.55rem,2vw,2.3rem)] font-extrabold leading-none">{value}</p>
              <p className="mt-2 text-[15px] font-medium text-white/92">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
