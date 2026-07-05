-- 1) Sync reseller_orders.status → linked customer order (so resellers see admin fulfillment progress)
CREATE OR REPLACE FUNCTION public.sync_reseller_order_status_to_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _valid TEXT[] := ARRAY['pending','confirmed','processing','shipped','delivered','cancelled'];
  _new TEXT := NEW.status::text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.source_order_id IS NOT NULL
     AND _new = ANY(_valid) THEN
    BEGIN
      UPDATE public.orders
        SET status = _new::order_status,
            updated_at = now()
      WHERE id = NEW.source_order_id
        AND status::text IS DISTINCT FROM _new;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sync_reseller_order_status_to_source: order update failed for %: %', NEW.source_order_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_reseller_order_status_to_source ON public.reseller_orders;
CREATE TRIGGER trg_sync_reseller_order_status_to_source
AFTER UPDATE OF status ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_order_status_to_source();

REVOKE ALL ON FUNCTION public.sync_reseller_order_status_to_source() FROM PUBLIC, anon, authenticated;

-- 2) Decrement the SOURCE reseller_products.stock when a customer order item is created
--    for a product copied from the reseller marketplace. Uses source_reseller_product_id
--    to route the decrement to the correct source instance.
CREATE OR REPLACE FUNCTION public.decrement_source_reseller_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _src UUID;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT source_reseller_product_id INTO _src
    FROM public.products WHERE id = NEW.product_id;
  IF _src IS NULL THEN RETURN NEW; END IF;

  UPDATE public.reseller_products
    SET stock = GREATEST(0, COALESCE(stock,0) - COALESCE(NEW.quantity,0)),
        updated_at = now()
  WHERE id = _src;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'decrement_source_reseller_stock failed for order_item %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_decrement_source_reseller_stock ON public.order_items;
CREATE TRIGGER trg_decrement_source_reseller_stock
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_source_reseller_stock();

REVOKE ALL ON FUNCTION public.decrement_source_reseller_stock() FROM PUBLIC, anon, authenticated;

-- 3) Reconciliation: compare a reseller_product's current stock against consumed
--    quantities across all reseller shop copies. Logs a mismatch to the marketplace
--    audit log when the current stock is negative or when the sum of copy-side stocks
--    diverges from the source.
CREATE OR REPLACE FUNCTION public.reconcile_reseller_stock(_rp_id UUID)
RETURNS TABLE(
  reseller_product_id UUID,
  source_stock INT,
  total_consumed INT,
  copies_count INT,
  min_copy_stock INT,
  mismatch BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _source INT;
  _consumed INT;
  _copies INT;
  _min INT;
  _mismatch BOOLEAN;
BEGIN
  SELECT COALESCE(stock,0) INTO _source FROM public.reseller_products WHERE id = _rp_id;
  SELECT COALESCE(SUM(oi.quantity),0)::int INTO _consumed
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
   WHERE p.source_reseller_product_id = _rp_id;
  SELECT COUNT(*)::int, COALESCE(MIN(stock),0)::int INTO _copies, _min
    FROM public.products WHERE source_reseller_product_id = _rp_id;

  _mismatch := (_source < 0) OR (_copies > 0 AND _min <> _source);

  IF _mismatch THEN
    INSERT INTO public.reseller_marketplace_audit_logs
      (actor_id, actor_role, action, product_id, success, error, metadata)
    VALUES (
      auth.uid(), 'system', 'stock_reconciliation_mismatch', _rp_id, false, 'mismatch_detected',
      jsonb_build_object(
        'source_stock', _source,
        'total_consumed', _consumed,
        'copies_count', _copies,
        'min_copy_stock', _min
      )
    );
  END IF;

  RETURN QUERY SELECT _rp_id, _source, _consumed, _copies, _min, _mismatch;
END $$;

GRANT EXECUTE ON FUNCTION public.reconcile_reseller_stock(uuid) TO authenticated;