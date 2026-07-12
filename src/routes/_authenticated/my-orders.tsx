import { createFileRoute, redirect } from "@tanstack/react-router";

// My Orders has been merged into Order For Suppliers. Keep the URL working via
// a permanent client redirect (fires in beforeLoad so the browser's location
// updates to /order-management before render). Canonical/og:url point at the
// merged page so crawlers don't index /my-orders as a distinct URL.
export const Route = createFileRoute("/_authenticated/my-orders")({
  beforeLoad: () => {
    throw redirect({ to: "/order-management", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Order For Suppliers — EasyStore" },
      { name: "robots", content: "noindex, follow" },
      {
        property: "og:url",
        content: "https://easystorebd.lovable.app/order-management",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://easystorebd.lovable.app/order-management",
      },
    ],
  }),
});
