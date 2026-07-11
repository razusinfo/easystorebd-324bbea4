import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — EasyStore` },
      { name: "description", content: `Shop online at ${params.slug} on EasyStore.` },
      { property: "og:title", content: `${params.slug} — EasyStore` },
      { property: "og:description", content: `Shop online at ${params.slug} on EasyStore.` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => <Outlet />,
});
