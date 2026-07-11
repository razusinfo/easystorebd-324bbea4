import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/spotlights")({
  head: () => ({ meta: [{ title: "Spotlights — EasyStore" }] }),
  component: () => <ComingSoon title="Spotlights" />,
});
