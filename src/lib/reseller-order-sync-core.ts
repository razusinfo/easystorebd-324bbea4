// Pure JS mirror of the DB trigger `sync_customer_order_to_admin`.
// Documents and tests the idempotency contract: the same customer order item
// must never produce more than one row in `reseller_orders`. Guarded by the
// unique index on `reseller_orders.source_order_item_id`.
//
// The real sync runs in Postgres (see migration 20260705122658). This helper
// exists so the contract is exercised in integration tests without a live DB.

export type OrderItemInput = {
  order_id: string;
  order_item_id: string;
  product_id: string;
  quantity: number;
  price: number;
  name: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string;
  store_id: string;
};

export type ResellerOrderRow = {
  id: string;
  source_order_item_id: string;
  reseller_id: string;
  product_name: string;
  quantity: number;
};

export type SyncClient = {
  // Returns { source_reseller_product_id } or null if the product isn't sourced.
  getProductSource(product_id: string): Promise<{ source_reseller_product_id: string | null } | null>;
  // Returns the store owner (=reseller) for the shop the order was placed on.
  getStoreOwner(store_id: string): Promise<{ owner_user_id: string | null } | null>;
  // Inserts a reseller_orders row honoring the unique constraint on
  // source_order_item_id — returns null when the row already exists.
  insertResellerOrderIgnoreDuplicate(payload: {
    reseller_id: string;
    reseller_product_id: string;
    product_name: string;
    customer_name: string;
    customer_phone: string | null;
    shipping_address: string;
    quantity: number;
    source_order_id: string;
    source_order_item_id: string;
    source_store_id: string;
  }): Promise<ResellerOrderRow | null>;
};

export async function syncCustomerOrderItemToAdmin(
  item: OrderItemInput,
  client: SyncClient,
): Promise<{ inserted: boolean; row: ResellerOrderRow | null; reason?: string }> {
  const src = await client.getProductSource(item.product_id);
  if (!src?.source_reseller_product_id) {
    return { inserted: false, row: null, reason: "not_a_sourced_product" };
  }
  const store = await client.getStoreOwner(item.store_id);
  if (!store?.owner_user_id) {
    return { inserted: false, row: null, reason: "store_owner_missing" };
  }

  const row = await client.insertResellerOrderIgnoreDuplicate({
    reseller_id: store.owner_user_id,
    reseller_product_id: src.source_reseller_product_id,
    product_name: item.name,
    customer_name: item.customer_name,
    customer_phone: item.customer_phone,
    shipping_address: item.customer_address,
    quantity: item.quantity,
    source_order_id: item.order_id,
    source_order_item_id: item.order_item_id,
    source_store_id: item.store_id,
  });

  if (!row) return { inserted: false, row: null, reason: "duplicate_ignored" };
  return { inserted: true, row };
}
