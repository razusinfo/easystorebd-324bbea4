import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { STOREFRONT_APEX_DOMAINS, getStorefrontSlugFromHost } from "@/lib/storefront-host";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("stores")
      .select("name, tagline")
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    return { storeName: data?.name ?? null, tagline: data?.tagline ?? null };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.storeName ?? params.slug;
    const desc = (loaderData?.tagline && loaderData.tagline.trim()) || `Shop online at ${name}.`;
    return {
      meta: [
        { title: name },
        { name: "description", content: desc },
        { property: "og:title", content: name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: name },
      ],
    };
  },
  component: SlugLayout,
});

function SlugLayout() {
  const { slug } = Route.useParams();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    // Already on a storefront subdomain — do nothing.
    if (getStorefrontSlugFromHost(host)) return;
    // Only redirect from a recognized apex (skip localhost/preview/custom).
    const apex = STOREFRONT_APEX_DOMAINS.find((a) => host === a || host.endsWith(`.${a}`));
    if (!apex) return;
    const rest = window.location.pathname.replace(/^\/s\/[^/]+/, "") + window.location.search + window.location.hash;
    window.location.replace(`https://${slug}.${apex}${rest || "/"}`);
  }, [slug]);
  return <Outlet />;
}
