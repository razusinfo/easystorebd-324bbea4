
ALTER TABLE public.reseller_orders
  ADD COLUMN IF NOT EXISTS source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reseller_orders_source_order_item_uidx
  ON public.reseller_orders (source_order_item_id)
  WHERE source_order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reseller_orders_source_order_idx
  ON public.reseller_orders (source_order_id);

CREATE OR REPLACE FUNCTION public.sync_customer_order_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product RECORD;
  _order RECORD;
  _store RECORD;
  _rp RECORD;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, source_reseller_product_id
    INTO _product
    FROM public.products
   WHERE id = NEW.product_id;

  IF _product.source_reseller_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, order_number, store_id, customer_name, customer_phone, customer_address
    INTO _order
    FROM public.orders
   WHERE id = NEW.order_id;

  IF _order.id IS NULL THEN RETURN NEW; END IF;

  SELECT id, owner_user_id
    INTO _store
    FROM public.stores
   WHERE id = _order.store_id;

  IF _store.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, name, price, reseller_price
    INTO _rp
    FROM public.reseller_products
   WHERE id = _product.source_reseller_product_id;

  IF _rp.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.reseller_orders (
    reseller_id, reseller_product_id, product_name,
    customer_name, customer_phone, customer_email,
    shipping_address, quantity,
    original_price, reseller_price, customer_price,
    status, shipping_requested, source, notes,
    source_order_id, source_order_item_id, source_store_id
  ) VALUES (
    _store.owner_user_id, _rp.id, NEW.name,
    _order.customer_name, _order.customer_phone, NULL,
    COALESCE(_order.customer_address, ''), NEW.quantity,
    COALESCE(_rp.price, 0),
    COALESCE(_rp.reseller_price, _rp.price, 0),
    NEW.price,
    'pending', true, 'storefront',
    'Auto-forwarded from customer order ' || COALESCE(_order.order_number, _order.id::text),
    _order.id, NEW.id, _store.id
  )
  ON CONFLICT (source_order_item_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_customer_order_to_admin failed for order_item % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_order_to_admin ON public.order_items;
CREATE TRIGGER trg_sync_customer_order_to_admin
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_order_to_admin();
