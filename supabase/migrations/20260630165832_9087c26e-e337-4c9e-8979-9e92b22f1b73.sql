
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_key ON public.stores (slug) WHERE slug IS NOT NULL;

-- Backfill slug from name for existing stores (lower alnum, max 32 chars)
UPDATE public.stores
SET slug = COALESCE(
  slug,
  NULLIF(regexp_replace(lower(name), '[^a-z0-9]+', '', 'g'), '')
)
WHERE slug IS NULL;

-- Public read access to published stores
GRANT SELECT ON public.stores TO anon;

DROP POLICY IF EXISTS "Public read published stores" ON public.stores;
CREATE POLICY "Public read published stores"
ON public.stores FOR SELECT
TO anon, authenticated
USING (published = true);

-- Public read access to approved products of published stores
GRANT SELECT ON public.products TO anon;

DROP POLICY IF EXISTS "Public read approved products of published stores" ON public.products;
CREATE POLICY "Public read approved products of published stores"
ON public.products FOR SELECT
TO anon, authenticated
USING (
  status = 'approved' AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.published = true
  )
);
