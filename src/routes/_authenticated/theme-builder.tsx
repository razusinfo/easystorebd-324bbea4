import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/theme-builder")({
  head: () => ({ meta: [{ title: "Theme Builder — EazyStore" }] }),
  component: () => <ComingSoon title="Theme Builder" />,
});
