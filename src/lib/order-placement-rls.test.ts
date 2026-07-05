import { describe, expect, it } from "vitest";

// Pure regression model of the INSERT policies on `orders` / `order_items`.
// Mirrors the WITH CHECK expressions that guard shopper checkouts. When RLS
// or grants change, update this model AND the migration together — a broken
// checkout is user-visible.
//
// Policy (orders INSERT to anon+authenticated):
//   - store must be published
//   - status = 'pending', payment_status in ('unpaid','paid')
//   - customer_name, customer_phone non-empty
//   - subtotal/delivery_charge/discount/total >= 0
//   - (auth.uid IS NULL AND customer_user_id IS NULL) OR
//     (auth.uid IS NOT NULL AND (customer_user_id IS NULL OR customer_user_id = auth.uid))

export type OrderInsertPayload = {
  status: string;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  customer_user_id: string | null;
};

export type StoreState = { published: boolean };
export type SessionState = { auth_uid: string | null };

export function canInsertOrder(
  store: StoreState,
  session: SessionState,
  o: OrderInsertPayload,
): boolean {
  if (!store.published) return false;
  if (o.status !== "pending") return false;
  if (!["unpaid", "paid"].includes(o.payment_status)) return false;
  if (!o.customer_name.trim() || !o.customer_phone.trim()) return false;
  if (o.subtotal < 0 || o.delivery_charge < 0 || o.discount < 0 || o.total < 0) return false;
  const uid = session.auth_uid;
  if (uid === null) return o.customer_user_id === null;
  return o.customer_user_id === null || o.customer_user_id === uid;
}

function valid(): OrderInsertPayload {
  return {
    status: "pending",
    payment_status: "unpaid",
    customer_name: "Riyad",
    customer_phone: "01700000000",
    subtotal: 100, delivery_charge: 0, discount: 0, total: 100,
    customer_user_id: null,
  };
}

describe("orders INSERT policy (role matrix)", () => {
  const published = { published: true };
  const unpublished = { published: false };

  it("guest / anon customer can place an order on a published store", () => {
    expect(canInsertOrder(published, { auth_uid: null }, valid())).toBe(true);
  });

  it("signed-in customer can place an order attributed to themselves", () => {
    const uid = "cust-1";
    expect(canInsertOrder(published, { auth_uid: uid }, { ...valid(), customer_user_id: uid }))
      .toBe(true);
  });

  it("signed-in customer can place an anonymous-attributed order (customer_user_id null)", () => {
    expect(canInsertOrder(published, { auth_uid: "cust-1" }, valid())).toBe(true);
  });

  it("retailer (store owner) placing an order on their own published store is allowed by INSERT policy", () => {
    // The INSERT policy does not restrict by ownership — only by session identity vs customer_user_id.
    // Store owners also have a separate ALL policy for orders on their stores, so both paths permit it.
    const uid = "retailer-1";
    expect(canInsertOrder(published, { auth_uid: uid }, { ...valid(), customer_user_id: uid }))
      .toBe(true);
  });

  it("super admin (signed in) can place orders like any authenticated user", () => {
    const uid = "super-1";
    expect(canInsertOrder(published, { auth_uid: uid }, { ...valid(), customer_user_id: uid }))
      .toBe(true);
  });

  it("blocks unpublished store", () => {
    expect(canInsertOrder(unpublished, { auth_uid: null }, valid())).toBe(false);
  });

  it("blocks status other than pending", () => {
    expect(canInsertOrder(published, { auth_uid: null }, { ...valid(), status: "confirmed" }))
      .toBe(false);
  });

  it("blocks empty name/phone", () => {
    expect(canInsertOrder(published, { auth_uid: null }, { ...valid(), customer_name: "  " })).toBe(false);
    expect(canInsertOrder(published, { auth_uid: null }, { ...valid(), customer_phone: "" })).toBe(false);
  });

  it("blocks negative totals", () => {
    expect(canInsertOrder(published, { auth_uid: null }, { ...valid(), total: -1 })).toBe(false);
  });

  it("blocks anon insert with a customer_user_id set", () => {
    expect(canInsertOrder(published, { auth_uid: null }, { ...valid(), customer_user_id: "someone" }))
      .toBe(false);
  });

  it("blocks signed-in user placing an order attributed to a different user", () => {
    expect(canInsertOrder(published, { auth_uid: "a" }, { ...valid(), customer_user_id: "b" }))
      .toBe(false);
  });
});

// Policy (order_items INSERT):
//   - price >= 0, quantity 1..10000, subtotal >= 0
//   - name length <= 300, variant_label length <= 200
//   - parent order exists on a published store, status = 'pending', created < 15 min ago
//   - same auth/customer_user_id rule as orders

export type OrderItemPayload = {
  price: number; quantity: number; subtotal: number;
  name: string; variant_label?: string | null;
};
export type ParentOrderState = {
  store_published: boolean;
  status: string;
  created_at_ms: number;
  customer_user_id: string | null;
};

export function canInsertOrderItem(
  parent: ParentOrderState,
  session: SessionState,
  item: OrderItemPayload,
  nowMs: number = Date.now(),
): boolean {
  if (item.price < 0 || item.subtotal < 0) return false;
  if (item.quantity <= 0 || item.quantity > 10000) return false;
  if (item.name.length > 300) return false;
  if ((item.variant_label ?? "").length > 200) return false;
  if (!parent.store_published) return false;
  if (parent.status !== "pending") return false;
  if (nowMs - parent.created_at_ms > 15 * 60 * 1000) return false;
  const uid = session.auth_uid;
  if (uid === null) return parent.customer_user_id === null;
  return parent.customer_user_id === null || parent.customer_user_id === uid;
}

describe("order_items INSERT policy (role matrix)", () => {
  const parentAnon: ParentOrderState = {
    store_published: true, status: "pending",
    created_at_ms: Date.now(), customer_user_id: null,
  };
  const item = { price: 100, quantity: 1, subtotal: 100, name: "Red Panjabi" };

  it("guest can insert items for their guest order", () => {
    expect(canInsertOrderItem(parentAnon, { auth_uid: null }, item)).toBe(true);
  });

  it("signed-in customer can insert items for their own order", () => {
    const uid = "cust-1";
    expect(canInsertOrderItem({ ...parentAnon, customer_user_id: uid }, { auth_uid: uid }, item))
      .toBe(true);
  });

  it("super admin / retailer signed-in flow can insert items for an anon-owned parent order", () => {
    expect(canInsertOrderItem(parentAnon, { auth_uid: "super-1" }, item)).toBe(true);
  });

  it("blocks quantity <= 0 or > 10000", () => {
    expect(canInsertOrderItem(parentAnon, { auth_uid: null }, { ...item, quantity: 0 })).toBe(false);
    expect(canInsertOrderItem(parentAnon, { auth_uid: null }, { ...item, quantity: 10001 })).toBe(false);
  });

  it("blocks parent order older than 15 minutes", () => {
    const stale = { ...parentAnon, created_at_ms: Date.now() - 16 * 60 * 1000 };
    expect(canInsertOrderItem(stale, { auth_uid: null }, item)).toBe(false);
  });

  it("blocks cross-user insert (parent belongs to another user)", () => {
    const p = { ...parentAnon, customer_user_id: "other" };
    expect(canInsertOrderItem(p, { auth_uid: "me" }, item)).toBe(false);
  });
});
