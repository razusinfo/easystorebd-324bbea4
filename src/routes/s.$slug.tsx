import { createFileRoute } from "@tanstack/react-router";
import { StorefrontView } from "@/components/storefront-view";

export const Route = createFileRoute("/s/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — EazyStore` },
      { name: "description", content: `Shop online at ${params.slug} on EazyStore.` },
      { property: "og:title", content: `${params.slug} — EazyStore` },
      { property: "og:description", content: `Shop online at ${params.slug} on EazyStore.` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicStorefrontRoute,
});

function PublicStorefrontRoute() {
  const { slug } = Route.useParams();
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem("last_store_slug", slug); } catch { /* ignore */ }
  }
  return <StorefrontView slug={slug} />;
}
