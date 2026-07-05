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
  _owners UUID[];
  _copy_ids UUID[];
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  SELECT name, original_product_id INTO _name, _orig
  FROM public.reseller_products WHERE id = _reseller_product_id;

  IF _name IS NULL THEN
    RAISE EXCEPTION 'Reseller product not found';
  END IF;

  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]),
         COALESCE(array_agg(DISTINCT s.owner_user_id) FILTER (WHERE s.owner_user_id IS NOT NULL), ARRAY[]::uuid[])
    INTO _copy_ids, _owners
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.source_reseller_product_id = _reseller_product_id;

  UPDATE public.products
    SET status = 'rejected', updated_at = now()
    WHERE id = ANY(_copy_ids);

  INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
  SELECT owner, 'supplier_revoked',
         'Product removed by admin',
         format('"%s" has been removed from the marketplace due to quality standards and is no longer available.%s',
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
      'affected_store_owner_ids', to_jsonb(_owners),
      'affected_copy_ids', to_jsonb(_copy_ids),
      'reason', _reason
    )
  );

  DELETE FROM public.reseller_products WHERE id = _reseller_product_id;
END;
$function$;