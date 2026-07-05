import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_products",
  title: "List my products",
  description: "List products in the signed-in store owner's EazyStore store.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Max products to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: store, error: storeErr } = await sb
      .from("stores")
      .select("id, name")
      .eq("owner_user_id", ctx.getUserId())
      .maybeSingle();
    if (storeErr)
      return { content: [{ type: "text", text: storeErr.message }], isError: true };
    if (!store)
      return { content: [{ type: "text", text: "No store found for this user." }] };
    const { data, error } = await sb
      .from("products")
      .select("id, name, price, stock, status, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ store: store.name, products: data }, null, 2) }],
      structuredContent: { store, products: data },
    };
  },
});
