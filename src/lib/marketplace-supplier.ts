// Shared supplier-name normalization for the Supplier Marketplace and the
// legacy Reseller Products page. Keep this file free of React / server deps
// so it can be imported from both client and server code.

export const PRIMARY_SUPPLIER = "Sylheti Online Shop";
export const NUSRAT_SUPPLIER = "Nusrat Telecom";

const INTERNAL_SOURCES = new Set([
  "trigger",
  "internal",
  "sylheti",
  "sylheti online shop",
]);

const NUSRAT_SOURCES = new Set([
  "hisabnikas",
  "hisabnikas-24",
  "hisab-nikas",
  "hisab-nikas-24",
  "hisab nikas",
  "hisab nikas-24",
  "nusrat",
  "nusrat telecom",
]);

export function normalizeSupplier(source: string | null | undefined): string {
  const s = (source ?? "").trim();
  if (!s || INTERNAL_SOURCES.has(s.toLowerCase())) return PRIMARY_SUPPLIER;
  if (NUSRAT_SOURCES.has(s.toLowerCase())) return NUSRAT_SUPPLIER;
  return s;
}
