import { createFileRoute } from "@tanstack/react-router";
import {
  ShoppingCart, TrendingUp, Package, AlertTriangle, Users, Building2,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { PageHeader } from "@/components/layout/AppShell";
import { StatCard } from "@/components/StatCard";
import { useI18n, formatCurrency, formatNumber } from "@/lib/i18n";
import { salesChart, topProducts, sales, products, customers, suppliers } from "@/lib/mock-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "ড্যাশবোর্ড — Bongo Inventory" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t, lang } = useI18n();
  const session = useSession();

  const todayTotal = sales.filter((s) => s.date === "2026-06-10").reduce((a, b) => a + b.total, 0);
  const monthProfit = 482000;
  const totalStock = products.reduce((a, b) => a + b.stock, 0);
  const custDue = customers.reduce((a, b) => a + b.due, 0);
  const supDue = suppliers.reduce((a, b) => a + b.due, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("greeting")}, ${session?.name?.split(" ")[0] ?? "Demo"} 👋`}
        subtitle={lang === "bn" ? "আজকের ব্যবসার সারসংক্ষেপ এক নজরে।" : "Your business at a glance today."}
      />

      {/* stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={t("todaySales")} value={formatCurrency(todayTotal, lang)} delta="↑ 12.4%" icon={<ShoppingCart className="h-5 w-5" />} variant="primary" />
        <StatCard label={t("monthlyProfit")} value={formatCurrency(monthProfit, lang)} delta="↑ 8.1%" icon={<TrendingUp className="h-5 w-5" />} variant="success" />
        <StatCard label={t("totalStock")} value={formatNumber(totalStock, lang)} delta={`${products.length} ${lang === "bn" ? "পণ্য" : "items"}`} icon={<Package className="h-5 w-5" />} variant="info" />
        <StatCard label={t("lowStock")} value={formatNumber(lowStock.length, lang)} delta={lang === "bn" ? "জরুরি রিস্টক" : "Needs restock"} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label={t("customerDue")} value={formatCurrency(custDue, lang)} icon={<Users className="h-5 w-5" />} variant="accent" />
        <StatCard label={t("supplierDue")} value={formatCurrency(supDue, lang)} icon={<Building2 className="h-5 w-5" />} variant="info" />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-bold">{t("salesOverview")}</h3>
              <p className="text-xs text-muted-foreground">{t("weekly")}</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChart}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey={lang === "bn" ? "day" : "en"} stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Line type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="profit" stroke="var(--color-accent)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold mb-4">{t("topProducts")}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={topProducts} dataKey="value" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {topProducts.map((p, i) => <Cell key={i} fill={p.color} />)}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold mb-4">{t("recentSales")}</h3>
          <div className="space-y-2">
            {sales.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{s.invoice}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.customer}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{formatCurrency(s.total, lang)}</div>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold mb-4">{t("lowStock")}</h3>
          <div className="space-y-2">
            {lowStock.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{lang === "bn" ? p.nameBn : p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.sku} • {p.warehouse}</div>
                </div>
                <div className="px-2.5 py-1 rounded-lg gradient-warning text-warning-foreground text-xs font-bold">
                  {formatNumber(p.stock, lang)}
                </div>
              </div>
            ))}
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">All good ✅</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "Paid" | "Partial" | "Due" }) {
  const map = {
    Paid: "bg-success/15 text-success",
    Partial: "bg-warning/20 text-warning-foreground dark:text-warning",
    Due: "bg-destructive/15 text-destructive",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${map[status]}`}>{status}</span>;
}
