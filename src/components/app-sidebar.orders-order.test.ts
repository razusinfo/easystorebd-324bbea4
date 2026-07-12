import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Static regression: single-source sidebar declaration must list "Orders"
// directly above "Customers" in mainItems. Applies to every role/viewport.
describe("AppSidebar mainItems order", () => {
  const src = readFileSync(resolve(__dirname, "app-sidebar.tsx"), "utf8");

  it("declares Orders directly above Customers", () => {
    const match = src.match(/const mainItems = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const body = match![1];
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{"));
    const titles = lines.map((l) => {
      const m = l.match(/title:\s*"([^"]+)"/);
      return m ? m[1] : "";
    });
    const oi = titles.indexOf("Orders");
    const ci = titles.indexOf("Customers");
    expect(oi).toBeGreaterThan(-1);
    expect(ci).toBeGreaterThan(-1);
    expect(ci).toBe(oi + 1);
  });

  it("declares Orders exactly once", () => {
    const occurrences = src.match(/title:\s*"Orders"/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});
