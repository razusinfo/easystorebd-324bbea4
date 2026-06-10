import { createFileRoute } from "@tanstack/react-router";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/layout/AppShell";
import { useI18n, formatCurrency } from "@/lib/i18n";
import { salesChart } from "@/lib/mock-data";
import { FileBarChart, FileText, Package, Wallet, Users } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — Bongo Inventory" }] }),
  component: ReportsPage,
});

const reportCards = [
  { icon: FileBarChart, key: "Sales Report", bn: "বিক্রয় প্রতিবেদন", v: "gradient-primary" },
  { icon: Package, key: "Stock Report", bn: "স্টক প্রতিবেদন", v: "gradient-info" },
  { icon: FileText, key: "Purchase Report", bn: "ক্রয় প্রতিবেদন", v: "gradient-accent" },
  { icon: Wallet, key: "Profit & Loss", bn: "লাভ-ক্ষতি", v: "gradient-success" },
  { icon: Users, key: "Customer Due", bn: "গ্রাহক বাকি", v: "gradient-warning" },
  { icon: Wallet, key: "Cashbook", bn: "ক্যাশবুক", v: "gradient-info" },
];

function ReportsPage() {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-6">
      <PageHeader title={t("reports")} subtitle={lang === "bn" ? "ব্যবসার সম্পূর্ণ অন্তর্দৃষ্টি" : "Complete business insights"} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportCards.map((r) => (
          <button key={r.key} className="glass-card rounded-2xl p-4 text-left hover:-translate-y-0.5 hover:shadow-glow transition">
            <div className={`grid h-10 w-10 place-items-center rounded-xl text-primary-foreground ${r.v} shadow-md mb-3`}>
              <r.icon className="h-5 w-5" />
            </div>
            <div className="font-bold text-sm leading-tight">{lang === "bn" ? r.bn : r.key}</div>
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-display font-bold text-lg mb-4">{lang === "bn" ? "সাপ্তাহিক বিক্রয় বনাম মুনাফা" : "Weekly Sales vs Profit"}</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey={lang === "bn" ? "day" : "en"} stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => formatCurrency(v, lang)} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
              <Bar dataKey="sales" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="profit" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
