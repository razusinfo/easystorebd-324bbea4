
-- Callable retry: replicates sync_customer_order_to_admin logic for a single
-- order_items row. Restricted to super_admin. Writes a fresh audit entry so
-- users can see the retry outcome.
CREATE OR REPLACE FUNCTION public.retry_forward_order_item(_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
  _item RECORD;
  _product RECORD;
  _order RECORD;
  _store RECORD;
  _rp RECORD;
  _rule RECORD;
  _supplier UUID;
  _new_ro_id UUID;
  _reason TEXT;
  _existing UUID;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  SELECT id, order_id, product_id, name, price, quantity
    INTO _item
    FROM public.order_items
   WHERE id = _item_id;
  IF _item.id IS NULL THEN
    RAISE EXCEPTION 'order_item not found';
  END IF;

  -- If a reseller_order already exists for this item, short-circuit.
  SELECT id INTO _existing FROM public.reseller_orders WHERE source_order_item_id = _item_id;
  IF _existing IS NOT NULL THEN
    INSERT INTO public.reseller_order_forward_audit
      (source_order_id, source_order_item_id, product_id, reason, success, metadata)
    VALUES (_item.order_id, _item.id, _item.product_id, 'retry_already_forwarded', true,
            jsonb_build_object('reseller_order_id', _existing, 'actor_id', _actor));
    RETURN jsonb_build_object('ok', true, 'already', true, 'reseller_order_id', _existing);
  END IF;

  IF _item.product_id IS NULL THEN
    INSERT INTO public.reseller_order_forward_audit
      (source_order_id, source_order_item_id, reason, success, error, metadata)
    VALUES (_item.order_id, _item.id, 'retry_no_product', false, 'order_item has no product_id',
            jsonb_build_object('actor_id', _actor));
    RETURN jsonb_build_object('ok', false, 'error', 'no_product');
  END IF;

  SELECT id, source_reseller_product_id, price, category_id
    INTO _product
    FROM public.products WHERE id = _item.product_id;

  SELECT id, order_number, store_id, customer_name, customer_phone, customer_address
    INTO _order
    FROM public.orders WHERE id = _item.order_id;

  SELECT id, owner_user_id INTO _store
    FROM public.stores WHERE id = _order.store_id;

  IF _store.owner_user_id IS NULL THEN
    INSERT INTO public.reseller_order_forward_audit
      (source_order_id, source_order_item_id, product_id, reason, success, error, metadata)
    VALUES (_item.order_id, _item.id, _item.product_id, 'retry_no_store_owner', false,
            'store has no owner_user_id', jsonb_build_object('actor_id', _actor));
    RETURN jsonb_build_object('ok', false, 'error', 'no_store_owner');
  END IF;

  -- Linked path
  IF _product.source_reseller_product_id IS NOT NULL THEN
    SELECT id, name, price, reseller_price INTO _rp
      FROM public.reseller_products WHERE id = _product.source_reseller_product_id;

    IF _rp.id IS NOT NULL THEN
      INSERT INTO public.reseller_orders (
        reseller_id, reseller_product_id, product_name,
        customer_name, customer_phone, customer_email,
        shipping_address, quantity,
        original_price, reseller_price, customer_price,
        status, shipping_requested, source, notes,
        source_order_id, source_order_item_id, source_store_id
      ) VALUES (
        _store.owner_user_id, _rp.id, _item.name,
        _order.customer_name, _order.customer_phone, NULL,
        COALESCE(_order.customer_address, ''), _item.quantity,
        COALESCE(_rp.price, 0),
        COALESCE(_rp.reseller_price, _rp.price, 0),
        _item.price,
        'pending', true, 'storefront',
        'Retried forward from customer order ' || COALESCE(_order.order_number, _order.id::text),
        _order.id, _item.id, _store.id
      )
      ON CONFLICT (source_order_item_id) DO NOTHING
      RETURNING id INTO _new_ro_id;

      INSERT INTO public.reseller_order_forward_audit
        (source_order_id, source_order_item_id, source_store_id, product_id, reseller_product_id,
         supplier_user_id, reason, success, metadata)
      VALUES (_order.id, _item.id, _store.id, _product.id, _rp.id, _store.owner_user_id,
              'retry_linked_source_reseller_product', true,
              jsonb_build_object('reseller_order_id', _new_ro_id, 'actor_id', _actor));

      RETURN jsonb_build_object('ok', true, 'reseller_order_id', _new_ro_id, 'reason', 'linked');
    END IF;
  END IF;

  -- Category rule
  IF _product.category_id IS NOT NULL THEN
    SELECT * INTO _rule FROM public.order_routing_rules
     WHERE active = true AND scope = 'category' AND category_id = _product.category_id
     ORDER BY priority ASC, created_at ASC LIMIT 1;
  END IF;
  IF _rule.id IS NULL THEN
    SELECT * INTO _rule FROM public.order_routing_rules
     WHERE active = true AND scope = 'unlinked_default'
     ORDER BY priority ASC, created_at ASC LIMIT 1;
  END IF;

  IF _rule.id IS NULL THEN
    INSERT INTO public.reseller_order_forward_audit
      (source_order_id, source_order_item_id, source_store_id, product_id,
       reason, success, error, metadata)
    VALUES (_order.id, _item.id, _store.id, _product.id,
            'retry_unlinked_no_rule', false, 'No active routing rule',
            jsonb_build_object('actor_id', _actor));
    RETURN jsonb_build_object('ok', false, 'error', 'no_rule');
  END IF;

  _supplier := _rule.supplier_user_id;
  _reason := CASE WHEN _rule.scope = 'category' THEN 'retry_unlinked_category_rule'
                  ELSE 'retry_unlinked_default_rule' END;

  INSERT INTO public.reseller_orders (
    reseller_id, reseller_product_id, product_name,
    customer_name, customer_phone, customer_email,
    shipping_address, quantity,
    original_price, reseller_price, customer_price,
    status, shipping_requested, source, notes,
    source_order_id, source_order_item_id, source_store_id
  ) VALUES (
    _supplier, NULL, _item.name,
    _order.customer_name, _order.customer_phone, NULL,
    COALESCE(_order.customer_address, ''), _item.quantity,
    COALESCE(_product.price, _item.price, 0),
    COALESCE(_product.price, _item.price, 0),
    _item.price,
    'pending', true, 'storefront_unlinked',
    'Retried forward (rule) from customer order ' || COALESCE(_order.order_number, _order.id::text),
    _order.id, _item.id, _store.id
  )
  ON CONFLICT (source_order_item_id) DO NOTHING
  RETURNING id INTO _new_ro_id;

  INSERT INTO public.reseller_order_forward_audit
    (source_order_id, source_order_item_id, source_store_id, product_id,
     supplier_user_id, routing_rule_id, reason, success, metadata)
  VALUES (_order.id, _item.id, _store.id, _product.id, _supplier, _rule.id, _reason, true,
          jsonb_build_object('reseller_order_id', _new_ro_id, 'actor_id', _actor,
                             'rule_scope', _rule.scope, 'rule_priority', _rule.priority));

  RETURN jsonb_build_object('ok', true, 'reseller_order_id', _new_ro_id, 'reason', _reason);

EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.reseller_order_forward_audit
      (source_order_id, source_order_item_id, product_id, reason, success, error, metadata)
    VALUES (COALESCE(_item.order_id, NULL), _item_id, COALESCE(_item.product_id, NULL),
            'retry_error', false, SQLERRM,
            jsonb_build_object('actor_id', _actor));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.retry_forward_order_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_forward_order_item(uuid) TO authenticated;
