import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — EazyStore` },
      { name: "description", content: `Shop online at ${params.slug} on EazyStore.` },
      { property: "og:title", content: `${params.slug} — EazyStore` },
      { property: "og:description", content: `Shop online at ${params.slug} on EazyStore.` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => <Outlet />,
});
