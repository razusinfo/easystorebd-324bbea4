
-- 1. Revoke anon EXECUTE on record_reseller_site_event (SECURITY DEFINER function that authorizes the caller via auth.uid()).
REVOKE EXECUTE ON FUNCTION public.record_reseller_site_event(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_reseller_site_event(text, uuid, text) TO authenticated;

-- 2. admin_notifications: remove the permissive INSERT policy that lets any authenticated user post to the admin inbox.
--    Site-event notifications must now go through the SECURITY DEFINER RPC record_reseller_site_event, which verifies
--    the caller owns the referenced store (or is super_admin).
DROP POLICY IF EXISTS "Authenticated can insert reseller site notifications" ON public.admin_notifications;

-- 3. order_tracking_events: lock down writes to trusted server-side/service-role logic. Add explicit restrictive
--    no-op policies so a future permissive policy cannot accidentally grant client writes.
CREATE POLICY "Block client writes to order tracking events - insert"
  ON public.order_tracking_events AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "Block client writes to order tracking events - update"
  ON public.order_tracking_events AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "Block client writes to order tracking events - delete"
  ON public.order_tracking_events AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);

-- 4. reseller_order_events: same fail-closed restrictive policies.
CREATE POLICY "Block client writes to reseller order events - insert"
  ON public.reseller_order_events AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "Block client writes to reseller order events - update"
  ON public.reseller_order_events AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "Block client writes to reseller order events - delete"
  ON public.reseller_order_events AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);

-- 5. user_roles: explicitly block client-side role writes. Role assignment must go through the
--    admin_assign_role / admin_revoke_role SECURITY DEFINER RPCs, which enforce super_admin.
CREATE POLICY "Block client writes to user roles - insert"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "Block client writes to user roles - update"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "Block client writes to user roles - delete"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);
