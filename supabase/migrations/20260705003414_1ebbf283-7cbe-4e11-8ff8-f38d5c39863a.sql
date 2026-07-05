
-- 1) reseller_products: replace permissive SELECT with role-scoped policy
DROP POLICY IF EXISTS "Authenticated users can view reseller products" ON public.reseller_products;
CREATE POLICY "Store owners and admins can view reseller products"
  ON public.reseller_products
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'store_owner'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 2) notification_settings: restrict SELECT to super admins
DROP POLICY IF EXISTS "Any authenticated can read notification settings" ON public.notification_settings;
CREATE POLICY "Super admins can read notification settings"
  ON public.notification_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Lock down SECURITY DEFINER functions from public/anon/authenticated.
-- Trigger functions never need EXECUTE from API roles; the admin revoke
-- function is invoked from server-side code using the service role.
REVOKE EXECUTE ON FUNCTION public.sync_reseller_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.charge_reseller_wallet_on_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_reseller_product(uuid, text) FROM PUBLIC, anon, authenticated;
