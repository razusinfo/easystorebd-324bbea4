
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  slug text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_categories_store_idx ON public.product_categories(store_id);
CREATE INDEX product_categories_parent_idx ON public.product_categories(parent_id);

-- Unique sibling name per (store, parent). Treat NULL parent as a fixed UUID for uniqueness.
CREATE UNIQUE INDEX product_categories_unique_sibling
  ON public.product_categories (store_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT ON public.product_categories TO anon;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Owners: full control over their own store's categories
CREATE POLICY "Owners manage own categories"
ON public.product_categories
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = product_categories.store_id AND s.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = product_categories.store_id AND s.owner_user_id = auth.uid()
  )
);

-- Public: anyone can read categories of published stores
CREATE POLICY "Public read for published stores"
ON public.product_categories
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = product_categories.store_id AND s.published = true
  )
);

CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
