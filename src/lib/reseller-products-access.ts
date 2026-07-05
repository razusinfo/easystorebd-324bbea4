/**
 * Access control helpers for public.reseller_products.
 *
 * Mirrors the RLS SELECT policy created in migration
 * 20260705101153_39b40b22-412f-4df9-8486-13c124612ac8.sql
 * ("Resellers and admins can view reseller products"):
 *
 *   USING (
 *     public.has_role(auth.uid(), 'store_owner') OR
 *     public.has_role(auth.uid(), 'super_admin')
 *   )
 *
 * Use `canReadResellerProducts` in the client to gate UI (and to power the
 * internal role-visibility verification page), and use the regression tests
 * in `reseller-products-access.test.ts` to lock the policy contract.
 */

export type AppRole =
  | "store_owner"
  | "super_admin"
  | "reseller"
  | "customer"
  | "moderator"
  | "user"
  | string;

export const RESELLER_PRODUCTS_ALLOWED_ROLES: readonly AppRole[] = [
  "store_owner",
  "super_admin",
] as const;

export function canReadResellerProducts(
  roles: readonly (AppRole | null | undefined)[] | null | undefined,
): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(
    (r) => r === "store_owner" || r === "super_admin",
  );
}

/**
 * Reseller (buy/cost) price is only visible to store owners and super admins.
 * Customers/anon must never see the reseller_price field.
 */
export function canSeeResellerPrice(
  roles: readonly (AppRole | null | undefined)[] | null | undefined,
): boolean {
  return canReadResellerProducts(roles);
}
