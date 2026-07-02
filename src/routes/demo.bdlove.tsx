import { createFileRoute } from "@tanstack/react-router";
import { BdLoveTemplate } from "@/components/templates/bdlove-template";

export const Route = createFileRoute("/demo/bdlove")({
  component: DemoBdLove,
  head: () => ({
    meta: [
      { title: "BD Love Shop template — EazyStore" },
      { name: "description", content: "Preview the BD Love Shop storefront template: sidebar categories, purple accents, BDT pricing, responsive product grid." },
    ],
  }),
});

function DemoBdLove() {
  return <BdLoveTemplate demo />;
}
