
ALTER TABLE public.reseller_products
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS reseller_products_category_idx
  ON public.reseller_products (category);
