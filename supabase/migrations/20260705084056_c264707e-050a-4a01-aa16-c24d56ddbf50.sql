CREATE OR REPLACE FUNCTION public.admin_revoke_reseller_product(_reseller_product_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor UUID := auth.uid();
  _name TEXT;
  _orig UUID;
  _ext TEXT;
  _request_id UUID;
  _owners UUID[];
  _copy_ids UUID[];
  _deleted_count INT;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  SELECT name, original_product_id, external_id
    INTO _name, _orig, _ext
  FROM public.reseller_products WHERE id = _reseller_product_id;

  IF _name IS NULL THEN
    RAISE EXCEPTION 'Reseller product not found';
  END IF;

  -- Resolve linked product_requests row (external_id = 'req-<uuid>').
  IF _ext IS NOT NULL AND _ext LIKE 'req-%' THEN
    BEGIN
      _request_id := substring(_ext FROM 5)::uuid;
    EXCEPTION WHEN others THEN
      _request_id := NULL;
    END;
  END IF;

  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]),
         COALESCE(array_agg(DISTINCT s.owner_user_id) FILTER (WHERE s.owner_user_id IS NOT NULL), ARRAY[]::uuid[])
    INTO _copy_ids, _owners
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.source_reseller_product_id = _reseller_product_id;

  -- Delete reseller shop copies. Any failure aborts the whole function
  -- (plpgsql runs in a single transaction) so nothing is left half-done.
  BEGIN
    DELETE FROM public.products WHERE id = ANY(_copy_ids);
    GET DIAGNOSTICS _deleted_count = ROW_COUNT;
    IF _deleted_count <> COALESCE(array_length(_copy_ids, 1), 0) THEN
      RAISE EXCEPTION 'Failed to remove all reseller shop copies (% of %)',
        _deleted_count, COALESCE(array_length(_copy_ids, 1), 0);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Reseller storefront cleanup failed: %', SQLERRM;
  END;

  INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
  SELECT owner, 'supplier_revoked',
         'Product removed by admin',
         format('"%s" has been removed from the marketplace and from your shop.%s',
                _name,
                CASE WHEN _reason IS NOT NULL AND length(_reason) > 0 THEN ' Reason: ' || _reason ELSE '' END),
         '/my-products',
         _reseller_product_id::text
  FROM unnest(_owners) AS owner;

  INSERT INTO public.reseller_marketplace_audit_logs
    (actor_id, actor_role, action, product_id, success, error, metadata)
  VALUES (
    _actor, 'super_admin', 'admin_revoke', _reseller_product_id, true, NULL,
    jsonb_build_object(
      'name', _name,
      'reseller_product_id', _reseller_product_id,
      'original_product_id', _orig,
      'product_request_id', _request_id,
      'affected_store_owner_ids', to_jsonb(_owners),
      'deleted_copy_ids', to_jsonb(_copy_ids),
      'deleted_copy_count', COALESCE(array_length(_copy_ids, 1), 0),
      'reason', _reason
    )
  );

  DELETE FROM public.reseller_products WHERE id = _reseller_product_id;
END;
$function$;