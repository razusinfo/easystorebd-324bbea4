GRANT INSERT ON public.admin_notifications TO authenticated;

CREATE POLICY "Authenticated can insert reseller site notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (type IN ('reseller_site_created', 'reseller_site_changed'));