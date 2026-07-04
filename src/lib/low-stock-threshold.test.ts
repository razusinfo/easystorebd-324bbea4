import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  buildOutOfStockNotifications,
  buildStockAuditRow,
  didCrossLowStock,
  didGoOutOfStock,
  didRestoreStock,
  getLowStockThreshold,
  propagateStockChange,
  setLowStockThreshold,
  computeIsOutOfStock,
  sortOutOfStockToBottom,
} from "./stock-sync-core";
import {
  LOW_STOCK_THRESHOLD_KEY,
  applyLowStockThresholdSetting,
  parseLowStockThreshold,
} from "./admin-settings-core";
import { createSupabaseHarness } from "@/test/supabase-harness";

afterEach(() => setLowStockThreshold(DEFAULT_LOW_STOCK_THRESHOLD));

describe("admin-configurable Low Stock Threshold", () => {
  it("defaults to 3", () => {
    expect(getLowStockThreshold()).toBe(3);
  });

  it("parseLowStockThreshold coerces safely and falls back on invalid input", () => {
    expect(parseLowStockThreshold(5)).toBe(5);
    expect(parseLowStockThreshold("7")).toBe(7);
    expect(parseLowStockThreshold(-1)).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(parseLowStockThreshold("bad")).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it("applyLowStockThresholdSetting rewires sorting + notification triggers", () => {
    applyLowStockThresholdSetting(5);
    expect(getLowStockThreshold()).toBe(5);
    // Sorting uses the new threshold: stock=4 is now out-of-stock.
    const sorted = sortOutOfStockToBottom([
      { id: "a", stock: 4 },
      { id: "b", stock: 10 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["b", "a"]);
    expect(computeIsOutOfStock(4)).toBe(true);
    // Threshold crossing detection follows the setting.
    expect(didGoOutOfStock(10, 5)).toBe(true);
    expect(didRestoreStock(5, 6)).toBe(true);
  });

  it("uses the LOW_STOCK_THRESHOLD_KEY site_settings key", () => {
    expect(LOW_STOCK_THRESHOLD_KEY).toBe("low_stock_threshold");
  });
});

describe("low-stock notifications only fire on threshold crossings", () => {
  it("emits reseller + super-admin alerts on the crossing", () => {
    const r = propagateStockChange({
      resellerProductId: "rp-1",
      productName: "Widget",
      oldStock: 10,
      newStock: 3,
      affected: [
        { id: "c1", store_owner_id: "owner-a" },
        { id: "c2", store_owner_id: "owner-b" },
      ],
    });
    expect(r.notifications).toHaveLength(2);
    expect(r.notifications.every((n) => n.link === "/reseller-products")).toBe(true);
    expect(r.notifications[0].related_id).toBe("rp-1");
  });

  it("does NOT re-notify while stock stays at/below threshold", () => {
    const affected = [{ id: "c1", store_owner_id: "owner-a" }];
    // 10 -> 3 crosses; 3 -> 2 stays below; 2 -> 1 stays below.
    expect(propagateStockChange({ resellerProductId: "rp", productName: "W", oldStock: 3, newStock: 2, affected }).notifications).toEqual([]);
    expect(propagateStockChange({ resellerProductId: "rp", productName: "W", oldStock: 2, newStock: 1, affected }).notifications).toEqual([]);
    // Restore then re-cross => notifies again.
    expect(propagateStockChange({ resellerProductId: "rp", productName: "W", oldStock: 10, newStock: 2, affected }).notifications).toHaveLength(1);
  });

  it("uses the configured threshold when computing crossings", () => {
    applyLowStockThresholdSetting(5);
    const affected = [{ id: "c1", store_owner_id: "owner-a" }];
    const r = propagateStockChange({
      resellerProductId: "rp",
      productName: "W",
      oldStock: 10,
      newStock: 5,
      affected,
    });
    expect(r.notifications).toHaveLength(1);
  });
});

describe("threshold-crossing audit entries (both directions, with linkage)", () => {
  const affected = [
    { id: "c1", store_owner_id: "owner-a" },
    { id: "c2", store_owner_id: "owner-b" },
  ];

  it("logs stock_out on downward crossing with supplier + owners", () => {
    const row = buildStockAuditRow({
      resellerProductId: "rp-1",
      originalProductId: "orig-1",
      oldStock: 10,
      newStock: 3,
      affected,
    });
    expect(row).toMatchObject({
      action: "stock_out",
      product_id: "rp-1",
      metadata: {
        reseller_product_id: "rp-1",
        original_product_id: "orig-1",
        affected_store_owner_ids: ["owner-a", "owner-b"],
      },
    });
  });

  it("logs stock_restored on upward crossing", () => {
    const row = buildStockAuditRow({
      resellerProductId: "rp-1",
      originalProductId: null,
      oldStock: 2,
      newStock: 10,
      affected,
    });
    expect(row?.action).toBe("stock_restored");
    expect(didCrossLowStock(2, 10)).toBe(true);
  });

  it("does NOT log when the change stays on the same side of the threshold", () => {
    expect(
      buildStockAuditRow({
        resellerProductId: "rp",
        originalProductId: null,
        oldStock: 3,
        newStock: 1,
        affected,
      }),
    ).toBeNull();
    expect(didCrossLowStock(3, 1)).toBe(false);
  });
});

describe("dashboard notifications RLS (reseller + admin, mark-read scoping)", () => {
  it("reseller dashboard notification has the correct deep link + related product", () => {
    const [n] = buildOutOfStockNotifications("rp-1", "Widget", [
      { id: "c1", store_owner_id: "me" },
    ]);
    expect(n.link).toBe("/reseller-products");
    expect(n.related_id).toBe("rp-1");
    expect(n.user_id).toBe("me");
  });

  it("mark-as-read scopes the UPDATE to the current user only", async () => {
    const { client, updates } = createSupabaseHarness({
      user_notifications: { await: { data: null, error: null } },
    });
    const me = "user-me";
    const filters: Array<[string, unknown]> = [];
    // Intercept .eq to capture the applied filter.
    const chain = client.from("user_notifications");
    const originalEq = chain.eq;
    chain.eq = (col: string, val: unknown) => {
      filters.push([col, val]);
      return originalEq(col, val);
    };
    await chain.update({ read_at: "2026-01-01T00:00:00Z" }).eq("user_id", me);
    expect(updates[0].table).toBe("user_notifications");
    expect(filters).toContainEqual(["user_id", me]);
  });

  it("admin_notifications inserts are super-admin scoped (no per-user filter needed)", async () => {
    const { client, inserts } = createSupabaseHarness({
      admin_notifications: { single: { data: { id: "n1" }, error: null } },
    });
    await client
      .from("admin_notifications")
      .insert({
        type: "supplier_low_stock",
        title: "Marketplace item is low on stock",
        body: '"Widget" has only 3 left (threshold 3).',
        link: "/admin",
        related_id: "rp-1",
      })
      .select()
      .single();
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("admin_notifications");
    expect(inserts[0].payload.link).toBe("/admin");
  });
});

describe("i18n keys for low-stock UI (Bangla + English)", () => {
  it("exposes criticalLowStock + outOfStockCta translations", async () => {
    const src = await import("fs").then((fs) =>
      fs.readFileSync(new URL("./i18n.tsx", import.meta.url), "utf8"),
    );
    expect(src).toContain("lowStockBadge:");
    expect(src).toMatch(/lowStockBadge:\s*\{\s*bn:\s*"লো স্টক",\s*en:\s*"Low Stock"/);
    expect(src).toMatch(/criticalLowStock:\s*\{\s*bn:\s*"সংকটজনক লো স্টক",\s*en:\s*"Critical Low Stock"/);
    expect(src).toMatch(/outOfStockCta:\s*\{\s*bn:\s*"স্টক শেষ",\s*en:\s*"Out of Stock"/);
  });
});
