import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyProducts from "./tools/list-my-products";
import listMyOrders from "./tools/list-my-orders";
import getMyStore from "./tools/get-my-store";

// Build the OAuth issuer from the direct Supabase host — the `.lovable.cloud`
// proxy is rejected by mcp-js (RFC 8414 issuer mismatch). The project ref is
// the only value that survives publish; VITE_SUPABASE_PROJECT_ID is inlined
// as a literal by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "eazystore-mcp",
  title: "EasyStore",
  version: "0.1.0",
  instructions:
    "Tools to inspect an EasyStore seller's store: read the store profile, list products, and list orders. All data is scoped to the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyStore, listMyProducts, listMyOrders],
});
