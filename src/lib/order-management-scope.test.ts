import { describe, expect, it } from "vitest";
import { assertSupplierScope, decideOrderScope } from "./order-management.functions";

describe("decideOrderScope (fail-closed role detection)", () => {
  it("returns super_admin scope when the RPC returns true and no error", () => {
    const decision = decideOrderScope("user-1", { data: true, error: null });
    expect(decision).toEqual({ role: "super_admin", scopeToUserId: null });
  });

  it("defaults to supplier scope when the RPC returns false", () => {
    const decision = decideOrderScope("user-1", { data: false, error: null });
    expect(decision).toEqual({ role: "supplier", scopeToUserId: "user-1" });
  });

  it("defaults to supplier scope when the RPC errors (fail closed)", () => {
    const decision = decideOrderScope("user-1", {
      data: null,
      error: new Error("rpc down"),
    });
    expect(decision).toEqual({ role: "supplier", scopeToUserId: "user-1" });
  });

  it("defaults to supplier scope for any non-true data value", () => {
    for (const value of [null, undefined, 1, "true", {}]) {
      const decision = decideOrderScope("user-1", { data: value, error: null });
      expect(decision.role).toBe("supplier");
      if (decision.role === "supplier") expect(decision.scopeToUserId).toBe("user-1");
    }
  });

  it("throws when userId is missing — never returns an unscoped decision", () => {
    expect(() => decideOrderScope(null, { data: true, error: null })).toThrow(/Forbidden/);
    expect(() => decideOrderScope(undefined, { data: false, error: null })).toThrow(/Forbidden/);
    expect(() => decideOrderScope("", { data: false, error: null })).toThrow(/Forbidden/);
  });
});

describe("assertSupplierScope (defense-in-depth)", () => {
  it("allows an empty result set", () => {
    expect(() => assertSupplierScope([], "user-1")).not.toThrow();
  });

  it("passes when every row belongs to the caller", () => {
    expect(() =>
      assertSupplierScope(
        [{ reseller_id: "user-1" }, { reseller_id: "user-1" }],
        "user-1",
      ),
    ).not.toThrow();
  });

  it("throws on the first row that belongs to a different user", () => {
    expect(() =>
      assertSupplierScope(
        [{ reseller_id: "user-1" }, { reseller_id: "user-2" }],
        "user-1",
      ),
    ).toThrow(/scope violation/);
  });

  it("throws when reseller_id is null (RLS should hide it; assert catches regressions)", () => {
    expect(() =>
      assertSupplierScope([{ reseller_id: null }], "user-1"),
    ).toThrow(/scope violation/);
  });

  it("throws when reseller_id is undefined or the wrong type", () => {
    expect(() =>
      assertSupplierScope([{ reseller_id: undefined }], "user-1"),
    ).toThrow(/scope violation/);
    expect(() =>
      assertSupplierScope([{ reseller_id: 1 as unknown }], "user-1"),
    ).toThrow(/scope violation/);
  });
});

describe("supplier scope end-to-end (decide + assert)", () => {
  it("scopes to the caller and accepts only their rows", () => {
    const decision = decideOrderScope("supplier-a", { data: false, error: null });
    if (decision.role !== "supplier") throw new Error("expected supplier");
    const rows = [
      { reseller_id: "supplier-a", id: "o1" },
      { reseller_id: "supplier-a", id: "o2" },
    ];
    expect(() => assertSupplierScope(rows, decision.scopeToUserId)).not.toThrow();
  });

  it("rejects rows that belong to another supplier even if RLS misbehaves", () => {
    const decision = decideOrderScope("supplier-a", { data: false, error: null });
    if (decision.role !== "supplier") throw new Error("expected supplier");
    const rows = [
      { reseller_id: "supplier-a", id: "o1" },
      { reseller_id: "supplier-b", id: "o2" },
    ];
    expect(() => assertSupplierScope(rows, decision.scopeToUserId)).toThrow(
      /scope violation/,
    );
  });

  it("empty result set is a valid outcome for a supplier with no orders", () => {
    const decision = decideOrderScope("supplier-a", { data: false, error: null });
    if (decision.role !== "supplier") throw new Error("expected supplier");
    expect(() => assertSupplierScope([], decision.scopeToUserId)).not.toThrow();
  });
});
