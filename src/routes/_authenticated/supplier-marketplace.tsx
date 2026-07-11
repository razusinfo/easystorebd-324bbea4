import { createFileRoute, redirect } from "@tanstack/react-router";

// Supplier Marketplace: alias URL that redirects to the reseller products
// browsing page (browse supplier products + Add to My Store with custom price).
export const Route = createFileRoute("/_authenticated/supplier-marketplace")({
  beforeLoad: () => {
    throw redirect({ to: "/reseller-products" });
  },
});
