
-- Allow super admins to write to marketplace audit logs and grant Data API access.
GRANT SELECT, INSERT ON public.reseller_marketplace_audit_logs TO authenticated;
GRANT ALL ON public.reseller_marketplace_audit_logs TO service_role;

DROP POLICY IF EXISTS "Super admins can insert marketplace audit logs" ON public.reseller_marketplace_audit_logs;
CREATE POLICY "Super admins can insert marketplace audit logs"
ON public.reseller_marketplace_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  AND actor_id = auth.uid()
);
