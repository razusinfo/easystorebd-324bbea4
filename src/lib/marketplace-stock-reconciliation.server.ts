// Server-only core for the marketplace approval stock reconciliation report
// and the automated resync job. Compares each approved product_request's
// published reseller_products.stock against the requester store's source
// product stock and flags/repairs mismatches.
//
// Callable from:
//   - src/lib/marketplace-stock-reconciliation.functions.ts (super_admin UI)
//   - src/routes/api/public/hooks/resync-marketplace-stock.ts (pg_cron job)

import { getLowStockThreshold } from "./stock-sync-core";

export type ReconciliationRow = {
  request_id: string;
  reseller_product_id: string;
  name: string;
  requested_by: string;
  reseller_stock: number;
  source_product_id: string | null;
  source_stock: number | null;
  status: "match" | "mismatch" | "no_source" | "stuck_out_of_stock";
  mismatch: boolean;
};

export type ReconciliationReport = {
  generated_at: string;
  low_stock_threshold: number;
  checked: number;
  mismatches: number;
  rows: ReconciliationRow[];
};

// Minimal shape we need from Supabase-admin-like clients. Left loose so the
// pg_cron caller and the tests can pass in either the real admin client or a
// harness client without extra typing gymnastics.
type Admin = {
  from: (t: string) => any;
};

async function loadRequester(admin: Admin, requestedBy: string, requestedName: string) {
  const { data: stores, error: storesErr } = await admin
    .from("stores")
    .select("id")
    .eq("owner_user_id", requestedBy);
  if (storesErr) throw new Error(storesErr.message);
  const storeIds = ((stores ?? []) as Array<{ id: string }>).map((s) => s.id).filter(Boolean);
  if (storeIds.length === 0) return null;

  const name = (requestedName ?? "").trim();
  if (!name) return null;

  const { data: exact, error: exactErr } = await admin
    .from("products")
    .select("id, stock, name, store_id")
    .in("store_id", storeIds)
    .eq("name", name)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exactErr) throw new Error(exactErr.message);
  if (exact) return exact as { id: string; stock: number | null };

  const { data: ci, error: ciErr } = await admin
    .from("products")
    .select("id, stock, name, store_id")
    .in("store_id", storeIds)
    .ilike("name", name)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ciErr) throw new Error(ciErr.message);
  return (ci as { id: string; stock: number | null } | null) ?? null;
}

export function classifyRow(
  resellerStock: number,
  sourceStock: number | null,
  threshold = getLowStockThreshold(),
): ReconciliationRow["status"] {
  if (sourceStock == null) {
    return resellerStock <= threshold ? "stuck_out_of_stock" : "no_source";
  }
  if (resellerStock === sourceStock) return "match";
  // Only flag as a display-affecting mismatch when the reseller side reads as
  // out-of-stock in the marketplace but the source still has stock, or when
  // the numeric values diverge non-trivially.
  return "mismatch";
}

/** Pure helper — never render "Out of Stock" when source stock exists. */
export function shouldRenderOutOfStock(
  resellerStock: number,
  sourceStock: number | null,
  threshold = getLowStockThreshold(),
): boolean {
  const effective = sourceStock != null ? Math.max(resellerStock, sourceStock) : resellerStock;
  return effective <= threshold;
}

export async function buildReconciliationReport(admin: Admin): Promise<ReconciliationReport> {
  const threshold = getLowStockThreshold();
  const { data: reqs, error: reqErr } = await admin
    .from("product_requests")
    .select("id, requested_by, name, published_reseller_product_id")
    .eq("status", "approved")
    .not("published_reseller_product_id", "is", null);
  if (reqErr) throw new Error(reqErr.message);

  const ids = ((reqs ?? []) as Array<{ published_reseller_product_id: string }>)
    .map((r) => r.published_reseller_product_id)
    .filter(Boolean);
  if (ids.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      low_stock_threshold: threshold,
      checked: 0,
      mismatches: 0,
      rows: [],
    };
  }

  const { data: rps, error: rpErr } = await admin
    .from("reseller_products")
    .select("id, stock, name")
    .in("id", ids);
  if (rpErr) throw new Error(rpErr.message);

  const rpMap = new Map<string, { id: string; stock: number | null; name: string }>();
  for (const r of (rps ?? []) as Array<{ id: string; stock: number | null; name: string }>) {
    rpMap.set(r.id, r);
  }

  const rows: ReconciliationRow[] = [];
  for (const req of (reqs ?? []) as Array<{
    id: string;
    requested_by: string;
    name: string;
    published_reseller_product_id: string;
  }>) {
    const rp = rpMap.get(req.published_reseller_product_id);
    if (!rp) continue;
    const source = await loadRequester(admin, req.requested_by, req.name);
    const resellerStock = Number(rp.stock ?? 0);
    const sourceStock = source ? Number(source.stock ?? 0) : null;
    const status = classifyRow(resellerStock, sourceStock, threshold);
    rows.push({
      request_id: req.id,
      reseller_product_id: rp.id,
      name: rp.name ?? req.name,
      requested_by: req.requested_by,
      reseller_stock: resellerStock,
      source_product_id: source?.id ?? null,
      source_stock: sourceStock,
      status,
      mismatch: status === "mismatch" || status === "stuck_out_of_stock",
    });
  }

  const mismatches = rows.filter((r) => r.mismatch).length;
  return {
    generated_at: new Date().toISOString(),
    low_stock_threshold: threshold,
    checked: rows.length,
    mismatches,
    rows,
  };
}

export type ResyncResult = {
  checked: number;
  updated: number;
  discrepancies: number;
  changes: Array<{
    reseller_product_id: string;
    previous_stock: number;
    new_stock: number;
    source_stock: number | null;
  }>;
};

/**
 * Recompute each approved reseller_products.stock from its requester's source
 * product stock. Rows that already match are skipped. Every change is logged
 * to `reseller_marketplace_audit_logs` with previous/new stock. Discrepancies
 * that could not be repaired (e.g. missing source) are logged too.
 */
export async function resyncApprovedMarketplaceStock(
  admin: Admin,
  actor: { id: string | null; role: string },
): Promise<ResyncResult> {
  const report = await buildReconciliationReport(admin);
  const changes: ResyncResult["changes"] = [];
  let updated = 0;
  let discrepancies = 0;

  for (const row of report.rows) {
    if (!row.mismatch) continue;
    discrepancies++;

    // Cannot repair without a known source stock — log the discrepancy only.
    if (row.source_stock == null) {
      await admin.from("reseller_marketplace_audit_logs").insert({
        actor_id: actor.id,
        actor_role: actor.role,
        action: "resync_marketplace_stock_discrepancy",
        product_id: row.reseller_product_id,
        success: false,
        error: "source_product_not_found",
        metadata: {
          name: row.name,
          request_id: row.request_id,
          previous_stock: row.reseller_stock,
          source_stock: null,
        } as never,
      });
      continue;
    }

    const { error: uErr } = await admin
      .from("reseller_products")
      .update({ stock: row.source_stock, updated_at: new Date().toISOString() })
      .eq("id", row.reseller_product_id);

    if (uErr) {
      await admin.from("reseller_marketplace_audit_logs").insert({
        actor_id: actor.id,
        actor_role: actor.role,
        action: "resync_marketplace_stock_failed",
        product_id: row.reseller_product_id,
        success: false,
        error: uErr.message,
        metadata: {
          name: row.name,
          request_id: row.request_id,
          previous_stock: row.reseller_stock,
          source_stock: row.source_stock,
        } as never,
      });
      continue;
    }

    updated++;
    changes.push({
      reseller_product_id: row.reseller_product_id,
      previous_stock: row.reseller_stock,
      new_stock: row.source_stock,
      source_stock: row.source_stock,
    });

    await admin.from("reseller_marketplace_audit_logs").insert({
      actor_id: actor.id,
      actor_role: actor.role,
      action: "resync_marketplace_stock",
      product_id: row.reseller_product_id,
      success: true,
      error: null,
      metadata: {
        name: row.name,
        request_id: row.request_id,
        previous_stock: row.reseller_stock,
        new_stock: row.source_stock,
        source_product_id: row.source_product_id,
      } as never,
    });
  }

  return { checked: report.checked, updated, discrepancies, changes };
}
