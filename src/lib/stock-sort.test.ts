// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import {
  computeIsOutOfStock,
  sortByCategoryWithOutOfStockLast,
  sortOutOfStockToBottom,
} from "./stock-sync-core";

type Row = { id: string; stock: number; category: string; created_at: string };

const rows: Row[] = [
  { id: "a", stock: 5, category: "Phones", created_at: "2026-01-05" },
  { id: "b", stock: 0, category: "Phones", created_at: "2026-01-04" },
  { id: "c", stock: 2, category: "Phones", created_at: "2026-01-03" },
  { id: "d", stock: 0, category: "Bags", created_at: "2026-01-02" },
  { id: "e", stock: 7, category: "Bags", created_at: "2026-01-01" },
];

describe("sortOutOfStockToBottom (within a single category tab)", () => {
  it("moves stock<=0 to the bottom, preserving original order elsewhere", () => {
    const only = rows.filter((r) => r.category === "Phones");
    expect(sortOutOfStockToBottom(only).map((r) => r.id)).toEqual(["a", "c", "b"]);
  });
  it("is a no-op when nothing is out of stock", () => {
    const inStock = [
      { id: "x", stock: 1 },
      { id: "y", stock: 2 },
    ];
    expect(sortOutOfStockToBottom(inStock).map((r) => r.id)).toEqual(["x", "y"]);
  });
});

describe("sortByCategoryWithOutOfStockLast (whole list / storefront)", () => {
  it("keeps items within their original category and pushes 0-stock to the bottom of each", () => {
    const out = sortByCategoryWithOutOfStockLast(rows).map((r) => `${r.category}:${r.id}`);
    // Phones group emitted before Bags (source order), and inside each the
    // out-of-stock row sinks to the bottom.
    expect(out).toEqual([
      "Phones:a", "Phones:c", "Phones:b",
      "Bags:e", "Bags:d",
    ]);
  });

  it("never lets an out-of-stock row cross into a different category", () => {
    const sorted = sortByCategoryWithOutOfStockLast(rows);
    // Every "b" and "d" (the OOS items) still sit in their original category.
    expect(sorted.find((r) => r.id === "b")?.category).toBe("Phones");
    expect(sorted.find((r) => r.id === "d")?.category).toBe("Bags");
    // ...and they are the LAST row of their category.
    const phones = sorted.filter((r) => r.category === "Phones");
    const bags = sorted.filter((r) => r.category === "Bags");
    expect(phones.at(-1)!.id).toBe("b");
    expect(bags.at(-1)!.id).toBe("d");
  });
});

describe("pagination stability", () => {
  // Reproduces the server-side ordering used by useMyProductsPaged /
  // storefront.functions.ts: ORDER BY is_out_of_stock ASC, created_at DESC.
  // A DB-equivalent sort must not reshuffle categories or duplicate rows
  // between pages.
  function paged<T>(all: T[], perPage: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < all.length; i += perPage) out.push(all.slice(i, i + perPage));
    return out;
  }

  it("keeps OOS at the very bottom across page boundaries and never repeats a row", () => {
    const big: Row[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`, stock: 10 - i, category: "Phones",
        created_at: `2026-02-${String(20 - i).padStart(2, "0")}`,
      })),
      { id: "oos1", stock: 0, category: "Phones", created_at: "2026-02-15" },
      { id: "oos2", stock: 0, category: "Bags",   created_at: "2026-02-14" },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `b${i}`, stock: 4 - i, category: "Bags",
        created_at: `2026-02-${String(10 - i).padStart(2, "0")}`,
      })),
    ];
    // Simulate the DB order: is_out_of_stock ASC, created_at DESC.
    const ordered = [...big].sort((a, b) => {
      const ao = computeIsOutOfStock(a.stock) ? 1 : 0;
      const bo = computeIsOutOfStock(b.stock) ? 1 : 0;
      if (ao !== bo) return ao - bo;
      return b.created_at.localeCompare(a.created_at);
    });

    const pages = paged(ordered, 4);
    // No duplicates across pages.
    const flat = pages.flat().map((r) => r.id);
    expect(new Set(flat).size).toBe(flat.length);
    // Every OOS row is in the FINAL page (i.e. bottom of the overall list).
    const oosIds = ordered.filter((r) => r.stock === 0).map((r) => r.id);
    const lastPageIds = pages.at(-1)!.map((r) => r.id);
    for (const id of oosIds) expect(lastPageIds).toContain(id);
    // No in-stock row appears after any OOS row.
    const firstOosIdx = ordered.findIndex((r) => r.stock === 0);
    expect(ordered.slice(firstOosIdx).every((r) => r.stock === 0)).toBe(true);
  });
});

describe("is_out_of_stock stays in sync with stock changes", () => {
  it("mirrors the DB generated column formula (stock <= 0)", () => {
    expect(computeIsOutOfStock(5)).toBe(false);
    expect(computeIsOutOfStock(1)).toBe(false);
    expect(computeIsOutOfStock(0)).toBe(true);
    expect(computeIsOutOfStock(null)).toBe(true);
    expect(computeIsOutOfStock(undefined)).toBe(true);
  });

  it("re-sorts immediately when a decrement drops stock to 0", () => {
    const list: Row[] = [
      { id: "a", stock: 3, category: "C", created_at: "1" },
      { id: "b", stock: 1, category: "C", created_at: "2" },
      { id: "c", stock: 5, category: "C", created_at: "3" },
    ];
    // Before: no OOS.
    expect(sortOutOfStockToBottom(list).map((r) => r.id)).toEqual(["a", "b", "c"]);
    // Sale decrements "b" by 1 → 0. Same list, new stock value.
    const after = list.map((r) => (r.id === "b" ? { ...r, stock: 0 } : r));
    expect(sortOutOfStockToBottom(after).map((r) => r.id)).toEqual(["a", "c", "b"]);
    // And the derived flag flips.
    expect(computeIsOutOfStock(after.find((r) => r.id === "b")!.stock)).toBe(true);
  });
});

describe("server-side query uses is_out_of_stock first", () => {
  const read = (p: string) =>
    fs.readFileSync(new URL(p, import.meta.url), "utf8");

  it("useMyProductsPaged orders by is_out_of_stock ASC, then created_at DESC", () => {
    const src = read("../lib/eazystore-data.ts");
    // Ensure the OOS order call comes before the created_at order call.
    const oosIdx = src.indexOf('.order("is_out_of_stock"');
    const createdIdx = src.indexOf('.order("created_at"', oosIdx);
    expect(oosIdx).toBeGreaterThan(-1);
    expect(createdIdx).toBeGreaterThan(oosIdx);
    expect(src).toContain('.order("is_out_of_stock", { ascending: true })');
  });

  it("storefront products list orders OOS to the bottom", () => {
    const src = read("../lib/storefront.functions.ts");
    expect(src).toContain('.order("is_out_of_stock", { ascending: true })');
    const oosIdx = src.indexOf('.order("is_out_of_stock"');
    const createdIdx = src.indexOf('.order("created_at"', oosIdx);
    expect(createdIdx).toBeGreaterThan(oosIdx);
  });
});
