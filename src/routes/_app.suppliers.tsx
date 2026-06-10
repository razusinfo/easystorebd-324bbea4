import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { useI18n, formatCurrency } from "@/lib/i18n";
import { suppliers } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Bongo Inventory" }] }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { t, lang } = useI18n();
  return (
    <div>
      <PageHeader
        title={t("suppliers")}
        action={
          <button className="h-10 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 shadow-md">
            <Plus className="h-4 w-4" /> {t("new")}
          </button>
        }
      />
      <div className="glass-card rounded-2xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="py-3 px-3">{t("name")}</th>
              <th className="py-3 px-3">{t("phone")}</th>
              <th className="py-3 px-3 text-right">{t("due")}</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/40">
                <td className="py-3 px-3 font-semibold">{s.name}</td>
                <td className="py-3 px-3 text-muted-foreground">{s.contact}</td>
                <td className="py-3 px-3 text-right">
                  <span className={`px-2 py-0.5 rounded-md font-bold ${s.due > 0 ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
                    {formatCurrency(s.due, lang)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
