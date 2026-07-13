import { createFileRoute } from "@tanstack/react-router";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { loadStoreHeadInfo, storefrontFaviconLinks, storefrontSectionMeta } from "@/lib/storefront-head";

export const Route = createFileRoute("/s/$slug/blogs")({
  loader: async ({ params }) => loadStoreHeadInfo(params.slug),
  head: ({ params, loaderData }) => ({
    meta: storefrontSectionMeta({ slug: params.slug, storeName: loaderData?.storeName ?? null, section: "Blogs" }),
    links: storefrontFaviconLinks(params.slug),
  }),
  component: BlogsPage,
});

function BlogsPage() {
  const { slug } = Route.useParams();
  return (
    <StorefrontPage slug={slug} title="Blogs">
      <p className="text-neutral-600">
        No blog posts yet. The store hasn't published any articles.
      </p>
    </StorefrontPage>
  );
}
