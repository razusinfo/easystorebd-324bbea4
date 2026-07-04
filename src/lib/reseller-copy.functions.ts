import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runCopyResellerProduct } from "./reseller-copy-core";

// Copies a reseller marketplace product into the caller's own store's products.
// - Validates required fields server-side (name, price ≥ 0, quantity ≥ 0, category).
// - Dedupes by (store_id, name).
// - Writes an audit-log entry for every attempt.
// - Returns HTTP 403 when the caller has no store (reseller w/o shop) or is otherwise
//   not permitted to insert into a store they don't own.
export const copyResellerProductToMyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      reseller_product_id: z.string().uuid(),
      category_id: z.string().uuid().optional().nullable(),
      custom_price: z.number().nonnegative().optional().nullable(),
      selected_media: z.array(z.string().url()).max(50).optional().nullable(),
      note: z.string().max(500).optional().nullable(),
    }),

  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runCopyResellerProduct(
      {
        reseller_product_id: data.reseller_product_id,
        category_id: data.category_id ?? null,
        custom_price: data.custom_price ?? null,
      },
      {
        userSupabase: context.supabase as never,
        adminSupabase: supabaseAdmin as never,
        userId: context.userId,
      },
    );
  });
