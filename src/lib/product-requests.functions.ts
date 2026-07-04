import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Super-admin: approve a pending product request and publish it into the
// shared `reseller_products` marketplace list.
export const approveProductRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      request_id: z.string().uuid(),
      reseller_price: z.number().nonnegative(),
      admin_notes: z.string().max(1000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is super_admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) {
      throw new Response("Forbidden: super_admin only", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, name, description, price, images, status")
      .eq("id", data.request_id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Response("Not found", { status: 404 });
    if (req.status !== "pending") {
      throw new Response(`Already ${req.status}`, { status: 400 });
    }

    const images = (req.images as string[] | null) ?? [];
    const primaryImage = images[0] ?? null;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("reseller_products")
      .insert({
        external_id: `req-${req.id}`,
        name: req.name,
        description: req.description,
        image: primaryImage,
        image_url: primaryImage,
        price: req.price,
        reseller_price: data.reseller_price,
        source: "request",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("product_requests")
      .update({
        status: "approved",
        reseller_price: data.reseller_price,
        admin_notes: data.admin_notes ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        published_reseller_product_id: inserted.id,
      })
      .eq("id", req.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true as const, reseller_product_id: inserted.id };
  });
