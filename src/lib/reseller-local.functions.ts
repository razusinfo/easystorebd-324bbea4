import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Upserts a product into our local `reseller_products` table (used to power the
// in-app Reseller Products page). Runs with the service-role admin client so
// it bypasses RLS after the caller is confirmed authenticated as super_admin.
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
      stock: z.number().int().nonnegative().max(1_000_000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve highest role for audit trail
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const heldRoles = (roles ?? []).map((r: { role: string }) => r.role);
    const isAdmin = heldRoles.includes("super_admin");
    const actorRole = isAdmin ? "super_admin" : (heldRoles[0] ?? "unknown");

    const logAttempt = async (success: boolean, error?: string) => {
      await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
        actor_id: context.userId,
        actor_role: actorRole,
        action: "upsert_local_reseller_product",
        product_id: data.id,
        success,
        error: error ?? null,
      });
    };

    if (!isAdmin) {
      await logAttempt(false, "forbidden");
      throw new Response("Forbidden: super_admin only", { status: 403 });
    }

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
          // Seed a positive stock so the marketplace card doesn't render as
          // "Out of Stock" the moment the admin pushes it live.
          stock: data.stock ?? 100,
          source: "internal",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "external_id" },
      );
    if (error) {
      await logAttempt(false, error.message);
      throw new Error(error.message);
    }
    await logAttempt(true);
    return { ok: true as const };
  });
