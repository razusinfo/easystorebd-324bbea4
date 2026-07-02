import { createFileRoute } from "@tanstack/react-router";
import { StorefrontPage } from "@/components/storefront/storefront-page";

export const Route = createFileRoute("/s/$slug/team")({
  head: ({ params }) => ({
    meta: [
      { title: `Team — ${params.slug}` },
      { name: "description", content: `Meet the team behind ${params.slug}.` },
      { property: "og:title", content: `Team — ${params.slug}` },
      { property: "og:description", content: `The team at ${params.slug}.` },
    ],
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
