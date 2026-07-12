
-- 1) Audit log for order list/read access
CREATE TABLE public.order_access_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  filters JSONB,
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_access_audit TO authenticated;
GRANT ALL ON public.order_access_audit TO service_role;

ALTER TABLE public.order_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all access audit"
  ON public.order_access_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users read own access audit"
  ON public.order_access_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = actor_id);

CREATE INDEX order_access_audit_actor_created_idx
  ON public.order_access_audit (actor_id, created_at DESC);
CREATE INDEX order_access_audit_created_idx
  ON public.order_access_audit (created_at DESC);

-- 2) Admin-only integrity scanner
CREATE OR REPLACE FUNCTION public.admin_check_order_access_integrity()
RETURNS TABLE(
  order_id UUID,
  reseller_id UUID,
  storefront_owner_id UUID,
  source_order_item_id UUID,
  created_at TIMESTAMPTZ,
  issue TEXT,
  detail TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  RETURN QUERY
  WITH ro AS (
    SELECT
      r.id,
      r.reseller_id,
      r.source_order_item_id,
      r.source_store_id,
      s.owner_user_id AS storefront_owner_id,
      r.created_at
    FROM public.reseller_orders r
    LEFT JOIN public.stores s ON s.id = r.source_store_id
  ),
  dupes AS (
    SELECT source_order_item_id, COUNT(*) AS n
    FROM public.reseller_orders
    WHERE source_order_item_id IS NOT NULL
    GROUP BY source_order_item_id
    HAVING COUNT(*) > 1
  )
  -- Missing reseller_id → RLS hides for everyone (supplier can't fetch).
  SELECT ro.id, ro.reseller_id, ro.storefront_owner_id, ro.source_order_item_id,
         ro.created_at, 'null_reseller_id'::text,
         'Order has no reseller_id; will be invisible to every supplier under RLS.'::text
    FROM ro WHERE ro.reseller_id IS NULL
  UNION ALL
  -- Reseller assigned but no profile row.
  SELECT ro.id, ro.reseller_id, ro.storefront_owner_id, ro.source_order_item_id,
         ro.created_at, 'unknown_reseller_profile'::text,
         'reseller_id does not exist in public.profiles.'::text
    FROM ro
    WHERE ro.reseller_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ro.reseller_id)
  UNION ALL
  -- Duplicate forwarding for the same source item.
  SELECT ro.id, ro.reseller_id, ro.storefront_owner_id, ro.source_order_item_id,
         ro.created_at, 'duplicate_forward'::text,
         'Multiple reseller_orders reference the same source_order_item_id.'::text
    FROM ro
    JOIN dupes d ON d.source_order_item_id = ro.source_order_item_id
  UNION ALL
  -- Mismatch: assigned reseller differs from the storefront owner.
  SELECT ro.id, ro.reseller_id, ro.storefront_owner_id, ro.source_order_item_id,
         ro.created_at, 'reseller_owner_mismatch'::text,
         'reseller_id does not match the storefront owner (source_store_id.owner_user_id).'::text
    FROM ro
    WHERE ro.storefront_owner_id IS NOT NULL
      AND ro.reseller_id IS NOT NULL
      AND ro.storefront_owner_id <> ro.reseller_id
  ORDER BY 5 DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_check_order_access_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_check_order_access_integrity() TO authenticated;
