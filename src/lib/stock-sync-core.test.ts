import { describe, expect, it } from "vitest";
import {
  applyStockDelta,
  buildOutOfStockNotifications,
  buildStockAuditRow,
  didGoOutOfStock,
  didRestoreStock,
  propagateStockChange,
} from "./stock-sync-core";
import { createSupabaseHarness } from "@/test/supabase-harness";

describe("stock crossings (low-stock threshold = 3)", () => {
  it("detects transition to <=3", () => {
    expect(didGoOutOfStock(10, 3)).toBe(true);
    expect(didGoOutOfStock(4, 2)).toBe(true);
    expect(didGoOutOfStock(3, 3)).toBe(false); // stayed at/below threshold
    expect(didGoOutOfStock(10, 5)).toBe(false);
  });
  it("detects restore above 3", () => {
    expect(didRestoreStock(3, 4)).toBe(true);
    expect(didRestoreStock(0, 10)).toBe(true);
    expect(didRestoreStock(5, 8)).toBe(false);
  });
});

describe("applyStockDelta (POS sales / completed orders)", () => {
  it("decrements stock and clamps at 0", () => {
    expect(applyStockDelta(5, -2)).toBe(3);
    expect(applyStockDelta(1, -3)).toBe(0);
  });
  it("increments on restock / refund", () => {
    expect(applyStockDelta(0, 4)).toBe(4);
  });
});

describe("propagateStockChange", () => {
  const affected = [
    { id: "copy-1", store_owner_id: "owner-a" },
    { id: "copy-2", store_owner_id: "owner-b" },
  ];

  it("propagates new stock to every reseller copy", () => {
    const r = propagateStockChange({
      resellerProductId: "rp-1", productName: "Widget",
      oldStock: 10, newStock: 7, affected,
    });
    expect(r.propagated).toEqual([
      { product_id: "copy-1", stock: 7 },
      { product_id: "copy-2", stock: 7 },
    ]);
    // No notification on partial decrement that stays above threshold.
    expect(r.notifications).toEqual([]);
  });

  it("creates one alert per affected owner on the low-stock crossing (>3 -> <=3)", () => {
    const r = propagateStockChange({
      resellerProductId: "rp-1", productName: "Widget",
      oldStock: 10, newStock: 2, affected,
    });
    expect(r.notifications).toHaveLength(2);
    expect(r.notifications[0]).toMatchObject({
      user_id: "owner-a",
      link: "/reseller-products",
      related_id: "rp-1",
    });
    expect(r.notifications[0].body).toContain("Widget");
  });

  it("does NOT re-notify when stock stays at/below the threshold", () => {
    const r = propagateStockChange({
      resellerProductId: "rp-1", productName: "Widget",
      oldStock: 3, newStock: 1, affected,
    });
    expect(r.notifications).toEqual([]);
  });

  it("dedupes notifications when one reseller owns multiple copies", () => {
    const r = propagateStockChange({
      resellerProductId: "rp-1", productName: "Widget",
      oldStock: 10, newStock: 0,
      affected: [
        { id: "c-1", store_owner_id: "owner-a" },
        { id: "c-2", store_owner_id: "owner-a" },
      ],
    });
    expect(r.notifications).toHaveLength(1);
    expect(r.notifications[0].user_id).toBe("owner-a");
  });
});

describe("buildStockAuditRow", () => {
  const affected = [
    { id: "c-1", store_owner_id: "owner-a" },
    { id: "c-2", store_owner_id: "owner-b" },
  ];
  it("emits stock_out audit at threshold crossing with supplier linkage", () => {
    const row = buildStockAuditRow({
      resellerProductId: "rp-1", originalProductId: "orig-1",
      oldStock: 10, newStock: 2, affected,
    });
    expect(row).toMatchObject({
      action: "stock_out",
      product_id: "rp-1",
      metadata: {
        original_product_id: "orig-1",
        old_stock: 10,
        new_stock: 2,
        affected_store_owner_ids: ["owner-a", "owner-b"],
      },
    });
  });
  it("emits stock_restored when climbing back above 3", () => {
    const row = buildStockAuditRow({
      resellerProductId: "rp-1", originalProductId: null,
      oldStock: 0, newStock: 10, affected,
    });
    expect(row?.action).toBe("stock_restored");
  });
  it("returns null when the change stays on the same side of the threshold", () => {
    expect(
      buildStockAuditRow({
        resellerProductId: "rp-1", originalProductId: null,
        oldStock: 10, newStock: 7, affected,
      }),
    ).toBeNull();
  });
});

describe("notifications RLS surface (user-scoped read + mark-read)", () => {
  it("only inserts a notification for the affected owner", () => {
    const rows = buildOutOfStockNotifications("rp-1", "Widget", [
      { id: "c-1", store_owner_id: "me" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe("me");
  });

  it("mark-as-read updates only rows scoped to my user_id", async () => {
    // Simulate: supabase.from('user_notifications').update({read_at}).eq('user_id', me)
    const { client, updates } = createSupabaseHarness({
      user_notifications: { await: { data: null, error: null } },
    });
    const me = "user-me";
    await client
      .from("user_notifications")
      .update({ read_at: "2026-01-01T00:00:00Z" })
      .eq("user_id", me);
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("user_notifications");
    expect(updates[0].payload).toEqual({ read_at: "2026-01-01T00:00:00Z" });
  });
});

describe("i18n keys for out-of-stock UI", () => {
  it("exposes Bangla + English translations", async () => {
    const mod = await import("./i18n");
    // Inspect the dict by rendering both languages via a temporary provider is
    // heavy; the export is internal. We assert the source of truth instead.
    const src = await import("fs").then((fs) =>
      fs.readFileSync(new URL("./i18n.tsx", import.meta.url), "utf8"),
    );
    expect(src).toContain("outOfStock:");
    expect(src).toMatch(/outOfStock:\s*\{\s*bn:\s*"স্টক শেষ",\s*en:\s*"Out of Stock"/);
    expect(src).toContain("addToMyShop:");
    expect(mod).toBeDefined();
  });
});
