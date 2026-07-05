import { describe, it, expect } from "vitest";
import {
  syncCustomerOrderItemToAdmin,
  type OrderItemInput,
  type ResellerOrderRow,
  type SyncClient,
} from "./reseller-order-sync-core";

function makeItem(overrides: Partial<OrderItemInput> = {}): OrderItemInput {
  return {
    order_id: "order-1",
    order_item_id: "oi-1",
    product_id: "prod-1",
    quantity: 2,
    price: 500,
    name: "Test Phone",
    customer_name: "Alice",
    customer_phone: "0170000",
    customer_address: "Dhaka",
    store_id: "store-1",
    ...overrides,
  };
}

/**
 * In-memory client that mirrors the Postgres unique index on
 * reseller_orders.source_order_item_id: the second insert for the same key is
 * ignored and returns null, exactly like `ON CONFLICT DO NOTHING`.
 */
function makeClient(): SyncClient & { rows: ResellerOrderRow[] } {
  const rows: ResellerOrderRow[] = [];
  return {
    rows,
    async getProductSource() {
      return { source_reseller_product_id: "rp-1" };
    },
    async getStoreOwner() {
      return { owner_user_id: "reseller-1" };
    },
    async insertResellerOrderIgnoreDuplicate(payload) {
      if (rows.some((r) => r.source_order_item_id === payload.source_order_item_id)) {
        return null; // unique-violation ignored
      }
      const row: ResellerOrderRow = {
        id: `ro-${rows.length + 1}`,
        source_order_item_id: payload.source_order_item_id,
        reseller_id: payload.reseller_id,
        product_name: payload.product_name,
        quantity: payload.quantity,
      };
      rows.push(row);
      return row;
    },
  };
}

describe("syncCustomerOrderItemToAdmin — idempotency", () => {
  it("creates exactly one reseller_orders row for a sourced product", async () => {
    const client = makeClient();
    const res = await syncCustomerOrderItemToAdmin(makeItem(), client);
    expect(res.inserted).toBe(true);
    expect(client.rows).toHaveLength(1);
  });

  it("re-running the sync for the same order_item_id never inserts a duplicate", async () => {
    const client = makeClient();
    const item = makeItem();

    const first = await syncCustomerOrderItemToAdmin(item, client);
    const second = await syncCustomerOrderItemToAdmin(item, client);
    const third = await syncCustomerOrderItemToAdmin(item, client);

    expect(first.inserted).toBe(true);
    expect(second).toEqual({ inserted: false, row: null, reason: "duplicate_ignored" });
    expect(third).toEqual({ inserted: false, row: null, reason: "duplicate_ignored" });
    expect(client.rows).toHaveLength(1);
  });

  it("different order_item_ids each produce their own row", async () => {
    const client = makeClient();
    await syncCustomerOrderItemToAdmin(makeItem({ order_item_id: "oi-a" }), client);
    await syncCustomerOrderItemToAdmin(makeItem({ order_item_id: "oi-b" }), client);
    // Retry oi-a — still one row for it.
    await syncCustomerOrderItemToAdmin(makeItem({ order_item_id: "oi-a" }), client);
    expect(client.rows.map((r) => r.source_order_item_id).sort()).toEqual(["oi-a", "oi-b"]);
  });

  it("skips products that aren't copied from the reseller marketplace", async () => {
    const client = makeClient();
    client.getProductSource = async () => ({ source_reseller_product_id: null });
    const res = await syncCustomerOrderItemToAdmin(makeItem(), client);
    expect(res).toEqual({ inserted: false, row: null, reason: "not_a_sourced_product" });
    expect(client.rows).toHaveLength(0);
  });
});
