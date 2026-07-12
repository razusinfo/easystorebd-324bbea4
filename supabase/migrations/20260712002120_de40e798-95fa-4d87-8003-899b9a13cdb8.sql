REVOKE EXECUTE ON FUNCTION public.admin_check_order_access_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_check_order_access_integrity() TO authenticated, service_role;