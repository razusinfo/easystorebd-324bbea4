
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

-- Recreate the helper in the private schema (not exposed by PostgREST).
CREATE OR REPLACE FUNCTION private.order_accepts_new_items(_order_id uuid, _caller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = _order_id
      AND s.published = true
      AND o.status = 'pending'::order_status
      AND o.created_at > (now() - interval '15 minutes')
      AND (
        (_caller IS NULL AND o.customer_user_id IS NULL)
        OR (_caller IS NOT NULL AND (o.customer_user_id IS NULL OR o.customer_user_id = _caller))
      )
  )
$$;

REVOKE ALL ON FUNCTION private.order_accepts_new_items(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.order_accepts_new_items(uuid, uuid) TO anon, authenticated;

-- Swap the policy to reference the private helper, then drop the public one.
DROP POLICY IF EXISTS "Guests can add items to their new order" ON public.order_items;

CREATE POLICY "Guests can add items to their new order"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  price >= 0
  AND quantity > 0
  AND quantity <= 10000
  AND subtotal >= 0
  AND length(name) <= 300
  AND length(coalesce(variant_label, '')) <= 200
  AND private.order_accepts_new_items(order_items.order_id, auth.uid())
);

DROP FUNCTION IF EXISTS public.order_accepts_new_items(uuid, uuid);
