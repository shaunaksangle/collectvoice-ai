import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  accent: "blue" | "emerald" | "amber" | "rose" | "violet";
  icon: LucideIcon;
  label: string;
  trend: string;
  value: string;
}

const accentClass: Record<MetricCardProps["accent"], string> = {
  blue: "bg-brand-50 text-brand-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
};

export function MetricCard({ accent, icon: Icon, label, trend, value }: MetricCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentClass[accent]}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{trend}</p>
    </article>
  );
}
