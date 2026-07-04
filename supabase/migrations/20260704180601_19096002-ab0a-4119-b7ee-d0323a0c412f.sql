
-- products: add is_resellable mirroring add_to_reseller
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_resellable boolean
  GENERATED ALWAYS AS (add_to_reseller) STORED;

-- reseller_products: add original_product_id + image_url
ALTER TABLE public.reseller_products
  ADD COLUMN IF NOT EXISTS original_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Backfill image_url from existing image column
UPDATE public.reseller_products SET image_url = image WHERE image_url IS NULL AND image IS NOT NULL;

-- Admin management policies
DROP POLICY IF EXISTS "Admins can manage reseller products" ON public.reseller_products;
CREATE POLICY "Admins can manage reseller products"
  ON public.reseller_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
CREATE POLICY "Admins can manage all products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
