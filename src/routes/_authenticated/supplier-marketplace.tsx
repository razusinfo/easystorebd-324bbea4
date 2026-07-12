import { createFileRoute, redirect } from "@tanstack/react-router";

// Supplier Marketplace has been merged into Reseller Products.
// Keep the URL working via a permanent client redirect (fires in beforeLoad
// so the browser's location updates to /reseller-products before render —
// the sidebar and any breadcrumbs then correctly show Reseller Products
// as the active route). Canonical and og:url point at the merged page so
// crawlers don't index /supplier-marketplace as a distinct URL.
export const Route = createFileRoute("/_authenticated/supplier-marketplace")({
  beforeLoad: () => {
    throw redirect({ to: "/reseller-products", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Reseller Products — EasyStore" },
      { name: "robots", content: "noindex, follow" },
      {
        property: "og:url",
        content: "https://easystorebd.lovable.app/reseller-products",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://easystorebd.lovable.app/reseller-products",
      },
    ],
  }),
});
