
-- 1. Column-level lockdown: no direct PostgREST read of cost/reseller pricing.
REVOKE SELECT (buying_price, reseller_price) ON public.products FROM anon;
REVOKE SELECT (buying_price, reseller_price) ON public.products FROM authenticated;
GRANT  SELECT (buying_price, reseller_price) ON public.products TO service_role;

-- 2. Owner/admin-only helper that returns full product rows (including the
--    revoked columns) for the store the caller owns or for super_admins.
CREATE OR REPLACE FUNCTION public.get_owner_products_full(_store_id uuid)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.products p
  WHERE p.store_id = _store_id
    AND (
      EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = _store_id AND s.owner_user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_owner_products_full(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_owner_products_full(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_owner_products_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_products_full(uuid) TO service_role;
