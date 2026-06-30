import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/manage-shop")({
  head: () => ({ meta: [{ title: "Manage Shop — EazyStore" }] }),
  component: () => <ComingSoon title="Manage Shop" />,
});
