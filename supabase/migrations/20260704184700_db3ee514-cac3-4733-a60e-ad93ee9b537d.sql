
-- Order status enum
DO $$ BEGIN
  CREATE TYPE public.reseller_order_status AS ENUM ('pending','confirmed','shipped','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Wallet table
CREATE TABLE IF NOT EXISTS public.reseller_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reseller_wallets TO authenticated;
GRANT ALL ON public.reseller_wallets TO service_role;
ALTER TABLE public.reseller_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller reads own wallet" ON public.reseller_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all wallets" ON public.reseller_wallets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Orders table
CREATE TABLE IF NOT EXISTS public.reseller_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reseller_product_id UUID NOT NULL REFERENCES public.reseller_products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  shipping_address TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  original_price NUMERIC NOT NULL DEFAULT 0,
  reseller_price NUMERIC NOT NULL DEFAULT 0,
  customer_price NUMERIC,
  profit_margin NUMERIC NOT NULL DEFAULT 0,
  status public.reseller_order_status NOT NULL DEFAULT 'pending',
  shipping_requested BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reseller_orders TO authenticated;
GRANT ALL ON public.reseller_orders TO service_role;
ALTER TABLE public.reseller_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller reads own orders" ON public.reseller_orders
  FOR SELECT TO authenticated USING (auth.uid() = reseller_id);
CREATE POLICY "Admin reads all orders" ON public.reseller_orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin updates orders" ON public.reseller_orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_reseller_orders_reseller ON public.reseller_orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_status ON public.reseller_orders(status);

CREATE TRIGGER update_reseller_orders_updated_at
BEFORE UPDATE ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Charge reseller wallet + compute profit on insert
CREATE OR REPLACE FUNCTION public.charge_reseller_wallet_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  charge NUMERIC := COALESCE(NEW.reseller_price, 0) * NEW.quantity;
BEGIN
  NEW.profit_margin := (COALESCE(NEW.reseller_price,0) - COALESCE(NEW.original_price,0)) * NEW.quantity;

  INSERT INTO public.reseller_wallets (user_id, balance, updated_at)
  VALUES (NEW.reseller_id, -charge, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.reseller_wallets.balance - charge,
        updated_at = now();

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_charge_reseller_wallet ON public.reseller_orders;
CREATE TRIGGER trg_charge_reseller_wallet
BEFORE INSERT ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.charge_reseller_wallet_on_order();
