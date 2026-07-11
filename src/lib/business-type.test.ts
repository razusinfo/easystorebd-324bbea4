import { describe, it, expect } from "vitest";
import { BUSINESS_TYPES, businessTypeLabel } from "./eazystore-data";

describe("Business Type — A to Z option", () => {
  it("appears first in the shared BUSINESS_TYPES list", () => {
    expect(BUSINESS_TYPES[0]).toBe("A to Z");
  });

  it("has a bilingual English + Bangla label", () => {
    const label = businessTypeLabel("A to Z");
    expect(label).toContain("A to Z");
    expect(label).toContain("সবকিছু");
  });

  it("is a valid Category type usable by registration and manage-shop", () => {
    // Type-level check: assignable to Category (compile-time via `as const`).
    const value: (typeof BUSINESS_TYPES)[number] = "A to Z";
    expect(BUSINESS_TYPES.includes(value)).toBe(true);
  });

  it("falls back to the raw value when no label is defined", () => {
    expect(businessTypeLabel("Unknown Custom Type")).toBe("Unknown Custom Type");
  });
});
