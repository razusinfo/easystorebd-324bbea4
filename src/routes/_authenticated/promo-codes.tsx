import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/promo-codes")({
  head: () => ({ meta: [{ title: "Promo Codes — EazyStore" }] }),
  component: () => <ComingSoon title="Promo Codes" />,
});
