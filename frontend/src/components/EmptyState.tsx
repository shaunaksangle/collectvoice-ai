import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  description: string;
  icon: LucideIcon;
  title: string;
}

export function EmptyState({ description, icon: Icon, title }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
