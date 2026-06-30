import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/courier")({
  head: () => ({ meta: [{ title: "Courier — EazyStore" }] }),
  component: () => <ComingSoon title="Courier" />,
});
