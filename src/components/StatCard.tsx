import type { ReactNode } from "react";

type Variant = "primary" | "accent" | "success" | "warning" | "info";

const variantMap: Record<Variant, string> = {
  primary: "gradient-primary",
  accent: "gradient-accent",
  success: "gradient-success",
  warning: "gradient-warning",
  info: "gradient-info",
};

export function StatCard({
  label,
  value,
  delta,
  icon,
  variant = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  icon: ReactNode;
  variant?: Variant;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-card p-5 hover:-translate-y-1 hover:shadow-glow transition-all duration-300 animate-scale-in">
      <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-30 blur-2xl ${variantMap[variant]}`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-black font-display truncate">{value}</p>
          {delta && (
            <p className="mt-2 text-xs font-semibold text-success">{delta}</p>
          )}
        </div>
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-primary-foreground ${variantMap[variant]} shadow-md`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
