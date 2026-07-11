
-- =========================================================
-- Order routing: default supplier destinations for UNLINKED customer orders
-- =========================================================
CREATE TABLE IF NOT EXISTS public.order_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'unlinked_default', -- unlinked_default | category
  category_id UUID NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_routing_rules TO authenticated;
GRANT ALL ON public.order_routing_rules TO service_role;
ALTER TABLE public.order_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage routing rules"
  ON public.order_routing_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Suppliers can view rules that target them"
  ON public.order_routing_rules FOR SELECT
  TO authenticated
  USING (supplier_user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_order_routing_rules_updated ON public.order_routing_rules;
CREATE TRIGGER trg_order_routing_rules_updated
  BEFORE UPDATE ON public.order_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Audit log for forwarded orders (why & to whom)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.reseller_order_forward_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_order_id UUID NULL,
  source_order_item_id UUID NULL,
  source_store_id UUID NULL,
  product_id UUID NULL,
  reseller_product_id UUID NULL,
  supplier_user_id UUID NULL,
  routing_rule_id UUID NULL REFERENCES public.order_routing_rules(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, -- 'linked_source_reseller_product' | 'unlinked_default_rule' | 'unlinked_no_rule' | 'error'
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reseller_order_forward_audit TO authenticated;
GRANT ALL ON public.reseller_order_forward_audit TO service_role;
ALTER TABLE public.reseller_order_forward_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view forward audit"
  ON public.reseller_order_forward_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Suppliers view audit rows targeting them"
  ON public.reseller_order_forward_audit FOR SELECT
  TO authenticated
  USING (supplier_user_id = auth.uid());

CREATE POLICY "System inserts forward audit"
  ON public.reseller_order_forward_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_forward_audit_created_at ON public.reseller_order_forward_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forward_audit_supplier ON public.reseller_order_forward_audit (supplier_user_id);

-- =========================================================
-- Upgrade sync_customer_order_to_admin:
--   1) Linked path (source_reseller_product_id) — existing behavior + audit
--   2) Unlinked path — pick supplier via order_routing_rules and forward
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_customer_order_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product RECORD;
  _order RECORD;
  _store RECORD;
  _rp RECORD;
  _rule RECORD;
  _supplier UUID;
  _new_ro_id UUID;
  _reason TEXT;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, source_reseller_product_id, price, category_id
    INTO _product
    FROM public.products
   WHERE id = NEW.product_id;

  SELECT id, order_number, store_id, customer_name, customer_phone, customer_address
    INTO _order
    FROM public.orders
   WHERE id = NEW.order_id;
  IF _order.id IS NULL THEN RETURN NEW; END IF;

  SELECT id, owner_user_id
    INTO _store
    FROM public.stores
   WHERE id = _order.store_id;
  IF _store.owner_user_id IS NULL THEN RETURN NEW; END IF;

  -- ---------- Linked path ----------
  IF _product.source_reseller_product_id IS NOT NULL THEN
    SELECT id, name, price, reseller_price
      INTO _rp
      FROM public.reseller_products
     WHERE id = _product.source_reseller_product_id;

    IF _rp.id IS NOT NULL THEN
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
      ON CONFLICT (source_order_item_id) DO NOTHING
      RETURNING id INTO _new_ro_id;

      INSERT INTO public.reseller_order_forward_audit
        (source_order_id, source_order_item_id, source_store_id, product_id, reseller_product_id,
         supplier_user_id, reason, success, metadata)
      VALUES (_order.id, NEW.id, _store.id, _product.id, _rp.id, _store.owner_user_id,
              'linked_source_reseller_product', true,
              jsonb_build_object('reseller_order_id', _new_ro_id, 'product_name', NEW.name));
      RETURN NEW;
    END IF;
  END IF;

  -- ---------- Unlinked path: pick supplier from routing rules ----------
  -- 1) category-specific rule for this product
  IF _product.category_id IS NOT NULL THEN
    SELECT * INTO _rule
      FROM public.order_routing_rules
     WHERE active = true AND scope = 'category' AND category_id = _product.category_id
     ORDER BY priority ASC, created_at ASC
     LIMIT 1;
  END IF;

  -- 2) fallback: unlinked_default (any category)
  IF _rule.id IS NULL THEN
    SELECT * INTO _rule
      FROM public.order_routing_rules
     WHERE active = true AND scope = 'unlinked_default'
     ORDER BY priority ASC, created_at ASC
     LIMIT 1;
  END IF;

  IF _rule.id IS NULL THEN
    INSERT INTO public.reseller_order_forward_audit
      (source_order_id, source_order_item_id, source_store_id, product_id,
       reason, success, error,
       metadata)
    VALUES (_order.id, NEW.id, _store.id, _product.id,
            'unlinked_no_rule', false, 'No active routing rule configured',
            jsonb_build_object('product_name', NEW.name, 'category_id', _product.category_id));
    RETURN NEW;
  END IF;

  _supplier := _rule.supplier_user_id;
  _reason := CASE WHEN _rule.scope = 'category'
                  THEN 'unlinked_category_rule'
                  ELSE 'unlinked_default_rule' END;

  INSERT INTO public.reseller_orders (
    reseller_id, reseller_product_id, product_name,
    customer_name, customer_phone, customer_email,
    shipping_address, quantity,
    original_price, reseller_price, customer_price,
    status, shipping_requested, source, notes,
    source_order_id, source_order_item_id, source_store_id
  ) VALUES (
    _supplier, NULL, NEW.name,
    _order.customer_name, _order.customer_phone, NULL,
    COALESCE(_order.customer_address, ''), NEW.quantity,
    COALESCE(_product.price, NEW.price, 0),
    COALESCE(_product.price, NEW.price, 0),
    NEW.price,
    'pending', true, 'storefront_unlinked',
    'Auto-forwarded (unlinked, routing rule) from customer order ' ||
      COALESCE(_order.order_number, _order.id::text),
    _order.id, NEW.id, _store.id
  )
  ON CONFLICT (source_order_item_id) DO NOTHING
  RETURNING id INTO _new_ro_id;

  INSERT INTO public.reseller_order_forward_audit
    (source_order_id, source_order_item_id, source_store_id, product_id,
     supplier_user_id, routing_rule_id, reason, success, metadata)
  VALUES (_order.id, NEW.id, _store.id, _product.id,
          _supplier, _rule.id, _reason, true,
          jsonb_build_object('reseller_order_id', _new_ro_id, 'product_name', NEW.name,
                             'rule_scope', _rule.scope, 'rule_priority', _rule.priority));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.reseller_order_forward_audit
      (source_order_id, source_order_item_id, source_store_id, product_id,
       reason, success, error, metadata)
    VALUES (NEW.order_id, NEW.id, NULL, NEW.product_id,
            'error', false, SQLERRM,
            jsonb_build_object('product_name', NEW.name));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE WARNING 'sync_customer_order_to_admin failed for order_item %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- =========================================================
-- Notify the SUPPLIER (reseller_id on the new row) in addition to super_admins.
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_supplier_on_new_reseller_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _short TEXT := UPPER(SUBSTRING(NEW.id::text, 1, 8));
  _title TEXT := format('New order #%s — %s', _short, NEW.product_name);
  _body  TEXT := format('%s ordered %s × %s. Ship to: %s',
                         NEW.customer_name, NEW.quantity, NEW.product_name,
                         COALESCE(NEW.shipping_address,''));
  _base  TEXT;
  _secret TEXT;
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, link, related_id)
  VALUES ('reseller_order_new', _title, _body, '/admin-reseller-orders', NEW.id::text);

  -- Notify all super_admins.
  INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
  SELECT ur.user_id, 'reseller_order_new', _title, _body, '/admin-reseller-orders', NEW.id::text
  FROM public.user_roles ur
  WHERE ur.role = 'super_admin';

  -- Notify the supplier (reseller_id owner of this reseller_orders row),
  -- unless they were already notified above as a super_admin.
  IF NEW.reseller_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = NEW.reseller_id AND ur.role = 'super_admin'
     ) THEN
    INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
    VALUES (NEW.reseller_id, 'reseller_order_new', _title, _body, '/my-orders', NEW.id::text);
  END IF;

  BEGIN
    SELECT current_setting('app.public_base_url', true) INTO _base;
    SELECT current_setting('app.reseller_webhook_secret', true) INTO _secret;
    IF _base IS NULL OR length(_base) = 0 THEN
      _base := 'https://easystorebd.com';
    END IF;
    IF _secret IS NOT NULL AND length(_secret) > 0 THEN
      PERFORM net.http_post(
        url := _base || '/api/public/hooks/reseller-order-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', _secret
        ),
        body := jsonb_build_object('order_id', NEW.id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reseller-order-notify pg_net failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_supplier_on_new_reseller_order failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Realtime for supplier /my-orders live badge.
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reseller_orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
