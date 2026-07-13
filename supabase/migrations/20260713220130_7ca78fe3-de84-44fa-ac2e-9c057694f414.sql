-- ============================================================
-- 1) products: remove public policy, expose safe view instead
-- ============================================================
DROP POLICY IF EXISTS "Public read approved products of published stores" ON public.products;

DROP VIEW IF EXISTS public.storefront_products;

CREATE VIEW public.storefront_products
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.store_id,
  p.name,
  p.description,
  p.price,
  p.stock,
  p.status,
  p.image_url,
  p.category_id,
  p.created_at,
  p.updated_at,
  p.is_out_of_stock,
  p.gallery_urls
FROM public.products p
JOIN public.stores s ON s.id = p.store_id
WHERE p.status = 'approved'
  AND s.published = true;

GRANT SELECT ON public.storefront_products TO anon, authenticated;

COMMENT ON VIEW public.storefront_products IS
  'Public-safe projection of approved products for published stores. Excludes buying_price, regular_price, reseller_price, supplier_id and other internal cost/margin fields.';

-- ============================================================
-- 2) reseller_products: scope store_owner visibility
-- ============================================================
DROP POLICY IF EXISTS "Resellers and admins can view reseller products" ON public.reseller_products;

CREATE POLICY "Reseller catalog visible to admins and active listings"
ON public.reseller_products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'store_owner'::app_role)
    AND (
      -- Already-adopted rows always visible to the adopting reseller
      EXISTS (
        SELECT 1 FROM public.user_reseller_settings urs
        WHERE urs.user_id = auth.uid()
          AND urs.reseller_product_id = reseller_products.id
      )
      OR EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON s.id = p.store_id
        WHERE s.owner_user_id = auth.uid()
          AND p.source_reseller_product_id = reseller_products.id
      )
      -- Otherwise limit marketplace browsing to actively-listed items
      OR (
        reseller_products.image_sync_status = 'synced'
        AND COALESCE(reseller_products.name, '') <> ''
      )
    )
  )
);