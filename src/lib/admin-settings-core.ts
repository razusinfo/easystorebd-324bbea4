// Pure core for admin-configurable Low Stock Threshold. The value is
// persisted in `site_settings` under key `low_stock_threshold`; a server
// function reads it once at boot / on change and calls `setLowStockThreshold`.

import { DEFAULT_LOW_STOCK_THRESHOLD, setLowStockThreshold } from "./stock-sync-core";

export const LOW_STOCK_THRESHOLD_KEY = "low_stock_threshold";
export const LOW_STOCK_THRESHOLD_MIN = 0;
export const LOW_STOCK_THRESHOLD_MAX = 1000;

export class InvalidLowStockThresholdError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "InvalidLowStockThresholdError";
  }
}

/**
 * Strict validator for user-submitted values (server + UI form submission).
 * Rejects non-numbers, negatives, non-integers, and values above MAX.
 */
export function validateLowStockThreshold(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") {
    throw new InvalidLowStockThresholdError("Low Stock Threshold is required");
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    throw new InvalidLowStockThresholdError("Low Stock Threshold must be a number");
  }
  if (!Number.isInteger(n)) {
    throw new InvalidLowStockThresholdError("Low Stock Threshold must be a whole number");
  }
  if (n < LOW_STOCK_THRESHOLD_MIN) {
    throw new InvalidLowStockThresholdError(`Low Stock Threshold must be ≥ ${LOW_STOCK_THRESHOLD_MIN}`);
  }
  if (n > LOW_STOCK_THRESHOLD_MAX) {
    throw new InvalidLowStockThresholdError(`Low Stock Threshold must be ≤ ${LOW_STOCK_THRESHOLD_MAX}`);
  }
  return n;
}

/**
 * Lenient parser for values coming from the DB / storage: falls back to the
 * default rather than throwing, so a corrupt row can't break the app.
 */
export function parseLowStockThreshold(raw: unknown): number {
  try {
    return validateLowStockThreshold(raw);
  } catch {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }
}

/** Apply a persisted setting to the in-process threshold. */
export function applyLowStockThresholdSetting(raw: unknown): number {
  const n = parseLowStockThreshold(raw);
  setLowStockThreshold(n);
  return n;
}
