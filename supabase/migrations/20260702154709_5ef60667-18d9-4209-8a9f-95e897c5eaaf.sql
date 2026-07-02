
-- Extend products with the additional fields captured by the form
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS weight_kg numeric(10,3),
  ADD COLUMN IF NOT EXISTS length_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS width_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS regular_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS buying_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS unit_name text,
  ADD COLUMN IF NOT EXISTS product_serial text,
  ADD COLUMN IF NOT EXISTS warranty text,
  ADD COLUMN IF NOT EXISTS initial_sold_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS use_default_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_condition_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_condition_check
  CHECK (condition IN ('new','used','refurbished'));

CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products(category_id);

-- Product Variants (Size, Color, Weight etc.)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON public.product_variants(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT ON public.product_variants TO anon;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads variants of visible products"
  ON public.product_variants FOR SELECT
  USING (true);

CREATE POLICY "Owners manage own product variants"
  ON public.product_variants FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id AND s.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id AND s.owner_user_id = auth.uid()
  ));

-- Product Details (Brand, Model, Fabric Type, EMI, etc.)
CREATE TABLE IF NOT EXISTS public.product_details (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_details_product_id_idx ON public.product_details(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_details TO authenticated;
GRANT SELECT ON public.product_details TO anon;
GRANT ALL ON public.product_details TO service_role;

ALTER TABLE public.product_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads details of visible products"
  ON public.product_details FOR SELECT
  USING (true);

CREATE POLICY "Owners manage own product details"
  ON public.product_details FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_details.product_id AND s.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_details.product_id AND s.owner_user_id = auth.uid()
  ));
