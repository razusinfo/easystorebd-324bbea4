import { createFileRoute } from "@tanstack/react-router";
import { Plus, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { useI18n, formatCurrency } from "@/lib/i18n";
import { sales } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/sales")({
  head: () => ({ meta: [{ title: "Sales — Bongo Inventory" }] }),
  component: SalesPage,
});

function SalesPage() {
  const { t, lang } = useI18n();
  return (
    <div>
      <PageHeader
        title={t("sales")}
        subtitle={lang === "bn" ? "সমস্ত বিক্রয় ইনভয়েস এক জায়গায়" : "All sales invoices in one place"}
        action={
          <a href="/pos" className="h-10 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 shadow-md">
            <Plus className="h-4 w-4" /> {t("new")} {t("sales")}
          </a>
        }
      />
      <div className="glass-card rounded-2xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="py-3 px-3">{t("invoice")}</th>
              <th className="py-3 px-3">{t("customerLabel")}</th>
              <th className="py-3 px-3">{t("date")}</th>
              <th className="py-3 px-3 text-right">{t("total")}</th>
              <th className="py-3 px-3 text-right">{t("paid")}</th>
              <th className="py-3 px-3 text-right">{t("due")}</th>
              <th className="py-3 px-3">{t("status")}</th>
              <th className="py-3 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/40 transition">
                <td className="py-3 px-3 font-mono font-semibold">{s.invoice}</td>
                <td className="py-3 px-3">{s.customer}</td>
                <td className="py-3 px-3 text-muted-foreground">{s.date}</td>
                <td className="py-3 px-3 text-right font-bold">{formatCurrency(s.total, lang)}</td>
                <td className="py-3 px-3 text-right text-success">{formatCurrency(s.paid, lang)}</td>
                <td className="py-3 px-3 text-right text-destructive">{formatCurrency(s.total - s.paid, lang)}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    s.status === "Paid" ? "bg-success/15 text-success" : s.status === "Partial" ? "bg-warning/20 text-warning-foreground dark:text-warning" : "bg-destructive/15 text-destructive"
                  }`}>{s.status}</span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Printer className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
