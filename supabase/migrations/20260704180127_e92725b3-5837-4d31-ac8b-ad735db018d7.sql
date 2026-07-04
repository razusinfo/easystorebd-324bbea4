
CREATE TABLE public.reseller_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  reseller_price NUMERIC(12,2),
  source TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reseller_products TO authenticated;
GRANT ALL ON public.reseller_products TO service_role;

ALTER TABLE public.reseller_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reseller products"
  ON public.reseller_products FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_reseller_products_updated_at
  BEFORE UPDATE ON public.reseller_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
