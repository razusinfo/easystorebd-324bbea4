import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ShoppingCart, Megaphone, Zap, FolderTree } from "lucide-react";

const tabs = [
  { url: "/admin-marketplace/orders", label: "Orders", icon: ShoppingCart },
  { url: "/admin-marketplace/campaigns", label: "Campaigns & Banners", icon: Megaphone },
  { url: "/admin-marketplace/flash-sales", label: "Flash Sales", icon: Zap },
  { url: "/admin-marketplace/categories", label: "Categories & Menu", icon: FolderTree },
];

export function MarketplaceAdminShell({
  title,
  description,
  actions,
  currentPath,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 md:p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> EasyStore365.com Control · Marketplace Management Module
        </div>
        <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-1.5">
        {tabs.map((t) => {
          const active = currentPath === t.url;
          const Icon = t.icon;
          return (
            <Link
              key={t.url}
              to={t.url}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "gradient-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
