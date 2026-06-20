interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase text-brand-700">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
