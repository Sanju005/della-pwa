import type { LucideIcon } from "lucide-react";

export function FeatureItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-15 w-15 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(137,104,205,0.14)_0%,rgba(137,104,205,0.08)_100%)] text-[#8968CD] shadow-[0_14px_28px_rgba(137,104,205,0.10)]">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-4 max-w-[9.5rem] text-[15px] font-semibold leading-7 text-[#252650]">
        {label}
      </p>
    </div>
  );
}
