// Pure core logic for product-request server functions.
// Split out from `product-requests.functions.ts` so the createServerFn wrappers
// stay thin and the business flow is unit-testable with a Supabase stub.

import type { ProductRequestInput } from "./product-requests.functions";
import { resolveApprovalStock } from "./product-approval-stock";

type MinimalClient = {
  from: (table: string) => any;
};

export type CoreCtx = {
  admin: MinimalClient;
  userId: string;
  actorRole: string;
  isAdmin: boolean;
};

type LogEntry = {
  actor_id: string;
  actor_role: string;
  action: string;
  product_id: string | null;
  success: boolean;
  error: string | null;
  metadata: Record<string, unknown>;
};

async function auditLog(admin: MinimalClient, entry: LogEntry) {
  await admin.from("reseller_marketplace_audit_logs").insert(entry);
}

export async function runSubmitProductRequest(
  input: ProductRequestInput,
  ctx: CoreCtx,
): Promise<{ ok: true; id: string }> {
  const { data: inserted, error } = await ctx.admin
    .from("product_requests")
    .insert({
      requested_by: ctx.userId,
      name: input.name,
      description: input.description,
      price: input.price,
      category: input.category,
      images: input.images,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    await auditLog(ctx.admin, {
      actor_id: ctx.userId,
      actor_role: ctx.actorRole,
      action: "submit_product_request",
      product_id: null,
      success: false,
      error: error?.message ?? "insert failed",
      metadata: {
        name: input.name,
        description: input.description,
        price: input.price,
        category: input.category,
        images: input.images,
      },
    });
    throw new Error(error?.message ?? "Failed to submit request");
  }

  await auditLog(ctx.admin, {
    actor_id: ctx.userId,
    actor_role: ctx.actorRole,
    action: "submit_product_request",
    product_id: inserted.id,
    success: true,
    error: null,
    metadata: {
      name: input.name,
      description: input.description,
      price: input.price,
      category: input.category,
      images: input.images,
      image_count: input.images.length,
    },
  });

  return { ok: true, id: inserted.id };
}

export type ApproveInput = {
  request_id: string;
  reseller_price: number;
  admin_notes?: string | null;
  stock?: number | null;
};

async function findRequesterSourceProductForApproval(
  admin: MinimalClient,
  requestedBy: string,
  requestedName: string,
): Promise<{ id: string; stock: number | null } | null> {
  const { data: stores } = await admin.from("stores").select("id").eq("owner_user_id", requestedBy);
  const storeIds = ((stores ?? []) as Array<{ id: string }>).map((s) => s.id).filter(Boolean);
  if (storeIds.length === 0) return null;

  const { data: product } = await admin
    .from("products")
    .select("id, stock")
    .in("store_id", storeIds)
    .eq("name", requestedName.trim())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return product ?? null;
}

export async function runApproveProductRequest(
  input: ApproveInput,
  ctx: CoreCtx,
): Promise<{ ok: true; reseller_product_id: string } | { forbidden: true }> {
  if (!ctx.isAdmin) {
    await auditLog(ctx.admin, {
      actor_id: ctx.userId,
      actor_role: ctx.actorRole,
      action: "approve_product_request",
      product_id: input.request_id,
      success: false,
      error: "forbidden",
      metadata: { reseller_price: input.reseller_price },
    });
    return { forbidden: true };
  }

  const { data: req } = await ctx.admin
    .from("product_requests")
    .select("id, requested_by, name, description, price, images, status")
    .eq("id", input.request_id)
    .maybeSingle();
  if (!req) throw new Error("Not found");
  if (req.status !== "pending") throw new Error(`Already ${req.status}`);

  const images: string[] = req.images ?? [];
  const primary = images[0] ?? null;
  const sourceProduct = await findRequesterSourceProductForApproval(ctx.admin, req.requested_by, req.name);
  const stockResolution = resolveApprovalStock({
    adminStock: input.stock,
    sourceProductId: sourceProduct?.id ?? null,
    sourceStock: sourceProduct?.stock ?? null,
  });

  const { data: inserted } = await ctx.admin
    .from("reseller_products")
    .insert({
      external_id: `req-${req.id}`,
      original_product_id: sourceProduct?.id ?? null,
      name: req.name,
      description: req.description,
      image: primary,
      image_url: primary,
      price: req.price,
      reseller_price: input.reseller_price,
      stock: stockResolution.finalStock,
      source: "request",
    })
    .select("id")
    .single();

  await ctx.admin
    .from("product_requests")
    .update({
      status: "approved",
      reseller_price: input.reseller_price,
      admin_notes: input.admin_notes ?? null,
      reviewed_by: ctx.userId,
      published_reseller_product_id: inserted.id,
    })
    .eq("id", req.id);

  await auditLog(ctx.admin, {
    actor_id: ctx.userId,
    actor_role: ctx.actorRole,
    action: "approve_product_request",
    product_id: req.id,
    success: true,
    error: null,
    metadata: {
      requested_by: req.requested_by,
      approver: ctx.userId,
      name: req.name,
      description: req.description,
      base_price: req.price,
      reseller_price: input.reseller_price,
      admin_notes: input.admin_notes ?? null,
      images,
      image_count: images.length,
      published_reseller_product_id: inserted.id,
      previous_stock: null,
      requested_stock: stockResolution.requestedStock,
      source_product_id: stockResolution.sourceProductId,
      source_product_stock: stockResolution.sourceStock,
      new_stock: stockResolution.finalStock,
    },
  });

  return { ok: true, reseller_product_id: inserted.id };
}

export async function runRejectProductRequest(
  input: { request_id: string; admin_notes?: string | null },
  ctx: CoreCtx,
): Promise<{ ok: true } | { forbidden: true }> {
  if (!ctx.isAdmin) {
    await auditLog(ctx.admin, {
      actor_id: ctx.userId,
      actor_role: ctx.actorRole,
      action: "reject_product_request",
      product_id: input.request_id,
      success: false,
      error: "forbidden",
      metadata: {},
    });
    return { forbidden: true };
  }

  const { data: req } = await ctx.admin
    .from("product_requests")
    .select("id, requested_by, name, status")
    .eq("id", input.request_id)
    .maybeSingle();
  if (!req) throw new Error("Not found");
  if (req.status !== "pending") throw new Error(`Already ${req.status}`);

  await ctx.admin
    .from("product_requests")
    .update({
      status: "rejected",
      admin_notes: input.admin_notes ?? null,
      reviewed_by: ctx.userId,
    })
    .eq("id", input.request_id);

  await auditLog(ctx.admin, {
    actor_id: ctx.userId,
    actor_role: ctx.actorRole,
    action: "reject_product_request",
    product_id: req.id,
    success: true,
    error: null,
    metadata: {
      requested_by: req.requested_by,
      approver: ctx.userId,
      name: req.name,
      admin_notes: input.admin_notes ?? null,
    },
  });

  return { ok: true };
}
