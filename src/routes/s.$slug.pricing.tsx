import { createFileRoute } from "@tanstack/react-router";
import { StorefrontPage } from "@/components/storefront/storefront-page";

export const Route = createFileRoute("/s/$slug/pricing")({
  head: ({ params }) => ({
    meta: [
      { title: `Pricing — ${params.slug}` },
      { name: "description", content: `Pricing information for ${params.slug}.` },
      { property: "og:title", content: `Pricing — ${params.slug}` },
      { property: "og:description", content: `Pricing at ${params.slug}.` },
    ],
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
