import { describe, it, expect } from "vitest";

import {
  classifyRow,
  shouldRenderOutOfStock,
  buildReconciliationReport,
  resyncApprovedMarketplaceStock,
  type ReconciliationRow,
} from "./marketplace-stock-reconciliation.server";

describe("classifyRow", () => {
  it("returns match when values are equal", () => {
    expect(classifyRow(10, 10)).toBe("match");
  });
  it("returns stuck_out_of_stock when reseller <= threshold and source unknown", () => {
    expect(classifyRow(0, null, 3)).toBe("stuck_out_of_stock");
  });
  it("returns no_source when source unknown but reseller has stock", () => {
    expect(classifyRow(20, null, 3)).toBe("no_source");
  });
  it("returns mismatch when values diverge", () => {
    expect(classifyRow(0, 15)).toBe("mismatch");
  });
});

describe("shouldRenderOutOfStock", () => {
  it("never renders out-of-stock when the source has stock above threshold", () => {
    // Regression: even if reseller_products.stock is stuck at 0, if the
    // requester's product still has real stock the marketplace must not tell
    // the reseller the item is out of stock.
    expect(shouldRenderOutOfStock(0, 15, 3)).toBe(false);
    expect(shouldRenderOutOfStock(1, 25, 3)).toBe(false);
  });
  it("renders out-of-stock when both sides are at/under threshold", () => {
    expect(shouldRenderOutOfStock(0, 0, 3)).toBe(true);
    expect(shouldRenderOutOfStock(2, 3, 3)).toBe(true);
  });
  it("renders out-of-stock when reseller stock is low and source is unknown", () => {
    expect(shouldRenderOutOfStock(0, null, 3)).toBe(true);
  });
});

// Minimal in-memory admin double for buildReconciliationReport +
// resyncApprovedMarketplaceStock. Only implements the calls those helpers
// actually make in the order they make them.
function makeAdmin(opts: {
  requests: Array<{ id: string; requested_by: string; name: string; published_reseller_product_id: string }>;
  reseller_products: Array<{ id: string; stock: number | null; name: string }>;
  stores_by_owner: Record<string, Array<{ id: string }>>;
  products_by_name: Record<string, { id: string; stock: number | null } | null>;
}) {
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; payload: Record<string, unknown>; id: string }> = [];

  const chain = (result: unknown) => {
    const p: any = Promise.resolve(result);
    p.select = () => p;
    p.eq = () => p;
    p.in = () => p;
    p.ilike = () => p;
    p.order = () => p;
    p.limit = () => p;
    p.not = () => p;
    p.maybeSingle = () => Promise.resolve(result);
    return p;
  };

  const client = {
    from(table: string) {
      if (table === "product_requests") {
        return chain({ data: opts.requests, error: null });
      }
      if (table === "reseller_products") {
        return {
          select: () => chain({ data: opts.reseller_products, error: null }),
          update: (payload: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              updates.push({ table, payload, id });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === "stores") {
        return {
          select: () => ({
            eq: (_c: string, owner: string) =>
              Promise.resolve({ data: opts.stores_by_owner[owner] ?? [], error: null }),
          }),
        };
      }
      if (table === "products") {
        // Both the .eq(name) and .ilike(name) branches return the same lookup.
        const lookup = (name: string) => opts.products_by_name[name] ?? null;
        const producer = (nameGetter: () => string) => ({
          select: () => ({
            in: () => ({
              eq: (_c: string, name: string) => ({
                order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: lookup(name), error: null }) }) }),
              }),
              ilike: (_c: string, name: string) => ({
                order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: lookup(name), error: null }) }) }),
              }),
            }),
          }),
        });
        return producer(() => "");
      }
      if (table === "reseller_marketplace_audit_logs") {
        return {
          insert: (payload: Record<string, unknown>) => {
            inserts.push({ table, payload });
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return chain({ data: null, error: null });
    },
  };

  return { client, inserts, updates };
}

describe("buildReconciliationReport", () => {
  it("flags approved items whose marketplace stock diverges from the source", async () => {
    const admin = makeAdmin({
      requests: [
        { id: "req-1", requested_by: "u-r", name: "Blender", published_reseller_product_id: "rp-1" },
      ],
      reseller_products: [{ id: "rp-1", stock: 0, name: "Blender" }],
      stores_by_owner: { "u-r": [{ id: "store-1" }] },
      products_by_name: { Blender: { id: "prod-1", stock: 25 } },
    });

    const report = await buildReconciliationReport(admin.client as never);
    expect(report.checked).toBe(1);
    expect(report.mismatches).toBe(1);
    const row = report.rows[0] as ReconciliationRow;
    expect(row.reseller_stock).toBe(0);
    expect(row.source_stock).toBe(25);
    expect(row.mismatch).toBe(true);
  });
});

describe("resyncApprovedMarketplaceStock", () => {
  it("repairs stuck marketplace stock from the source and writes an audit log", async () => {
    const admin = makeAdmin({
      requests: [
        { id: "req-1", requested_by: "u-r", name: "Blender", published_reseller_product_id: "rp-1" },
      ],
      reseller_products: [{ id: "rp-1", stock: 0, name: "Blender" }],
      stores_by_owner: { "u-r": [{ id: "store-1" }] },
      products_by_name: { Blender: { id: "prod-1", stock: 25 } },
    });

    const result = await resyncApprovedMarketplaceStock(admin.client as never, {
      id: "u-admin",
      role: "super_admin",
    });

    expect(result).toEqual({
      checked: 1,
      updated: 1,
      discrepancies: 1,
      changes: [{
        reseller_product_id: "rp-1",
        previous_stock: 0,
        new_stock: 25,
        source_stock: 25,
      }],
    });
    expect(admin.updates).toEqual([
      expect.objectContaining({ table: "reseller_products", id: "rp-1", payload: expect.objectContaining({ stock: 25 }) }),
    ]);
    expect(admin.inserts[0]).toMatchObject({
      table: "reseller_marketplace_audit_logs",
      payload: {
        action: "resync_marketplace_stock",
        product_id: "rp-1",
        success: true,
        metadata: { previous_stock: 0, new_stock: 25 },
      },
    });
  });

  it("logs a discrepancy when the source product cannot be located", async () => {
    const admin = makeAdmin({
      requests: [
        { id: "req-1", requested_by: "u-r", name: "Blender", published_reseller_product_id: "rp-1" },
      ],
      reseller_products: [{ id: "rp-1", stock: 0, name: "Blender" }],
      stores_by_owner: { "u-r": [{ id: "store-1" }] },
      products_by_name: { Blender: null },
    });

    const result = await resyncApprovedMarketplaceStock(admin.client as never, {
      id: null,
      role: "system_cron",
    });

    expect(result.updated).toBe(0);
    expect(result.discrepancies).toBe(1);
    expect(admin.inserts[0]).toMatchObject({
      payload: {
        action: "resync_marketplace_stock_discrepancy",
        success: false,
        error: "source_product_not_found",
      },
    });
  });
});
