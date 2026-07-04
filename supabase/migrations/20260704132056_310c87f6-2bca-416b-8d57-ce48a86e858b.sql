
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS default_delivery_charge numeric,
  ADD COLUMN IF NOT EXISTS specific_delivery_charges jsonb NOT NULL DEFAULT '[]'::jsonb;
