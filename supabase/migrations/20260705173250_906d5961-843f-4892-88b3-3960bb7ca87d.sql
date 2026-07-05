
REVOKE EXECUTE ON FUNCTION public.apply_courier_order_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_courier_order_status(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
