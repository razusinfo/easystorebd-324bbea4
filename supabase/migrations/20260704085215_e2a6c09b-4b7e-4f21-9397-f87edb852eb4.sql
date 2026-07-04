ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS banner_url text;