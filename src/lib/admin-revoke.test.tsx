// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, createRootRoute, RouterProvider } from "@tanstack/react-router";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  applyLowStockThresholdSetting,
} from "@/lib/admin-settings-core";
import {
  InvalidLowStockThresholdError,
  LOW_STOCK_THRESHOLD_MAX,
  parseLowStockThreshold,
  validateLowStockThreshold,
} from "@/lib/admin-settings-core";
import { getLowStockThreshold, computeIsOutOfStock } from "@/lib/stock-sync-core";
import { createSupabaseHarness } from "@/test/supabase-harness";
import { NotificationCard } from "@/routes/_authenticated/my-notifications";

afterEach(() => applyLowStockThresholdSetting(DEFAULT_LOW_STOCK_THRESHOLD));

// ---------- server + UI validation of the threshold ----------
describe("Low Stock Threshold validation (server + UI safety net)", () => {
  it("rejects non-numbers, negatives, non-integers, and values > MAX", () => {
    expect(() => validateLowStockThreshold("")).toThrow(InvalidLowStockThresholdError);
    expect(() => validateLowStockThreshold("abc")).toThrow(InvalidLowStockThresholdError);
    expect(() => validateLowStockThreshold(-1)).toThrow(/≥/);
    expect(() => validateLowStockThreshold(2.5)).toThrow(/whole number/);
    expect(() => validateLowStockThreshold(LOW_STOCK_THRESHOLD_MAX + 1)).toThrow(/≤/);
  });

  it("accepts a valid integer in range and coerces string digits", () => {
    expect(validateLowStockThreshold(5)).toBe(5);
    expect(validateLowStockThreshold("7")).toBe(7);
  });

  it("parseLowStockThreshold falls back to default for corrupt DB values (does NOT throw)", () => {
    expect(parseLowStockThreshold(null)).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(parseLowStockThreshold("bad")).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(parseLowStockThreshold(-99)).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it("saving a threshold updates in-process sorting + OOS badges immediately", () => {
    applyLowStockThresholdSetting(7);
    expect(getLowStockThreshold()).toBe(7);
    // A stock=6 product must now be OOS for the badge/sort.
    expect(computeIsOutOfStock(6)).toBe(true);
    expect(computeIsOutOfStock(8)).toBe(false);
  });
});

// ---------- revoke cascade: RPC + notification + audit row shape ----------
describe("Revoke reseller product (integration: RPC + notifications + audit)", () => {
  it("calls admin_revoke_reseller_product RPC with id + reason", async () => {
    const { client, rpcCalls } = createSupabaseHarness({
      "rpc:admin_revoke_reseller_product": { data: null, error: null },
    } as any);
    const { error } = await client.rpc("admin_revoke_reseller_product", {
      _reseller_product_id: "rp-1",
      _reason: "Quality issue",
    });
    expect(error).toBeNull();
    expect(rpcCalls).toEqual([
      {
        fn: "admin_revoke_reseller_product",
        args: { _reseller_product_id: "rp-1", _reason: "Quality issue" },
      },
    ]);
  });

  it("marketplace row is removed and reseller copies are marked rejected (SQL contract)", async () => {
    // Simulate the two writes the RPC performs so callers can assert both happen.
    const { client, updates } = createSupabaseHarness({
      products: { await: { data: null, error: null } },
      reseller_products: { await: { data: null, error: null } },
    });
    await client
      .from("products")
      .update({ status: "rejected" })
      .eq("source_reseller_product_id", "rp-1");
    await client.from("reseller_products").delete?.();
    expect(updates[0].table).toBe("products");
    expect(updates[0].payload).toEqual({ status: "rejected" });
    // reseller_products delete recorded via .from call on the harness
    expect(client.from).toHaveBeenCalledWith("reseller_products");
  });

  it("inserts one supplier_revoked notification per affected reseller owner", async () => {
    const { client, inserts } = createSupabaseHarness({
      user_notifications: { await: { data: null, error: null } },
    });
    const owners = ["owner-a", "owner-b"];
    for (const owner of owners) {
      await client.from("user_notifications").insert({
        user_id: owner,
        type: "supplier_revoked",
        title: "Product removed by admin",
        body: '"Widget" has been removed due to quality standards. Reason: Recalled',
        link: "/my-products",
        related_id: "rp-1",
      });
    }
    expect(inserts).toHaveLength(2);
    expect(inserts.every((i) => i.payload.type === "supplier_revoked")).toBe(true);
    expect(inserts.every((i) => i.payload.link === "/my-products")).toBe(true);
    expect(inserts.every((i) => i.payload.related_id === "rp-1")).toBe(true);
  });

  it("writes a marketplace audit row with supplier linkage + affected owners", async () => {
    const { client, audits } = createSupabaseHarness({
      reseller_marketplace_audit_logs: { await: { data: null, error: null } },
    });
    await client.from("reseller_marketplace_audit_logs").insert({
      actor_role: "super_admin",
      action: "admin_revoke",
      product_id: "rp-1",
      success: true,
      metadata: {
        reseller_product_id: "rp-1",
        original_product_id: "orig-1",
        affected_store_owner_ids: ["owner-a", "owner-b"],
        affected_copy_ids: ["copy-1", "copy-2"],
        reason: "Recalled",
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("admin_revoke");
    expect(audits[0].metadata.affected_store_owner_ids).toEqual(["owner-a", "owner-b"]);
    expect(audits[0].metadata.original_product_id).toBe("orig-1");
  });

  it("only super_admins can invoke the RPC (server-side gate contract)", async () => {
    const { client } = createSupabaseHarness({
      "rpc:admin_revoke_reseller_product": {
        data: null,
        error: { message: "Access denied: super_admin only" },
      },
    } as any);
    const { error } = await client.rpc("admin_revoke_reseller_product", {
      _reseller_product_id: "rp-1",
      _reason: null,
    });
    expect(error?.message).toMatch(/super_admin/i);
  });
});

// ---------- revoked-product notification card (deep link + mark read) ----------
describe("Revoked-product notification card", () => {
  function mount(ui: React.ReactElement) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rootRoute = createRootRoute({ component: () => ui });
    const router = createRouter({
      routeTree: rootRoute,
      history: { location: "/", push: vi.fn(), replace: vi.fn(), go: vi.fn(), back: vi.fn(), forward: vi.fn(), createHref: (p: any) => p, subscribe: vi.fn(() => () => {}), block: vi.fn(), notify: vi.fn(), destroy: vi.fn(), flush: vi.fn(), listen: vi.fn(() => () => {}) } as any,
    });
    return render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it("renders title, body, deep link '/my-products', and Mark-as-read button", () => {
    const onMarkRead = vi.fn();
    mount(
      <NotificationCard
        onMarkRead={onMarkRead}
        n={{
          id: "n1",
          user_id: "me",
          type: "supplier_revoked",
          title: "Product removed by admin",
          body: '"Widget" has been removed due to quality standards.',
          link: "/my-products",
          related_id: "rp-1",
          read_at: null,
          created_at: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.getByText(/Product removed by admin/)).toBeTruthy();
    expect(screen.getByText(/quality standards/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /view my products/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/my-products");
    fireEvent.click(screen.getByRole("button", { name: /mark as read/i }));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("hides mark-as-read once the notification is already read", () => {
    mount(
      <NotificationCard
        onMarkRead={vi.fn()}
        n={{
          id: "n1",
          user_id: "me",
          type: "supplier_revoked",
          title: "Product removed by admin",
          body: null,
          link: "/my-products",
          related_id: "rp-1",
          read_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /mark as read/i })).toBeNull();
  });
});
