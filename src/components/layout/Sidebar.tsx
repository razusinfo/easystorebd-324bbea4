import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, Truck, Users, Building2,
  BarChart3, Wallet, ShieldCheck, Wrench, Smartphone, CreditCard, Crown,
  Settings, ChevronLeft, Menu, X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/mock-data";

type NavItem = {
  key: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  roles?: Role[];
  gradient?: string;
};

const items: NavItem[] = [
  { key: "dash", to: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { key: "pos", to: "/pos", icon: ShoppingCart, labelKey: "pos", gradient: "gradient-primary" },
  { key: "inv", to: "/inventory", icon: Package, labelKey: "inventory" },
  { key: "sales", to: "/sales", icon: Receipt, labelKey: "sales" },
  { key: "purch", to: "/purchases", icon: Truck, labelKey: "purchases" },
  { key: "cust", to: "/customers", icon: Users, labelKey: "customers" },
  { key: "sup", to: "/suppliers", icon: Building2, labelKey: "suppliers" },
  { key: "inst", to: "/installments", icon: CreditCard, labelKey: "installments" },
  { key: "warr", to: "/warranty", icon: Wrench, labelKey: "warranty" },
  { key: "imei", to: "/imei", icon: Smartphone, labelKey: "imei" },
  { key: "acct", to: "/accounting", icon: Wallet, labelKey: "accounting", roles: ["store_owner", "manager", "accountant", "super_admin"] },
  { key: "rep", to: "/reports", icon: BarChart3, labelKey: "reports" },
  { key: "emp", to: "/employees", icon: ShieldCheck, labelKey: "employees", roles: ["store_owner", "manager", "super_admin"] },
  { key: "sa", to: "/super-admin", icon: Crown, labelKey: "superAdmin", roles: ["super_admin"] },
  { key: "set", to: "/settings", icon: Settings, labelKey: "settings" },
];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const role = session?.role ?? "store_owner";

  const visible = items.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <>
      {/* mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:z-auto",
        ].join(" ")}
      >
        {/* logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={onMobileClose}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
              <span className="text-lg font-black text-primary-foreground">ব</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display text-base font-bold leading-tight truncate">Bongo Inventory</div>
                <div className="text-[11px] text-sidebar-foreground/60 truncate">{session?.store ?? "Demo Store"}</div>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={onMobileClose}
            className="lg:hidden grid h-8 w-8 place-items-center rounded-md hover:bg-sidebar-accent"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visible.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.key}
                to={it.to}
                onClick={onMobileClose}
                className={[
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                ].join(" ")}
                title={collapsed ? t(it.labelKey) : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{t(it.labelKey)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* collapse button (desktop) */}
        <div className="hidden lg:block border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar-accent/40 hover:bg-sidebar-accent py-2 text-xs font-medium"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lg:hidden grid h-10 w-10 place-items-center rounded-lg border border-border hover:bg-accent/20"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
