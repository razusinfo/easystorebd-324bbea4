import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isSuperAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) return false;
  return Boolean(data);
}

// ─── List sync logs (admins see all, store owners see own) ─────────────────
export const listStockSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        productId: z.string().uuid().optional().nullable(),
        storeId: z.string().uuid().optional().nullable(),
        changedOnly: z.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("product_stock_sync_logs")
      .select(
        "id, product_id, store_id, source_url, http_status, duration_ms, attempts, availability, previous_status, new_status, changed, error_message, triggered_by, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.productId) q = q.eq("product_id", data.productId);
    if (data.storeId) q = q.eq("store_id", data.storeId);
    if (data.changedOnly) q = q.eq("changed", true);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

// ─── Resync a single product ───────────────────────────────────────────────
export const resyncProductNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ productId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product, error } = await (supabaseAdmin as any)
      .from("products")
      .select("id, store_id, name, stock, is_out_of_stock, source_product_url")
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Response("Not found", { status: 404 });

    // Access: super admin OR store owner of this product's store
    const superAdmin = await isSuperAdmin(context.supabase, context.userId);
    if (!superAdmin) {
      const { data: store } = await (supabaseAdmin as any)
        .from("stores")
        .select("owner_user_id")
        .eq("id", product.store_id)
        .maybeSingle();
      if (!store || store.owner_user_id !== context.userId) {
        throw new Response("Forbidden", { status: 403 });
      }
    }

    if (!product.source_product_url) {
      throw new Response("This product has no source URL to sync.", { status: 400 });
    }

    const { syncOneProduct } = await import("@/lib/product-stock-sync.server");
    const result = await syncOneProduct(
      supabaseAdmin as never,
      product,
      superAdmin ? "manual" : "manual_store",
    );
    return { ok: true, ...result };
  });

// ─── Resync all products in a store ────────────────────────────────────────
export const resyncStoreNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ storeId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const superAdmin = await isSuperAdmin(context.supabase, context.userId);
    if (!superAdmin) {
      const { data: store } = await (supabaseAdmin as any)
        .from("stores")
        .select("owner_user_id")
        .eq("id", data.storeId)
        .maybeSingle();
      if (!store || store.owner_user_id !== context.userId) {
        throw new Response("Forbidden", { status: 403 });
      }
    }

    const { resyncSourceStockForAllProducts } = await import(
      "@/lib/product-stock-sync.server"
    );
    const result = await resyncSourceStockForAllProducts(supabaseAdmin as never, {
      storeId: data.storeId,
      triggeredBy: superAdmin ? "manual" : "manual_store",
    });
    return { ok: true, ...result };
  });

// ─── List stores (for admin filter dropdown) ───────────────────────────────
export const listStoresForStockSync = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const superAdmin = await isSuperAdmin(context.supabase, context.userId);
    if (!superAdmin) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("stores")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; name: string; slug: string | null }>;
  });
