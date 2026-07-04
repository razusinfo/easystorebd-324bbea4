
CREATE TABLE IF NOT EXISTS public.user_reseller_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reseller_product_id UUID NOT NULL REFERENCES public.reseller_products(id) ON DELETE CASCADE,
  custom_price NUMERIC,
  custom_description TEXT,
  custom_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reseller_product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reseller_settings TO authenticated;
GRANT ALL ON public.user_reseller_settings TO service_role;

ALTER TABLE public.user_reseller_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reseller settings"
  ON public.user_reseller_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_reseller_settings_user
  ON public.user_reseller_settings (user_id);

CREATE TRIGGER update_user_reseller_settings_updated_at
BEFORE UPDATE ON public.user_reseller_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
