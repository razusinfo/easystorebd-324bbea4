ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS add_to_reseller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reseller_price numeric(12,2);