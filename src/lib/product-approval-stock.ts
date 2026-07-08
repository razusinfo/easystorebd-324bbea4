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
 * No safety buffer is applied at approval time — the admin-entered or
 * supplier-reported quantity is published as-is.
 */
export const APPROVAL_STOCK_BUFFER = 0;

export function resolveApprovalStock(input: {
  adminStock: number | null | undefined;
  sourceProductId?: string | null;
  sourceStock?: number | null;
  fallbackStock?: number;
}): ApprovalStockResolution {
  const requestedStock = toNonNegativeInteger(input.adminStock) ?? input.fallbackStock ?? 100;
  const sourceStock = toNonNegativeInteger(input.sourceStock);
  const baseStock = sourceStock ?? requestedStock;
  const finalStock = Math.max(0, baseStock);

  return {
    requestedStock,
    finalStock,
    sourceProductId: input.sourceProductId ?? null,
    sourceStock,
  };
}
