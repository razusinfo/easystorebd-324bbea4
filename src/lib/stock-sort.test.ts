// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import {
  computeIsOutOfStock,
  sortByCategoryWithOutOfStockLast,
  sortOutOfStockToBottom,
} from "./stock-sync-core";

type Row = { id: string; stock: number; category: string; created_at: string };

// Low-stock threshold is 3, so stock <= 3 is treated as "out of stock"
// for marketplace display and sorting purposes.
const rows: Row[] = [
  { id: "a", stock: 5,  category: "Phones", created_at: "2026-01-05" },
  { id: "b", stock: 0,  category: "Phones", created_at: "2026-01-04" },
  { id: "c", stock: 2,  category: "Phones", created_at: "2026-01-03" }, // low-stock
  { id: "d", stock: 0,  category: "Bags",   created_at: "2026-01-02" },
  { id: "e", stock: 7,  category: "Bags",   created_at: "2026-01-01" },
];

describe("sortOutOfStockToBottom (within a single category tab)", () => {
  it("moves stock<=3 to the bottom, preserving original order elsewhere", () => {
    const only = rows.filter((r) => r.category === "Phones");
    // a in-stock stays first; b (0) and c (2) both OOS, order preserved.
    expect(sortOutOfStockToBottom(only).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("is a no-op when every row is above the threshold", () => {
    const inStock = [
      { id: "x", stock: 10 },
      { id: "y", stock: 4 },
    ];
    expect(sortOutOfStockToBottom(inStock).map((r) => r.id)).toEqual(["x", "y"]);
  });
});

describe("sortByCategoryWithOutOfStockLast (whole list / storefront)", () => {
  it("keeps items within their original category and pushes low-stock to the bottom of each", () => {
    const out = sortByCategoryWithOutOfStockLast(rows).map((r) => `${r.category}:${r.id}`);
    expect(out).toEqual([
      "Phones:a", "Phones:b", "Phones:c",
      "Bags:e", "Bags:d",
    ]);
  });

  it("never lets a low-stock row cross into a different category", () => {
    const sorted = sortByCategoryWithOutOfStockLast(rows);
    expect(sorted.find((r) => r.id === "c")?.category).toBe("Phones");
    expect(sorted.find((r) => r.id === "d")?.category).toBe("Bags");
    const phones = sorted.filter((r) => r.category === "Phones");
    const bags = sorted.filter((r) => r.category === "Bags");
    expect(phones.at(-1)!.id).toBe("c");
    expect(bags.at(-1)!.id).toBe("d");
  });
});

describe("pagination stability", () => {
  function paged<T>(all: T[], perPage: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < all.length; i += perPage) out.push(all.slice(i, i + perPage));
    return out;
  }

  it("keeps low-stock at the very bottom across page boundaries and never repeats a row", () => {
    const big: Row[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`, stock: 20 - i, category: "Phones",
        created_at: `2026-02-${String(20 - i).padStart(2, "0")}`,
      })),
      { id: "oos1", stock: 0, category: "Phones", created_at: "2026-02-15" },
      { id: "oos2", stock: 2, category: "Bags",   created_at: "2026-02-14" },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `b${i}`, stock: 15 - i, category: "Bags",
        created_at: `2026-02-${String(10 - i).padStart(2, "0")}`,
      })),
    ];
    const ordered = [...big].sort((a, b) => {
      const ao = computeIsOutOfStock(a.stock) ? 1 : 0;
      const bo = computeIsOutOfStock(b.stock) ? 1 : 0;
      if (ao !== bo) return ao - bo;
      return b.created_at.localeCompare(a.created_at);
    });

    const pages = paged(ordered, 4);
    const flat = pages.flat().map((r) => r.id);
    expect(new Set(flat).size).toBe(flat.length);

    const oosIds = ordered.filter((r) => computeIsOutOfStock(r.stock)).map((r) => r.id);
    const lastPageIds = pages.at(-1)!.map((r) => r.id);
    for (const id of oosIds) expect(lastPageIds).toContain(id);

    const firstOosIdx = ordered.findIndex((r) => computeIsOutOfStock(r.stock));
    expect(ordered.slice(firstOosIdx).every((r) => computeIsOutOfStock(r.stock))).toBe(true);
  });
});

describe("is_out_of_stock stays in sync with stock changes", () => {
  it("mirrors the DB generated column formula (stock <= 3)", () => {
    expect(computeIsOutOfStock(10)).toBe(false);
    expect(computeIsOutOfStock(4)).toBe(false);
    expect(computeIsOutOfStock(3)).toBe(true);
    expect(computeIsOutOfStock(0)).toBe(true);
    expect(computeIsOutOfStock(null)).toBe(true);
    expect(computeIsOutOfStock(undefined)).toBe(true);
  });

  it("re-sorts immediately when a decrement drops stock at/below the threshold", () => {
    const list: Row[] = [
      { id: "a", stock: 10, category: "C", created_at: "1" },
      { id: "b", stock: 4,  category: "C", created_at: "2" },
      { id: "c", stock: 8,  category: "C", created_at: "3" },
    ];
    expect(sortOutOfStockToBottom(list).map((r) => r.id)).toEqual(["a", "b", "c"]);
    // Sale drops "b" from 4 to 2 — now within the low-stock band.
    const after = list.map((r) => (r.id === "b" ? { ...r, stock: 2 } : r));
    expect(sortOutOfStockToBottom(after).map((r) => r.id)).toEqual(["a", "c", "b"]);
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
