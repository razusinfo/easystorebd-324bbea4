import { createFileRoute } from "@tanstack/react-router";
import { StorefrontView } from "@/components/storefront-view";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://easystorebd.com";

export const Route = createFileRoute("/s/$slug/")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("stores")
      .select("name, tagline, slug, custom_domain, published")
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    return { store: data };
  },
  head: ({ params, loaderData }) => {
    const store = loaderData?.store;
    const name = store?.name ?? params.slug;
    const title = `${name} — Shop online`;
    const desc =
      (store?.tagline && store.tagline.trim()) ||
      `Browse and order products from ${name}. Fast delivery, easy checkout, secure payments.`;
    const url = store?.custom_domain
      ? `https://${store.custom_domain}`
      : `https://${params.slug}.easystorebd.com`;
    const image = `${SITE}/api/public/og-logo/${params.slug}`;

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: name },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: `${name} logo` },
        { property: "og:image:width", content: "600" },
        { property: "og:image:height", content: "600" },
        { property: "og:locale", content: "bn_BD" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PublicStorefrontRoute,
});

function PublicStorefrontRoute() {
  const { slug } = Route.useParams();
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem("last_store_slug", slug); } catch { /* ignore */ }
  }
  return <StorefrontView slug={slug} />;
}
