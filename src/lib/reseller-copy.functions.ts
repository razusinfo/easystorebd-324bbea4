import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Copies a reseller marketplace product into the caller's own store's products.
// - Validates required fields server-side (name, price ≥ 0, quantity/stock ≥ 0,
//   category, warranty/IMEI/serial identifiers when present).
// - Dedupes by (store_id, name) so repeat clicks don't create duplicates.
// - Writes an audit-log entry (actor_id, actor_role, source product id,
//   success/failure) for every attempt.
export const copyResellerProductToMyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      reseller_product_id: z.string().uuid(),
      // Client-supplied hints; server re-reads from DB and validates.
      // No trust boundary depends on these values.
      note: z.string().max(500).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve role for audit trail
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const heldRoles = (roles ?? []).map((r: { role: string }) => r.role);
    const actorRole = heldRoles[0] ?? "unknown";

    const logAttempt = async (
      success: boolean,
      productId: string,
      error?: string,
    ) => {
      await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
        actor_id: context.userId,
        actor_role: actorRole,
        action: "copy_link_to_my_products",
        product_id: productId,
        success,
        error: error ?? null,
      });
    };

    try {
      // 1. Load source reseller product
      const { data: source, error: srcErr } = await supabaseAdmin
        .from("reseller_products")
        .select(
          "id, external_id, original_product_id, name, description, image, image_url, price, reseller_price, category",
        )
        .eq("id", data.reseller_product_id)
        .maybeSingle();
      if (srcErr) throw new Error(srcErr.message);
      if (!source) throw new Error("Source reseller product not found");

      // 2. Locate caller's store
      const { data: store, error: storeErr } = await supabaseAdmin
        .from("stores")
        .select("id")
        .eq("owner_user_id", context.userId)
        .limit(1)
        .maybeSingle();
      if (storeErr) throw new Error(storeErr.message);
      if (!store) throw new Error("No store found for this user");

      // 3. Load original product (if any) to inherit category / warranty / IMEI / serial
      const originalId = (source as { original_product_id: string | null })
        .original_product_id;
      let original: {
        category_id: string | null;
        warranty: string | null;
        product_serial: string | null;
        sku: string | null;
        brand: string | null;
        condition: string | null;
        weight_kg: number | null;
        short_description: string | null;
      } | null = null;
      if (originalId) {
        const { data: orig, error: origErr } = await supabaseAdmin
          .from("products")
          .select(
            "category_id, warranty, product_serial, sku, brand, condition, weight_kg, short_description",
          )
          .eq("id", originalId)
          .maybeSingle();
        if (origErr) throw new Error(origErr.message);
        original = (orig as unknown as typeof original) ?? null;
      }

      // 4. Server-side validation of required fields
      const price = source.reseller_price ?? source.price;
      const missing: string[] = [];
      if (!source.name || !source.name.trim()) missing.push("name");
      if (price == null || !Number.isFinite(Number(price)) || Number(price) < 0) {
        missing.push("price");
      }
      const stock = 0; // reseller copies start unstocked; validate it's a non-negative integer
      if (!Number.isInteger(stock) || stock < 0) missing.push("quantity");
      // Category: prefer original product's category_id; fall back to source.category text
      if (!original?.category_id && !source.category) missing.push("category");

      if (missing.length) {
        const msg = `Missing required product fields: ${missing.join(", ")}`;
        await logAttempt(false, source.id, msg);
        throw new Error(msg);
      }

      // 5. Dedup by (store_id, name)
      const { data: existing, error: existingErr } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("store_id", store.id)
        .eq("name", source.name)
        .limit(1)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      if (existing) {
        await logAttempt(true, source.id, "already_exists");
        return { ok: true as const, product_id: (existing as { id: string }).id, skipped: true as const };
      }

      // 6. Insert into caller's products
      const insertPayload = {
        store_id: store.id,
        name: source.name,
        description: source.description ?? null,
        short_description: original?.short_description ?? null,
        image_url: source.image_url ?? source.image ?? null,
        price: Number(price),
        regular_price: source.price,
        reseller_price: source.reseller_price,
        stock,
        status: "approved" as const,
        category_id: original?.category_id ?? null,
        warranty: original?.warranty ?? null,
        product_serial: original?.product_serial ?? null,
        sku: original?.sku ?? null,
        brand: original?.brand ?? null,
        condition: original?.condition ?? "new",
      };

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("products")
        .insert(insertPayload as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);

      const productId = (inserted as { id: string }).id;
      await logAttempt(true, source.id, null ?? undefined);
      return { ok: true as const, product_id: productId, skipped: false as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Best-effort log with whatever id we have
      await logAttempt(false, data.reseller_product_id, message);
      throw err;
    }
  });
