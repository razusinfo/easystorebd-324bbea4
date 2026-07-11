
-- 1. Reconcile reseller_orders with the unlinked-routing trigger path,
-- which inserts NULL reseller_product_id. Old FK was ON DELETE RESTRICT
-- which is inconsistent with the nullable design; swap for SET NULL.
ALTER TABLE public.reseller_orders
  ALTER COLUMN reseller_product_id DROP NOT NULL;

ALTER TABLE public.reseller_orders
  DROP CONSTRAINT reseller_orders_reseller_product_id_fkey;

ALTER TABLE public.reseller_orders
  ADD CONSTRAINT reseller_orders_reseller_product_id_fkey
    FOREIGN KEY (reseller_product_id)
    REFERENCES public.reseller_products(id)
    ON DELETE SET NULL;

-- 2. Party-scoped views (security_invoker → base-table RLS applies).
CREATE OR REPLACE VIEW public.v_reseller_storefront_orders
  WITH (security_invoker = true) AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.store_id,
  o.customer_name,
  o.customer_phone,
  o.customer_address,
  o.status,
  o.payment_status,
  o.subtotal,
  o.delivery_charge,
  o.discount,
  o.total,
  o.created_at,
  o.updated_at,
  COALESCE(items.item_count, 0) AS item_count,
  COALESCE(items.total_qty, 0)  AS total_quantity
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS item_count,
         COALESCE(SUM(quantity),0)::int AS total_qty
  FROM public.order_items i WHERE i.order_id = o.id
) items ON true;

GRANT SELECT ON public.v_reseller_storefront_orders TO authenticated;

CREATE OR REPLACE VIEW public.v_supplier_orders
  WITH (security_invoker = true) AS
SELECT
  ro.id,
  ro.reseller_id AS supplier_user_id,
  ro.reseller_product_id,
  ro.product_name,
  ro.quantity,
  ro.customer_name,
  ro.customer_phone,
  ro.shipping_address,
  ro.reseller_price AS supplier_price,
  (ro.reseller_price * ro.quantity) AS supplier_total,
  ro.status,
  ro.tracking_id,
  ro.tracking_url,
  ro.courier_provider,
  ro.courier_status,
  ro.source,
  ro.source_store_id,
  ro.created_at,
  ro.updated_at,
  ro.delivered_at
FROM public.reseller_orders ro;

GRANT SELECT ON public.v_supplier_orders TO authenticated;

-- 3. Verification function.
CREATE OR REPLACE FUNCTION public.verify_order_schema()
RETURNS TABLE(check_name text, ok boolean, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    check_name := 'fk:' || fk;
    ok := found;
    detail := CASE WHEN found THEN 'present' ELSE 'MISSING' END;
    RETURN NEXT;
  END LOOP;

  FOREACH vw IN ARRAY required_views LOOP
    SELECT EXISTS(
      SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname = vw
    ) INTO found;
    check_name := 'view:' || vw;
    ok := found;
    detail := CASE WHEN found THEN 'present' ELSE 'MISSING' END;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.verify_order_schema() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_order_schema() FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_order_schema() TO authenticated, service_role;
