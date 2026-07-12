import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into Reseller Products — keep the URL working via redirect.
export const Route = createFileRoute("/_authenticated/supplier-marketplace")({
  beforeLoad: () => {
    throw redirect({ to: "/reseller-products" });
  },
});
