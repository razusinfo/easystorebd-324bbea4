import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Upserts a product into our local `reseller_products` table (used to power the
// in-app Reseller Products page). Runs with the service-role admin client so
// it bypasses RLS after the caller is confirmed authenticated.
export const upsertLocalResellerProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      image_url: z.string().nullable().optional(),
      price: z.number(),
      reseller_price: z.number().nullable().optional(),
      category: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reseller_products")
      .upsert(
        {
          external_id: data.id,
          original_product_id: data.id,
          name: data.name,
          description: data.description ?? null,
          image: data.image_url ?? null,
          image_url: data.image_url ?? null,
          price: data.price,
          reseller_price: data.reseller_price ?? null,
          category: data.category ?? null,
          source: "internal",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "external_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
