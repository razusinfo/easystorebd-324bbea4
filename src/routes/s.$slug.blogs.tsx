import { createFileRoute } from "@tanstack/react-router";
import { StorefrontPage } from "@/components/storefront/storefront-page";

export const Route = createFileRoute("/s/$slug/blogs")({
  head: ({ params }) => ({
    meta: [
      { title: `Blogs — ${params.slug}` },
      { name: "description", content: `Blog posts from ${params.slug}.` },
      { property: "og:title", content: `Blogs — ${params.slug}` },
      { property: "og:description", content: `News and articles from ${params.slug}.` },
    ],
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
