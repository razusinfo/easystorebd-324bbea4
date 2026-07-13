import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { STOREFRONT_APEX_DOMAINS, getStorefrontSlugFromHost } from "@/lib/storefront-host";
import { loadStoreHeadInfo, storefrontFaviconLinks, storefrontSectionMeta } from "@/lib/storefront-head";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => loadStoreHeadInfo(params.slug),
  head: ({ params, loaderData }) => {
    const name = loaderData?.storeName ?? null;
    const desc = (loaderData?.tagline && loaderData.tagline.trim()) || undefined;
    return {
      meta: [
        ...storefrontSectionMeta({ slug: params.slug, storeName: name, description: desc }),
        { property: "og:type", content: "website" },
      ],
      links: storefrontFaviconLinks(params.slug),
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
