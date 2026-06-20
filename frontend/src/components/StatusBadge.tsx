type BadgeTone = "blue" | "green" | "amber" | "red" | "slate";

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

const toneClass: Record<BadgeTone, string> = {
  blue: "bg-brand-50 text-brand-700 ring-brand-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-rose-50 text-rose-700 ring-rose-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ label, tone = "slate" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex max-w-[180px] items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClass[tone]}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}
