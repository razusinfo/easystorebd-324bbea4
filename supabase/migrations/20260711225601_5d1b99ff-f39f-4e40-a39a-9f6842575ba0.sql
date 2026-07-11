
DROP POLICY IF EXISTS "System inserts forward audit" ON public.reseller_order_forward_audit;
CREATE POLICY "Super admins insert forward audit"
  ON public.reseller_order_forward_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
