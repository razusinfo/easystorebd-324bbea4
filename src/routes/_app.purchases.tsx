import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/purchases")({
  head: () => ({ meta: [{ title: "Purchases — Bongo Inventory" }] }),
  component: () => {
    const { t } = useI18n();
    return <ComingSoon title={t("purchases")} />;
  },
});
