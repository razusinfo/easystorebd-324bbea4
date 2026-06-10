import { createFileRoute } from "@tanstack/react-router";
import { Plus, Download, Filter, Package as PackageIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { useI18n, formatCurrency, formatNumber } from "@/lib/i18n";
import { products } from "@/lib/mock-data";
import { useState } from "react";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Bongo Inventory" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const list = products.filter((p) =>
    [p.name, p.nameBn, p.sku, p.brand, p.category].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title={t("inventory")}
        subtitle={lang === "bn" ? `${products.length} টি পণ্য, ${products.reduce((a, b) => a + b.stock, 0)} টি স্টকে` : `${products.length} products, ${products.reduce((a, b) => a + b.stock, 0)} in stock`}
        action={
          <div className="flex gap-2">
            <button className="h-10 px-3 rounded-lg bg-card border border-border hover:bg-muted text-sm font-semibold flex items-center gap-1.5">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            <button className="h-10 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 shadow-md hover:shadow-glow">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t("new")} {t("products")}</span><span className="sm:hidden">{t("new")}</span>
            </button>
          </div>
        }
      />

      <div className="glass-card rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="flex-1 h-10 px-3 rounded-lg bg-muted/40 border border-border outline-none focus:border-ring"
          />
          <button className="h-10 px-3 rounded-lg bg-muted/40 border border-border hover:bg-muted text-sm font-semibold flex items-center gap-1.5">
            <Filter className="h-4 w-4" /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-3 px-3">{t("products")}</th>
                <th className="py-3 px-3">{t("sku")}</th>
                <th className="py-3 px-3">{t("category")}</th>
                <th className="py-3 px-3">{t("brandLabel")}</th>
                <th className="py-3 px-3 text-right">{t("price")}</th>
                <th className="py-3 px-3 text-right">{t("stock")}</th>
                <th className="py-3 px-3">{t("warehouse")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const low = p.stock <= p.lowStockAt;
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/40 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg gradient-primary text-primary-foreground font-bold">
                          {p.brand.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{lang === "bn" ? p.nameBn : p.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">{p.sku}</td>
                    <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent-foreground text-xs font-semibold">{p.category}</span></td>
                    <td className="py-3 px-3 text-muted-foreground">{p.brand}</td>
                    <td className="py-3 px-3 text-right font-bold">{formatCurrency(p.price, lang)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${low ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
                        <PackageIcon className="h-3 w-3" />{formatNumber(p.stock, lang)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{p.warehouse}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
