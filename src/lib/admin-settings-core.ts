// Pure core for admin-configurable Low Stock Threshold. The value is
// persisted in `site_settings` under key `low_stock_threshold`; a server
// function reads it once at boot / on change and calls `setLowStockThreshold`.

import { DEFAULT_LOW_STOCK_THRESHOLD, setLowStockThreshold } from "./stock-sync-core";

export const LOW_STOCK_THRESHOLD_KEY = "low_stock_threshold";

/** Parse a raw setting value into a safe threshold (>=0 integer). */
export function parseLowStockThreshold(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LOW_STOCK_THRESHOLD;
  return Math.floor(n);
}

/** Apply a persisted setting to the in-process threshold. */
export function applyLowStockThresholdSetting(raw: unknown): number {
  const n = parseLowStockThreshold(raw);
  setLowStockThreshold(n);
  return n;
}
