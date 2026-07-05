import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userSupabase: {
  from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: { role: string }[] | null }> } };
}, userId: string) {
  const { data } = await userSupabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("super_admin")) {
    throw new Response("Forbidden: super_admin only", { status: 403 });
  }
}

export const getMarketplaceStockReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildReconciliationReport } = await import("./marketplace-stock-reconciliation.server");
    return buildReconciliationReport(supabaseAdmin as never);
  });

export const runResyncMarketplaceStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resyncApprovedMarketplaceStock } = await import("./marketplace-stock-reconciliation.server");
    return resyncApprovedMarketplaceStock(supabaseAdmin as never, {
      id: context.userId,
      role: "super_admin",
    });
  });
