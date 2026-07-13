-- Drop the earlier view; the linter treats it as a security-definer view.
DROP VIEW IF EXISTS public.storefront_products;

-- Re-add public read policy, this time scoped to anon only (SSR uses the anon role).
DROP POLICY IF EXISTS "Public anon read approved products of published stores" ON public.products;
CREATE POLICY "Public anon read approved products of published stores"
ON public.products
FOR SELECT
TO anon
USING (
  status = 'approved'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.published = true
  )
);

-- Column-level restriction: anon can select only non-sensitive fields.
-- Cost/margin/supplier columns (buying_price, regular_price, reseller_price,
-- supplier_id, source_reseller_product_id, cogs, etc.) are intentionally
-- omitted so PostgREST rejects any attempt to select them as anon.
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id,
  store_id,
  name,
  description,
  price,
  stock,
  status,
  image_url,
  category_id,
  created_at,
  updated_at,
  is_out_of_stock,
  gallery_urls
) ON public.products TO anon;