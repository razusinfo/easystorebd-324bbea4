
-- 1. Order-driven stock decrement.
-- When an order transitions to status='completed' (or is inserted already
-- completed, e.g. from POS), decrement products.stock by each order_item's qty.
-- The existing sync_reseller_product trigger then mirrors the change into
-- reseller_products.stock, and sync_reseller_stock_to_shops propagates it
-- into every reseller copy + inserts supplier_out_of_stock notifications.

CREATE OR REPLACE FUNCTION public.apply_order_stock_decrement(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p
  SET stock = GREATEST(0, COALESCE(p.stock, 0) - oi.qty_total),
      updated_at = now()
  FROM (
    SELECT product_id, SUM(quantity)::int AS qty_total
    FROM public.order_items
    WHERE order_id = _order_id AND product_id IS NOT NULL
    GROUP BY product_id
  ) oi
  WHERE p.id = oi.product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_order_stock_decrement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      PERFORM public.apply_order_stock_decrement(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND COALESCE(OLD.status,'') <> 'completed' THEN
      PERFORM public.apply_order_stock_decrement(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_stock_decrement_ins_trg ON public.orders;
CREATE TRIGGER order_stock_decrement_ins_trg
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_stock_decrement();

DROP TRIGGER IF EXISTS order_stock_decrement_upd_trg ON public.orders;
CREATE TRIGGER order_stock_decrement_upd_trg
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_stock_decrement();


-- 2. Audit log entries when a supplier reseller_product crosses 0 (out) or
-- is restored above 0. Metadata includes the supplier linkage and every
-- affected reseller store owner.

CREATE OR REPLACE FUNCTION public.trg_reseller_stock_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _owners uuid[];
BEGIN
  IF NEW.stock IS NOT DISTINCT FROM OLD.stock THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.stock,0) > 0 AND COALESCE(NEW.stock,0) <= 0 THEN
    _action := 'stock_out';
  ELSIF COALESCE(OLD.stock,0) <= 0 AND COALESCE(NEW.stock,0) > 0 THEN
    _action := 'stock_restored';
  ELSE
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT s.owner_user_id), ARRAY[]::uuid[])
    INTO _owners
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.source_reseller_product_id = NEW.id
    AND s.owner_user_id IS NOT NULL;

  INSERT INTO public.reseller_marketplace_audit_logs
    (actor_id, actor_role, action, product_id, success, error, metadata)
  VALUES (
    NULL,
    'system',
    _action,
    NEW.id,
    true,
    NULL,
    jsonb_build_object(
      'reseller_product_id', NEW.id,
      'original_product_id', NEW.original_product_id,
      'old_stock', COALESCE(OLD.stock,0),
      'new_stock', COALESCE(NEW.stock,0),
      'affected_store_owner_ids', to_jsonb(_owners)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reseller_stock_audit_trg ON public.reseller_products;
CREATE TRIGGER reseller_stock_audit_trg
  AFTER UPDATE OF stock ON public.reseller_products
  FOR EACH ROW EXECUTE FUNCTION public.trg_reseller_stock_audit();

REVOKE ALL ON FUNCTION public.apply_order_stock_decrement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_order_stock_decrement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reseller_stock_audit() FROM PUBLIC, anon, authenticated;
