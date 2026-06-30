import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/mobile-app")({
  head: () => ({ meta: [{ title: "Mobile App — EazyStore" }] }),
  component: () => <ComingSoon title="Mobile App" />,
});
