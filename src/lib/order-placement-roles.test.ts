import { describe, expect, it } from "vitest";
import {
  canInsertOrder,
  type OrderInsertPayload,
  type StoreState,
  type SessionState,
} from "./order-placement-rls.test";

// End-to-end style role coverage for the Place Order flow. Verifies the
// insert policy model allows all three checkout scenarios shoppers hit on
// customer, super-admin, and retailer storefronts.

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
    expect(canInsertOrder(publishedStore, { auth_uid: null } as SessionState, basePayload)).toBe(true);
  });

  it("super admin site (signed-in shopper) can insert without customer_user_id", () => {
    expect(canInsertOrder(publishedStore, { auth_uid: "super-admin-uid" }, basePayload)).toBe(true);
  });

  it("retailer site (signed-in shopper) can insert with matching customer_user_id", () => {
    const uid = "retailer-shopper-uid";
    expect(
      canInsertOrder(publishedStore, { auth_uid: uid }, { ...basePayload, customer_user_id: uid }),
    ).toBe(true);
  });

  it("blocks insert when customer_user_id belongs to another user", () => {
    expect(
      canInsertOrder(publishedStore, { auth_uid: "me" }, { ...basePayload, customer_user_id: "someone-else" }),
    ).toBe(false);
  });

  it("blocks insert on unpublished stores", () => {
    expect(canInsertOrder({ published: false }, { auth_uid: null }, basePayload)).toBe(false);
  });
});
