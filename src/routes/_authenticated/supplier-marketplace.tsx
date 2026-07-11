import { createFileRoute } from "@tanstack/react-router";
import { Route as ResellerProductsRoute } from "./reseller-products";

// Supplier Marketplace: alias route for resellers to browse supplier products
// and add them to their store (with custom retail price). Reuses the existing
// reseller-products page component so both URLs stay in sync.
export const Route = createFileRoute("/_authenticated/supplier-marketplace")({
  component: ResellerProductsRoute.options.component!,
});
