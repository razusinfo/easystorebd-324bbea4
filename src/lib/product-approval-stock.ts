export type ApprovalStockSource = {
  sourceProductId: string | null;
  sourceStock: number | null;
};

export type ApprovalStockResolution = ApprovalStockSource & {
  requestedStock: number;
  finalStock: number;
};

function toNonNegativeInteger(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

/**
 * On approval, we intentionally hold back a small buffer from the supplier's
 * stated stock so the marketplace never oversells while syncs are in flight.
 */
export const APPROVAL_STOCK_BUFFER = 5;

export function resolveApprovalStock(input: {
  adminStock: number | null | undefined;
  sourceProductId?: string | null;
  sourceStock?: number | null;
  fallbackStock?: number;
}): ApprovalStockResolution {
  const requestedStock = toNonNegativeInteger(input.adminStock) ?? input.fallbackStock ?? 100;
  const sourceStock = toNonNegativeInteger(input.sourceStock);
  const baseStock = sourceStock ?? requestedStock;
  const finalStock = Math.max(0, baseStock - APPROVAL_STOCK_BUFFER);

  return {
    requestedStock,
    finalStock,
    sourceProductId: input.sourceProductId ?? null,
    sourceStock,
  };
}
