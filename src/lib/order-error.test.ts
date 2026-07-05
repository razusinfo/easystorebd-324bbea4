import { describe, expect, it } from "vitest";
import { classifyOrderError, formatOrderError } from "./order-error";

describe("classifyOrderError", () => {
  it("maps Postgres 42501 to RLS violation", () => {
    expect(classifyOrderError({ code: "42501", message: "new row violates row-level security policy" }))
      .toBe("rls_violation");
  });

  it("maps missing-grant messages to missing_grant", () => {
    expect(classifyOrderError({ message: "permission denied for table orders" }))
      .toBe("missing_grant");
  });

  it("maps check constraint code 23514 to validation", () => {
    expect(classifyOrderError({ code: "23514", message: "check constraint failed" }))
      .toBe("validation");
  });

  it("maps 23503 foreign key to constraint", () => {
    expect(classifyOrderError({ code: "23503", message: "fk violation" })).toBe("constraint");
  });

  it("maps network errors", () => {
    expect(classifyOrderError({ message: "Failed to fetch" })).toBe("network");
  });

  it("returns unknown for empty error", () => {
    expect(classifyOrderError(null)).toBe("unknown");
    expect(classifyOrderError(undefined)).toBe("unknown");
  });
});

describe("formatOrderError", () => {
  it("uses stage-specific title for RLS on order insert", () => {
    const r = formatOrderError(
      { code: "42501", message: "new row violates row-level security policy for table \"orders\"" },
      "order",
    );
    expect(r.kind).toBe("rls_violation");
    expect(r.title).toMatch(/blocked by store access rules/i);
    expect(r.description).toContain("[42501]");
  });

  it("uses stage-specific title for RLS on items insert", () => {
    const r = formatOrderError({ code: "42501", message: "rls" }, "items");
    expect(r.title).toMatch(/items blocked/i);
  });

  it("includes details and hint in description", () => {
    const r = formatOrderError(
      { code: "23514", message: "check failed", details: "quantity > 10000", hint: "reduce qty" },
      "order",
    );
    expect(r.description).toContain("check failed");
    expect(r.description).toContain("quantity > 10000");
    expect(r.description).toContain("reduce qty");
  });

  it("falls back to generic title when kind is unknown", () => {
    const r = formatOrderError({ message: "boom" }, "order");
    expect(r.title).toMatch(/could not place order/i);
  });
});
