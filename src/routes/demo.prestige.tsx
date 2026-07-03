import { createFileRoute } from "@tanstack/react-router";
import { PrestigeTemplate } from "@/components/templates/prestige-template";
import { usePublicStoreBySlug } from "@/lib/eazystore-data";

export const Route = createFileRoute("/demo/prestige")({
  head: () => ({
    meta: [
      { title: "Prestige Bento — Premium Mobile Commerce Preview" },
      { name: "description", content: "Preview the Prestige Bento mobile storefront: sticky search, category rail, flash-sale countdown, bento product grid." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PrestigeDemoPage,
});

function PrestigeDemoPage() {
  const q = usePublicStoreBySlug("sylhetionlineshop");
  const store = q.data?.store;
  const products = q.data?.products ?? [];
  const categories = q.data?.categories ?? [];
  const logoUrl = q.data?.logoUrl ?? null;

  return (
    <PrestigeTemplate
      store={store ?? { name: "EazyStore" }}
      products={products}
      logoUrl={logoUrl}
      categories={categories}
      demo={!store}
    />
  );
}
