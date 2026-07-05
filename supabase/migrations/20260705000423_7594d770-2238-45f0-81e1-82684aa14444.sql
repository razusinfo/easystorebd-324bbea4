
-- 1) Admin-configurable Low Stock Threshold on site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 3
  CHECK (low_stock_threshold >= 0);

-- 2) Super-admin cascade revoke of a marketplace product.
--    - Unlists all reseller copies (products.status -> 'rejected')
--    - Notifies each affected store owner
--    - Writes an audit-log entry with supplier linkage + owners
--    - Deletes the reseller_products row
CREATE OR REPLACE FUNCTION public.admin_revoke_reseller_product(
  _reseller_product_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Unlist copies from reseller storefronts (keeps order history intact).
  UPDATE public.products
    SET status = 'rejected', updated_at = now()
    WHERE id = ANY(_copy_ids);

  -- Notify affected resellers.
  INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
  SELECT owner, 'supplier_revoked',
         'Product removed by admin',
         format('"%s" has been removed from the marketplace due to quality standards and is no longer available.%s',
                _name,
                CASE WHEN _reason IS NOT NULL AND length(_reason) > 0 THEN ' Reason: ' || _reason ELSE '' END),
         '/my-products',
         _reseller_product_id::text
  FROM unnest(_owners) AS owner;

  -- Audit trail.
  INSERT INTO public.reseller_marketplace_audit_logs
    (actor_id, actor_role, action, product_id, success, error, metadata)
  VALUES (
    _actor, 'super_admin', 'admin_revoke', _reseller_product_id, true, NULL,
    jsonb_build_object(
      'reseller_product_id', _reseller_product_id,
      'original_product_id', _orig,
      'affected_store_owner_ids', to_jsonb(_owners),
      'affected_copy_ids', to_jsonb(_copy_ids),
      'reason', _reason
    )
  );

  -- Finally remove from marketplace.
  DELETE FROM public.reseller_products WHERE id = _reseller_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_reseller_product(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_reseller_product(UUID, TEXT) TO authenticated;
