import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/installments")({
  head: () => ({ meta: [{ title: "Installments — Bongo Inventory" }] }),
  component: () => {
    const { t } = useI18n();
    return <ComingSoon title={t("installments")} />;
  },
});
