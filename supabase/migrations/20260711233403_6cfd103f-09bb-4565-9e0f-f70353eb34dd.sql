
CREATE OR REPLACE FUNCTION public.verify_order_schema()
RETURNS TABLE(check_name text, ok boolean, detail text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  required_fks text[] := ARRAY[
    'orders_store_id_fkey',
    'order_items_order_id_fkey',
    'order_items_product_id_fkey',
    'products_store_id_fkey',
    'products_source_reseller_product_id_fkey',
    'reseller_orders_reseller_id_fkey',
    'reseller_orders_reseller_product_id_fkey',
    'reseller_orders_source_order_id_fkey',
    'reseller_orders_source_order_item_id_fkey',
    'reseller_orders_source_store_id_fkey'
  ];
  required_views text[] := ARRAY['v_reseller_storefront_orders','v_supplier_orders'];
  fk text;
  vw text;
  found boolean;
BEGIN
  FOREACH fk IN ARRAY required_fks LOOP
    SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = fk) INTO found;
    check_name := 'fk:' || fk; ok := found;
    detail := CASE WHEN found THEN 'present' ELSE 'MISSING' END;
    RETURN NEXT;
  END LOOP;

  FOREACH vw IN ARRAY required_views LOOP
    SELECT EXISTS(SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname = vw) INTO found;
    check_name := 'view:' || vw; ok := found;
    detail := CASE WHEN found THEN 'present' ELSE 'MISSING' END;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.verify_order_schema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_order_schema() TO authenticated, service_role;
