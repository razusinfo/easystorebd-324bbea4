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
  name: "list_my_orders",
  title: "List my orders",
  description: "List recent orders for the signed-in user's EazyStore store.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Max orders to return."),
    status: z
      .string()
      .optional()
      .describe("Optional status filter (e.g. pending, confirmed, shipped, delivered, cancelled)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: store } = await sb
      .from("stores")
      .select("id")
      .eq("owner_user_id", ctx.getUserId())
      .maybeSingle();
    if (!store) return { content: [{ type: "text", text: "No store found for this user." }] };
    let q = sb
      .from("orders")
      .select("id, customer_name, customer_phone, total, status, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { orders: data },
    };
  },
});
