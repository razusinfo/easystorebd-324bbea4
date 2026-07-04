import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Shared validation schemas (also exported for use in the UI and tests).
export const IMAGE_URL_RE = /^https?:\/\/.+/i;
export const MAX_IMAGES = 8;

export const productRequestInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name too long"),
  description: z
    .string()
    .trim()
    .max(2000, "Description too long")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  price: z
    .number()
    .nonnegative("Price cannot be negative")
    .max(10_000_000, "Price too large")
    .refine((n) => Number.isFinite(n), "Price must be a number"),
  images: z
    .array(z.string().regex(IMAGE_URL_RE, "Invalid image URL"))
    .max(MAX_IMAGES, `At most ${MAX_IMAGES} images`)
    .default([]),
});

export type ProductRequestInput = z.infer<typeof productRequestInputSchema>;

async function resolveActorRole(userSupabase: {
  from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: { role: string }[] | null }> } };
}, userId: string) {
  const { data } = await userSupabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("super_admin")) return { role: "super_admin", isAdmin: true, roles };
  return { role: roles[0] ?? "reseller", isAdmin: false, roles };
}

// Reseller: submit a new product request. Writes to `product_requests` and a
// full audit-log entry capturing every submitted field.
export const submitProductRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => productRequestInputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: actorRole } = await resolveActorRole(context.supabase as never, context.userId);

    const logAttempt = async (
      success: boolean,
      productId: string | null,
      metadata: Record<string, unknown>,
      error?: string,
    ) => {
      await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
        actor_id: context.userId,
        actor_role: actorRole,
        action: "submit_product_request",
        product_id: productId,
        success,
        error: error ?? null,
        metadata,
      });
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("product_requests")
      .insert({
        requested_by: context.userId,
        name: data.name,
        description: data.description,
        price: data.price,
        images: data.images,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      await logAttempt(false, null, {
        name: data.name,
        description: data.description,
        price: data.price,
        images: data.images,
      }, error?.message ?? "insert failed");
      throw new Error(error?.message ?? "Failed to submit request");
    }

    await logAttempt(true, inserted.id, {
      name: data.name,
      description: data.description,
      price: data.price,
      images: data.images,
      image_count: data.images.length,
    });

    return { ok: true as const, id: inserted.id };
  });

// Super-admin: approve a pending product request and publish it into the
// shared `reseller_products` marketplace list. Writes full audit metadata.
export const approveProductRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      request_id: z.string().uuid(),
      reseller_price: z.number().nonnegative().max(10_000_000),
      admin_notes: z.string().max(1000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: actorRole, isAdmin } = await resolveActorRole(context.supabase as never, context.userId);

    const logAttempt = async (
      success: boolean,
      productId: string | null,
      metadata: Record<string, unknown>,
      error?: string,
    ) => {
      await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
        actor_id: context.userId,
        actor_role: actorRole,
        action: "approve_product_request",
        product_id: productId,
        success,
        error: error ?? null,
        metadata,
      });
    };

    if (!isAdmin) {
      await logAttempt(false, data.request_id, { reseller_price: data.reseller_price }, "forbidden");
      throw new Response("Forbidden: super_admin only", { status: 403 });
    }

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, requested_by, name, description, price, images, status")
      .eq("id", data.request_id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Response("Not found", { status: 404 });
    if (req.status !== "pending") {
      await logAttempt(false, req.id, { status: req.status }, `already ${req.status}`);
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
    if (insErr || !inserted) {
      await logAttempt(false, req.id, { reseller_price: data.reseller_price }, insErr?.message ?? "publish failed");
      throw new Error(insErr?.message ?? "Failed to publish");
    }

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

    await logAttempt(true, req.id, {
      requested_by: req.requested_by,
      approver: context.userId,
      name: req.name,
      description: req.description,
      base_price: req.price,
      reseller_price: data.reseller_price,
      admin_notes: data.admin_notes ?? null,
      images,
      image_count: images.length,
      published_reseller_product_id: inserted.id,
    });

    return { ok: true as const, reseller_product_id: inserted.id };
  });

// Super-admin: reject a pending request with an admin note.
export const rejectProductRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      request_id: z.string().uuid(),
      admin_notes: z.string().max(1000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: actorRole, isAdmin } = await resolveActorRole(context.supabase as never, context.userId);

    const logAttempt = async (success: boolean, metadata: Record<string, unknown>, error?: string) => {
      await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
        actor_id: context.userId,
        actor_role: actorRole,
        action: "reject_product_request",
        product_id: data.request_id,
        success,
        error: error ?? null,
        metadata,
      });
    };

    if (!isAdmin) {
      await logAttempt(false, {}, "forbidden");
      throw new Response("Forbidden: super_admin only", { status: 403 });
    }

    const { data: req, error: readErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, requested_by, name, status")
      .eq("id", data.request_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!req) throw new Response("Not found", { status: 404 });
    if (req.status !== "pending") {
      await logAttempt(false, { status: req.status }, `already ${req.status}`);
      throw new Response(`Already ${req.status}`, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("product_requests")
      .update({
        status: "rejected",
        admin_notes: data.admin_notes ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.request_id);
    if (error) throw new Error(error.message);

    await logAttempt(true, {
      requested_by: req.requested_by,
      approver: context.userId,
      name: req.name,
      admin_notes: data.admin_notes ?? null,
    });

    return { ok: true as const };
  });
