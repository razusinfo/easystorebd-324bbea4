import { createFileRoute } from "@tanstack/react-router";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { loadStoreHeadInfo, storefrontFaviconLinks, storefrontSectionMeta } from "@/lib/storefront-head";

export const Route = createFileRoute("/s/$slug/team")({
  loader: async ({ params }) => loadStoreHeadInfo(params.slug),
  head: ({ params, loaderData }) => ({
    meta: storefrontSectionMeta({ slug: params.slug, storeName: loaderData?.storeName ?? null, section: "Team" }),
    links: storefrontFaviconLinks(params.slug),
  }),
  component: TeamPage,
});

function TeamPage() {
  const { slug } = Route.useParams();
  return (
    <StorefrontPage slug={slug} title="Team">
      <p className="text-neutral-600">
        The store hasn't added team information yet. Check back soon!
      </p>
    </StorefrontPage>
  );
}
