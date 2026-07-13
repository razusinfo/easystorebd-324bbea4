-- Restrict EXECUTE on SECURITY DEFINER functions from public/anon
REVOKE EXECUTE ON FUNCTION public.check_subdomain_available(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_subdomain_available(text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_reseller_site_from_store() FROM PUBLIC, anon, authenticated;
-- Trigger functions run as table owner; keep only service_role for maintenance.
GRANT EXECUTE ON FUNCTION public.sync_reseller_site_from_store() TO service_role;

-- Tighten the always-true INSERT policy on oauth_error_logs with concrete constraints
DROP POLICY IF EXISTS "anyone can log oauth errors" ON public.oauth_error_logs;
CREATE POLICY "anyone can log oauth errors"
  ON public.oauth_error_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    provider IN ('google','apple','email')
    AND coalesce(length(message), 0) <= 2000
    AND coalesce(length(host), 0) <= 253
    AND coalesce(length(redirect_uri), 0) <= 2048
    AND coalesce(length(user_agent), 0) <= 1000
    AND coalesce(length(path), 0) <= 2048
    AND coalesce(length(tenant_slug), 0) <= 128
    AND coalesce(length(status_hint), 0) <= 64
  );