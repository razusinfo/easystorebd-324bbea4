import { describe, it, expect } from "vitest";
import {
  canReadResellerProducts,
  canSeeResellerPrice,
  RESELLER_PRODUCTS_ALLOWED_ROLES,
} from "./reseller-products-access";

describe("reseller_products access policy (regression)", () => {
  it("allows store_owner", () => {
    expect(canReadResellerProducts(["store_owner"])).toBe(true);
    expect(canSeeResellerPrice(["store_owner"])).toBe(true);
  });

  it("allows super_admin", () => {
    expect(canReadResellerProducts(["super_admin"])).toBe(true);
    expect(canSeeResellerPrice(["super_admin"])).toBe(true);
  });

  it("allows a user holding both roles", () => {
    expect(canReadResellerProducts(["store_owner", "super_admin"])).toBe(true);
  });

  it("denies anonymous / no session (empty or null roles)", () => {
    expect(canReadResellerProducts(null)).toBe(false);
    expect(canReadResellerProducts(undefined)).toBe(false);
    expect(canReadResellerProducts([])).toBe(false);
    expect(canSeeResellerPrice(null)).toBe(false);
  });

  it("denies plain customers", () => {
    expect(canReadResellerProducts(["customer"])).toBe(false);
    expect(canSeeResellerPrice(["customer"])).toBe(false);
  });

  it("denies other non-privileged roles", () => {
    for (const r of ["reseller", "moderator", "user", "guest", "random"]) {
      expect(canReadResellerProducts([r])).toBe(false);
      expect(canSeeResellerPrice([r])).toBe(false);
    }
  });

  it("denies when only null/undefined entries are present", () => {
    expect(canReadResellerProducts([null, undefined])).toBe(false);
  });

  it("exposes the allowed-role list as store_owner + super_admin only", () => {
    expect([...RESELLER_PRODUCTS_ALLOWED_ROLES].sort()).toEqual(
      ["store_owner", "super_admin"].sort(),
    );
  });
});
