import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveApprovalStock } from "./product-approval-stock";

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
  category: z
    .string()
    .trim()
    .max(120, "Category too long")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  images: z
    .array(z.string().regex(IMAGE_URL_RE, "Invalid image URL"))
    .max(MAX_IMAGES, `At most ${MAX_IMAGES} images`)
    .default([]),
});

export type ProductRequestInput = z.infer<typeof productRequestInputSchema>;

// Reseller: update their OWN pending request. Blocked once reviewed.
export const updateProductRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    productRequestInputSchema.extend({ id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, requested_by, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Response("Not found", { status: 404 });
    if (existing.requested_by !== context.userId) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (existing.status !== "pending") {
      throw new Response(`Cannot edit a ${existing.status} request`, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("product_requests")
      .update({
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        images: data.images,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
      actor_id: context.userId,
      actor_role: "reseller",
      action: "update_product_request",
      product_id: data.id,
      success: true,
      error: null,
      metadata: {
        name: data.name,
        price: data.price,
        category: data.category,
        image_count: data.images.length,
      } as never,
    });
    return { ok: true as const };
  });

// Reseller: delete their OWN pending request.
export const deleteProductRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, requested_by, status, name")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Response("Not found", { status: 404 });
    if (existing.requested_by !== context.userId) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (existing.status !== "pending") {
      throw new Response(`Cannot delete a ${existing.status} request`, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("product_requests")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
      actor_id: context.userId,
      actor_role: "reseller",
      action: "delete_product_request",
      product_id: data.id,
      success: true,
      error: null,
      metadata: { name: existing.name } as never,
    });
    return { ok: true as const };
  });


async function resolveActorRole(userSupabase: {
  from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: { role: string }[] | null }> } };
}, userId: string) {
  const { data } = await userSupabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("super_admin")) return { role: "super_admin", isAdmin: true, roles };
  return { role: roles[0] ?? "reseller", isAdmin: false, roles };
}

type SourceProductForApproval = {
  id: string;
  stock: number | null;
  name: string | null;
  store_id: string | null;
};

async function findRequesterSourceProductForApproval(
  supabaseAdmin: {
    from: (table: string) => any;
  },
  requestedBy: string,
  requestedName: string,
): Promise<SourceProductForApproval | null> {
  const { data: stores, error: storeErr } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("owner_user_id", requestedBy);
  if (storeErr) throw new Error(storeErr.message);

  const storeIds = ((stores ?? []) as Array<{ id: string }>).map((s) => s.id).filter(Boolean);
  if (storeIds.length === 0) return null;

  const normalizedName = requestedName.trim();
  if (!normalizedName) return null;

  const { data: exact, error: exactErr } = await supabaseAdmin
    .from("products")
    .select("id, stock, name, store_id")
    .in("store_id", storeIds)
    .eq("name", normalizedName)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exactErr) throw new Error(exactErr.message);
  if (exact) return exact as SourceProductForApproval;

  const { data: ciMatch, error: ciErr } = await supabaseAdmin
    .from("products")
    .select("id, stock, name, store_id")
    .in("store_id", storeIds)
    .ilike("name", normalizedName)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ciErr) throw new Error(ciErr.message);

  return (ciMatch as SourceProductForApproval | null) ?? null;
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
        metadata: metadata as never,
      });
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("product_requests")
      .insert({
        requested_by: context.userId,
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        images: data.images,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      await logAttempt(false, null, {
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        images: data.images,
      }, error?.message ?? "insert failed");
      throw new Error(error?.message ?? "Failed to submit request");
    }

    await logAttempt(true, inserted.id, {
      name: data.name,
      description: data.description,
      price: data.price,
      category: data.category,
      images: data.images,
      image_count: data.images.length,
    });

    // Fire-and-forget: in-app bell + admin emails.
    try {
      const { notifyRequestSubmitted } = await import("./product-request-emails.server");
      await notifyRequestSubmitted(supabaseAdmin as never, {
        request_id: inserted.id,
        reseller_id: context.userId,
        name: data.name,
        price: data.price,
      });
    } catch (e) {
      console.warn("[product-request notify submitted]", (e as Error).message);
    }

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
      category: z.string().trim().max(120).optional().nullable().transform((v) => (v && v.length > 0 ? v : null)),
      stock: z.number().int().nonnegative().max(1_000_000).optional().default(100),
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
        metadata: metadata as never,
      });
    };

    if (!isAdmin) {
      await logAttempt(false, data.request_id, { reseller_price: data.reseller_price }, "forbidden");
      throw new Response("Forbidden: super_admin only", { status: 403 });
    }

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, requested_by, name, description, price, images, status, category")
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
    const finalCategory = data.category ?? (req as any).category ?? null;
    const sourceProduct = await findRequesterSourceProductForApproval(
      supabaseAdmin as never,
      req.requested_by,
      req.name,
    );
    const stockResolution = resolveApprovalStock({
      adminStock: data.stock,
      sourceProductId: sourceProduct?.id ?? null,
      sourceStock: sourceProduct?.stock ?? null,
    });

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("reseller_products")
      .insert({
        external_id: `req-${req.id}`,
        original_product_id: sourceProduct?.id ?? null,
        name: req.name,
        description: req.description,
        image: primaryImage,
        image_url: primaryImage,
        price: req.price,
        reseller_price: data.reseller_price,
        category: finalCategory,
        stock: stockResolution.finalStock,
        source: "request",
      })
      .select("id, stock")
      .single();
    if (insErr || !inserted) {
      await logAttempt(false, req.id, {
        reseller_price: data.reseller_price,
        requested_stock: stockResolution.requestedStock,
        source_product_id: stockResolution.sourceProductId,
        source_product_stock: stockResolution.sourceStock,
        intended_stock: stockResolution.finalStock,
      }, insErr?.message ?? "publish failed");
      throw new Error(insErr?.message ?? "Failed to publish");
    }

    const { data: stockCheck, error: stockCheckErr } = await supabaseAdmin
      .from("reseller_products")
      .select("id, stock")
      .eq("id", inserted.id)
      .maybeSingle();
    if (stockCheckErr) throw new Error(stockCheckErr.message);
    if (!stockCheck || Number(stockCheck.stock ?? 0) !== stockResolution.finalStock) {
      await logAttempt(false, req.id, {
        reseller_price: data.reseller_price,
        requested_stock: stockResolution.requestedStock,
        source_product_id: stockResolution.sourceProductId,
        source_product_stock: stockResolution.sourceStock,
        intended_stock: stockResolution.finalStock,
        actual_stock: stockCheck?.stock ?? null,
      }, "stock consistency check failed");
      throw new Error("Stock consistency check failed after approval");
    }

    const { error: updErr } = await supabaseAdmin
      .from("product_requests")
      .update({
        status: "approved",
        reseller_price: data.reseller_price,
        admin_notes: data.admin_notes ?? null,
        category: finalCategory,
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
      category: finalCategory,
      images,
      image_count: images.length,
      published_reseller_product_id: inserted.id,
      previous_stock: null,
      requested_stock: stockResolution.requestedStock,
      source_product_id: stockResolution.sourceProductId,
      source_product_stock: stockResolution.sourceStock,
      new_stock: stockResolution.finalStock,
    });


    // Fire-and-forget success email + in-app notification to the reseller.
    try {
      const { notifyRequestApproved } = await import("./product-request-emails.server");
      await notifyRequestApproved(supabaseAdmin as never, {
        request_id: req.id,
        reseller_id: req.requested_by,
        name: req.name,
        reseller_price: data.reseller_price,
      });
    } catch (e) {
      console.warn("[product-request notify approved]", (e as Error).message);
    }
    try {
      await supabaseAdmin.from("user_notifications").insert({
        user_id: req.requested_by,
        type: "product_request_approved",
        title: "Your product request was approved",
        body: `"${req.name}" is now live in the marketplace at ৳${data.reseller_price}.`,
        link: `/reseller-products?highlight=${inserted.id}`,
        related_id: req.id,
      });
    } catch (e) {
      console.warn("[product-request in-app approved]", (e as Error).message);
    }

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
        metadata: metadata as never,
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

    // In-app notification to the reseller with a deep link back to their request.
    try {
      await supabaseAdmin.from("user_notifications").insert({
        user_id: req.requested_by,
        type: "product_request_rejected",
        title: "Your product request was rejected",
        body: data.admin_notes
          ? `"${req.name}": ${data.admin_notes}`
          : `"${req.name}" was not approved.`,
        link: `/reseller-requests?request=${req.id}`,
        related_id: req.id,
      });
    } catch (e) {
      console.warn("[product-request in-app rejected]", (e as Error).message);
    }

    return { ok: true as const };
  });

// Super-admin: edit a pending product request on behalf of the reseller.
export const adminUpdateProductRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    productRequestInputSchema.extend({ id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isAdmin, role: actorRole } = await resolveActorRole(context.supabase as never, context.userId);
    if (!isAdmin) throw new Response("Forbidden: super_admin only", { status: 403 });

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Response("Not found", { status: 404 });
    if (existing.status !== "pending") {
      throw new Response(`Cannot edit a ${existing.status} request`, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("product_requests")
      .update({
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        images: data.images,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
      actor_id: context.userId,
      actor_role: actorRole,
      action: "admin_update_product_request",
      product_id: data.id,
      success: true,
      error: null,
      metadata: {
        name: data.name,
        price: data.price,
        category: data.category,
        image_count: data.images.length,
      } as never,
    });
    return { ok: true as const };
  });

// Super-admin: one-click repair for approved reseller products stuck at stock 0.
// Backfills reseller_products.stock to a safe default and records prev/new stock
// in the audit log per row.
export const adminRepairApprovedStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({
      default_stock: z.number().int().positive().max(1_000_000).optional().default(100),
    }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: actorRole, isAdmin } = await resolveActorRole(context.supabase as never, context.userId);
    if (!isAdmin) throw new Response("Forbidden: super_admin only", { status: 403 });

    // Find approved requests whose published reseller_products row has stock <= 0.
    const { data: reqs, error: reqErr } = await supabaseAdmin
      .from("product_requests")
      .select("id, requested_by, name, published_reseller_product_id")
      .eq("status", "approved")
      .not("published_reseller_product_id", "is", null);
    if (reqErr) throw new Error(reqErr.message);

    const ids = (reqs ?? []).map((r) => r.published_reseller_product_id as string);
    if (ids.length === 0) return { ok: true as const, repaired: 0, checked: 0 };

    const { data: rps, error: rpErr } = await supabaseAdmin
      .from("reseller_products")
      .select("id, stock, name")
      .in("id", ids);
    if (rpErr) throw new Error(rpErr.message);

    const requestByProductId = new Map(
      (reqs ?? []).map((r) => [r.published_reseller_product_id as string, r]),
    );
    const stuck = (rps ?? []).filter((r) => (r.stock ?? 0) <= 0);
    let repaired = 0;
    for (const row of stuck) {
      const prev = row.stock ?? 0;
      const req = requestByProductId.get(row.id);
      const sourceProduct = req
        ? await findRequesterSourceProductForApproval(
          supabaseAdmin as never,
          req.requested_by as string,
          req.name as string,
        )
        : null;
      const stockResolution = resolveApprovalStock({
        adminStock: data.default_stock,
        sourceProductId: sourceProduct?.id ?? null,
        sourceStock: sourceProduct?.stock ?? null,
        fallbackStock: data.default_stock,
      });
      if (stockResolution.finalStock <= 0) continue;
      const { error: uErr } = await supabaseAdmin
        .from("reseller_products")
        .update({
          stock: stockResolution.finalStock,
          original_product_id: stockResolution.sourceProductId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (uErr) {
        console.warn("[repair-approved-stock]", row.id, uErr.message);
        continue;
      }
      repaired++;
      await supabaseAdmin.from("reseller_marketplace_audit_logs").insert({
        actor_id: context.userId,
        actor_role: actorRole,
        action: "repair_approved_stock",
        product_id: row.id,
        success: true,
        error: null,
        metadata: {
          name: row.name,
          previous_stock: prev,
          requested_stock: stockResolution.requestedStock,
          source_product_id: stockResolution.sourceProductId,
          source_product_stock: stockResolution.sourceStock,
          new_stock: stockResolution.finalStock,
        } as never,
      });
    }
    return { ok: true as const, repaired, checked: rps?.length ?? 0 };
  });


