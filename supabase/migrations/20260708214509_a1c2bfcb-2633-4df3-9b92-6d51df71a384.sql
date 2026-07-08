
-- 1) Restore column grants on public.site_settings so anonymous visitors can
--    load site branding (logo, favicon, primary color, contact links).
GRANT SELECT (
  id,
  logo_url,
  favicon_url,
  primary_color,
  sidebar_categories,
  whatsapp_url,
  contact_email,
  contact_phone,
  facebook_url,
  instagram_url,
  created_at,
  updated_at
) ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

-- 2) Guest checkout fix: replace the order_items INSERT policy with one that
--    uses a SECURITY DEFINER helper so the EXISTS check on `orders` is not
--    filtered by orders' SELECT RLS (anon has none, so it always returned false).
CREATE OR REPLACE FUNCTION public.order_accepts_new_items(_order_id uuid, _caller uuid)
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

GRANT EXECUTE ON FUNCTION public.order_accepts_new_items(uuid, uuid) TO anon, authenticated;

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
  AND public.order_accepts_new_items(order_items.order_id, auth.uid())
);
