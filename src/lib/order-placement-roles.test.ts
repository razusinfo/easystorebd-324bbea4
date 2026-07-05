import { describe, expect, it } from "vitest";
import { canInsertOrder, type OrderInsertPayload, type StoreState, type SessionState } from "./order-placement-rls.test";

// End-to-end style role coverage for the Place Order flow. Verifies the
// insert policy model allows all three checkout scenarios that shoppers hit
// on customer, super-admin, and retailer storefronts.

const basePayload: OrderInsertPayload = {
  status: "pending",
  payment_status: "unpaid",
  customer_name: "Test Customer",
  customer_phone: "01700000000",
  subtotal: 100,
  delivery_charge: 60,
  discount: 0,
  total: 160,
  customer_user_id: null,
};

const publishedStore: StoreState = { published: true };

describe("Place order — role flows", () => {
  it("customer (anonymous) can insert into orders on a published store", () => {
    const res = canInsertOrder(basePayload, publishedStore, { auth_uid: null } as SessionState);
    expect(res.ok).toBe(true);
  });

  it("super admin site (signed-in shopper) can insert without customer_user_id", () => {
    const res = canInsertOrder(basePayload, publishedStore, { auth_uid: "super-admin-uid" });
    expect(res.ok).toBe(true);
  });

  it("retailer site (signed-in shopper) can insert with matching customer_user_id", () => {
    const uid = "retailer-shopper-uid";
    const res = canInsertOrder(
      { ...basePayload, customer_user_id: uid },
      publishedStore,
      { auth_uid: uid },
    );
    expect(res.ok).toBe(true);
  });

  it("blocks insert when customer_user_id belongs to another user", () => {
    const res = canInsertOrder(
      { ...basePayload, customer_user_id: "someone-else" },
      publishedStore,
      { auth_uid: "me" },
    );
    expect(res.ok).toBe(false);
  });

  it("blocks insert on unpublished stores", () => {
    const res = canInsertOrder(basePayload, { published: false }, { auth_uid: null });
    expect(res.ok).toBe(false);
  });
});
