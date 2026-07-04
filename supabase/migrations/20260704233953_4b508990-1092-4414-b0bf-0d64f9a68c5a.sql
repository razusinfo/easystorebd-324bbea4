
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_out_of_stock boolean
  GENERATED ALWAYS AS (COALESCE(stock, 0) <= 0) STORED;

ALTER TABLE public.reseller_products
  ADD COLUMN IF NOT EXISTS is_out_of_stock boolean
  GENERATED ALWAYS AS (COALESCE(stock, 0) <= 0) STORED;

CREATE INDEX IF NOT EXISTS products_oos_created_idx
  ON public.products(store_id, is_out_of_stock, created_at DESC);

CREATE INDEX IF NOT EXISTS reseller_products_oos_updated_idx
  ON public.reseller_products(is_out_of_stock, updated_at DESC);
