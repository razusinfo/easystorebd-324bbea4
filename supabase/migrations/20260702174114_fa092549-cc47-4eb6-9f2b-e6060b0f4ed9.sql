ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';

CREATE UNIQUE INDEX IF NOT EXISTS stores_custom_domain_unique
  ON public.stores (lower(custom_domain))
  WHERE custom_domain IS NOT NULL;