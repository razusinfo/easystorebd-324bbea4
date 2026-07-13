import { createFileRoute } from "@tanstack/react-router";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { loadStoreHeadInfo, storefrontFaviconLinks, storefrontSectionMeta } from "@/lib/storefront-head";

export const Route = createFileRoute("/s/$slug/pricing")({
  loader: async ({ params }) => loadStoreHeadInfo(params.slug),
  head: ({ params, loaderData }) => ({
    meta: storefrontSectionMeta({ slug: params.slug, storeName: loaderData?.storeName ?? null, section: "Pricing" }),
    links: storefrontFaviconLinks(params.slug),
  }),
  component: PricingPage,
});

function PricingPage() {
  const { slug } = Route.useParams();
  return (
    <StorefrontPage slug={slug} title="Pricing">
      <p className="text-neutral-600">
        Each product is priced individually — browse the shop to see current prices.
      </p>
    </StorefrontPage>
  );
}
