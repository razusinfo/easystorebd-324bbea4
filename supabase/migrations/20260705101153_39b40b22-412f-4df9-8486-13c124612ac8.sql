DROP POLICY IF EXISTS "Authenticated users can view reseller products" ON public.reseller_products;

CREATE POLICY "Resellers and admins can view reseller products"
ON public.reseller_products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'store_owner')
  OR public.has_role(auth.uid(), 'super_admin')
);