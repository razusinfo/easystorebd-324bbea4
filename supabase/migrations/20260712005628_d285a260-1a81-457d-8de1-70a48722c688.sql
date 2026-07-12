-- Ensure authenticated clients can exercise the existing SELECT policies on
-- public.order_access_audit (super_admin sees all, users see own via actor_id).
-- Writes stay service-role only via SECURITY DEFINER server code.
GRANT SELECT ON public.order_access_audit TO authenticated;
GRANT ALL ON public.order_access_audit TO service_role;

-- Belt-and-braces: explicitly revoke EXECUTE on the integrity RPC from PUBLIC
-- and anon so it fails closed even if a future migration re-grants defaults.
REVOKE EXECUTE ON FUNCTION public.admin_check_order_access_integrity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_check_order_access_integrity() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_check_order_access_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_check_order_access_integrity() TO service_role;