import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/landing-pages")({
  head: () => ({ meta: [{ title: "Landing Pages — EasyStore" }] }),
  component: () => <ComingSoon title="Landing Pages" />,
});
