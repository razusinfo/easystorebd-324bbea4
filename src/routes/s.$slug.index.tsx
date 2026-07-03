import { createFileRoute } from "@tanstack/react-router";
import { StorefrontView } from "@/components/storefront-view";

export const Route = createFileRoute("/s/$slug/")({
  component: PublicStorefrontRoute,
});

function PublicStorefrontRoute() {
  const { slug } = Route.useParams();
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem("last_store_slug", slug); } catch { /* ignore */ }
  }
  return <StorefrontView slug={slug} />;
}
