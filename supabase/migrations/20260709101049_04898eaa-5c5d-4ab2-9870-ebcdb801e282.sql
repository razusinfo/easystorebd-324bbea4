DROP POLICY IF EXISTS "Anyone authenticated can read category mappings" ON public.reseller_category_mappings;
CREATE POLICY "Store owners and admins can read category mappings"
ON public.reseller_category_mappings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'store_owner') OR public.has_role(auth.uid(), 'super_admin'));