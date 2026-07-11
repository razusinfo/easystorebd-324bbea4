import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Update the reseller's retail price for a marketplace product they have
// already added to their store. Locates the product copy via
// (store_id, source_reseller_product_id) and updates `products.price`.
// RLS on `products` restricts writes to the store owner, so this runs as
// the caller (no service role needed).
export const updateMyStorePriceForResellerProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      reseller_product_id: z.string().uuid(),
      price: z.number().nonnegative().max(10_000_000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .limit(1)
      .maybeSingle();
    if (storeErr) throw new Error(storeErr.message);
    if (!store) throw new Response("Forbidden: no store", { status: 403 });

    const { data: existing, error: findErr } = await supabase
      .from("products")
      .select("id, price")
      .eq("store_id", store.id)
      .eq("source_reseller_product_id", data.reseller_product_id)
      .limit(1)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!existing) throw new Response("Not added yet", { status: 404 });

    const { error: updErr } = await supabase
      .from("products")
      .update({ price: data.price, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, product_id: existing.id, price: data.price };
  });
