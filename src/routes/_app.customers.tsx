import { createFileRoute } from "@tanstack/react-router";
import { Plus, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { useI18n, formatCurrency } from "@/lib/i18n";
import { customers } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Bongo Inventory" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const { t, lang } = useI18n();
  return (
    <div>
      <PageHeader
        title={t("customers")}
        subtitle={lang === "bn" ? `${customers.length} জন নিবন্ধিত গ্রাহক` : `${customers.length} registered customers`}
        action={
          <button className="h-10 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 shadow-md">
            <Plus className="h-4 w-4" /> {t("new")} {t("customerLabel")}
          </button>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => (
          <div key={c.id} className="glass-card rounded-2xl p-5 hover:shadow-glow hover:-translate-y-0.5 transition">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full gradient-accent text-accent-foreground font-black text-lg">
                {c.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="font-bold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Total</div>
                <div className="font-bold">{formatCurrency(c.totalPurchase, lang)}</div>
              </div>
              <div className={`rounded-lg p-2 ${c.due > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">{t("due")}</div>
                <div className={`font-bold ${c.due > 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(c.due, lang)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
