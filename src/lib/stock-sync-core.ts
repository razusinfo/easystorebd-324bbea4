// Pure, testable core for inventory sync logic.
// - Propagates supplier reseller_products.stock into all reseller copies.
// - Emits a low-stock/out-of-stock notification for each affected store
//   owner ONLY on the crossing from >THRESHOLD to <=THRESHOLD.
// - Emits stock-audit entries when a supplier product's stock crosses the
//   threshold (out) or is restored above it (in).
// - Applies stock deltas for POS sales / completed orders.

/**
 * Marketplace "low stock == out of stock" threshold. Any product with
 * stock <= LOW_STOCK_THRESHOLD is treated as out of stock in the
 * marketplace to prevent overselling. Keep in sync with the DB generated
 * column `is_out_of_stock` on products / reseller_products.
 */
export const LOW_STOCK_THRESHOLD = 3;

export type ResellerCopy = {
  id: string;
  store_owner_id: string;
};

export type NotificationRow = {
  user_id: string;
  type: "supplier_out_of_stock";
  title: string;
  body: string;
  link: string;
  related_id: string;
};

export type StockAuditRow = {
  action: "stock_out" | "stock_restored";
  product_id: string; // supplier reseller_products.id
  metadata: {
    reseller_product_id: string;
    original_product_id: string | null;
    old_stock: number;
    new_stock: number;
    affected_store_owner_ids: string[];
  };
  success: true;
};

/** True when stock transitions from >0 to <=0 (i.e. just went out of stock). */
export function didGoOutOfStock(oldStock: number, newStock: number): boolean {
  return (oldStock ?? 0) > 0 && (newStock ?? 0) <= 0;
}

/** True when stock transitions from <=0 to >0 (i.e. was restored). */
export function didRestoreStock(oldStock: number, newStock: number): boolean {
  return (oldStock ?? 0) <= 0 && (newStock ?? 0) > 0;
}

/** Apply a signed delta (negative for sales, positive for restocks). Clamped at 0. */
export function applyStockDelta(current: number, delta: number): number {
  return Math.max(0, (current ?? 0) + delta);
}

/**
 * Build the notification rows that should be inserted when a supplier product
 * goes out of stock. Deduplicates by store owner so a single reseller with
 * multiple copies still gets exactly one alert.
 */
export function buildOutOfStockNotifications(
  resellerProductId: string,
  productName: string,
  affected: ResellerCopy[],
): NotificationRow[] {
  const seen = new Set<string>();
  const rows: NotificationRow[] = [];
  for (const c of affected) {
    if (!c.store_owner_id || seen.has(c.store_owner_id)) continue;
    seen.add(c.store_owner_id);
    rows.push({
      user_id: c.store_owner_id,
      type: "supplier_out_of_stock",
      title: "Item out of stock from supplier",
      body: `"${productName}" is currently unavailable from the supplier.`,
      link: "/reseller-products",
      related_id: resellerProductId,
    });
  }
  return rows;
}

/** Build the audit-log row for a stock-out or stock-restored crossing. */
export function buildStockAuditRow(args: {
  resellerProductId: string;
  originalProductId: string | null;
  oldStock: number;
  newStock: number;
  affected: ResellerCopy[];
}): StockAuditRow | null {
  const { resellerProductId, originalProductId, oldStock, newStock, affected } = args;
  const action = didGoOutOfStock(oldStock, newStock)
    ? "stock_out"
    : didRestoreStock(oldStock, newStock)
      ? "stock_restored"
      : null;
  if (!action) return null;
  const owners = Array.from(new Set(affected.map((a) => a.store_owner_id).filter(Boolean)));
  return {
    action,
    product_id: resellerProductId,
    success: true,
    metadata: {
      reseller_product_id: resellerProductId,
      original_product_id: originalProductId,
      old_stock: oldStock,
      new_stock: newStock,
      affected_store_owner_ids: owners,
    },
  };
}

/**
 * Simulate what the DB trigger `sync_reseller_stock_to_shops` does when the
 * supplier's `reseller_products.stock` moves from `oldStock` -> `newStock`.
 * Returns the propagated per-copy stock updates + any notifications to insert.
 */
export function propagateStockChange(args: {
  resellerProductId: string;
  productName: string;
  oldStock: number;
  newStock: number;
  affected: ResellerCopy[];
}): {
  propagated: { product_id: string; stock: number }[];
  notifications: NotificationRow[];
} {
  const { resellerProductId, productName, oldStock, newStock, affected } = args;
  if (oldStock === newStock) return { propagated: [], notifications: [] };
  const propagated = affected.map((c) => ({ product_id: c.id, stock: newStock }));
  const notifications = didGoOutOfStock(oldStock, newStock)
    ? buildOutOfStockNotifications(resellerProductId, productName, affected)
    : [];
  return { propagated, notifications };
}

/**
 * Stable "in-stock first, out-of-stock last" sort. Preserves the original
 * relative order within each group (JS `Array.prototype.sort` is stable in
 * every current runtime).
 */
export function sortOutOfStockToBottom<T extends { stock?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ao = (a.stock ?? 0) <= 0 ? 1 : 0;
    const bo = (b.stock ?? 0) <= 0 ? 1 : 0;
    return ao - bo;
  });
}

/**
 * Group by category then apply `sortOutOfStockToBottom` inside each category
 * and flatten back to a single list. Used to guarantee that a zero-stock
 * item stays in its category but always sits at the bottom of it.
 */
export function sortByCategoryWithOutOfStockLast<
  T extends { stock?: number | null; category?: string | null },
>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const r of rows) {
    const k = r.category ?? "";
    if (!groups.has(k)) {
      groups.set(k, []);
      order.push(k);
    }
    groups.get(k)!.push(r);
  }
  const out: T[] = [];
  for (const k of order) out.push(...sortOutOfStockToBottom(groups.get(k)!));
  return out;
}

/** Derived flag used by DB `is_out_of_stock` generated column. */
export function computeIsOutOfStock(stock: number | null | undefined): boolean {
  return (stock ?? 0) <= 0;
}
