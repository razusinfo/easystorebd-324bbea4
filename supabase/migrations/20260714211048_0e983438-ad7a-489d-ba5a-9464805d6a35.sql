
-- Marketplace Orders
CREATE TYPE public.marketplace_order_status AS ENUM ('pending','shipped','delivered','cancelled');

CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE DEFAULT ('MP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  reseller_store_name TEXT,
  reseller_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.marketplace_order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_orders TO authenticated;
GRANT ALL ON public.marketplace_orders TO service_role;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_orders_admin_all" ON public.marketplace_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_mp_orders_updated BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marketplace Campaigns
CREATE TABLE public.marketplace_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  banner_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_campaigns TO authenticated;
GRANT SELECT ON public.marketplace_campaigns TO anon;
GRANT ALL ON public.marketplace_campaigns TO service_role;
ALTER TABLE public.marketplace_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_camp_admin_all" ON public.marketplace_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "mp_camp_public_read_active" ON public.marketplace_campaigns FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "mp_camp_auth_read_active" ON public.marketplace_campaigns FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_mp_camp_updated BEFORE UPDATE ON public.marketplace_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marketplace Flash Sales
CREATE TABLE public.marketplace_flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_percent INT NOT NULL CHECK (discount_percent BETWEEN 1 AND 95),
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mp_flash_unique_active_product ON public.marketplace_flash_sales(product_id) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_flash_sales TO authenticated;
GRANT SELECT ON public.marketplace_flash_sales TO anon;
GRANT ALL ON public.marketplace_flash_sales TO service_role;
ALTER TABLE public.marketplace_flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_flash_admin_all" ON public.marketplace_flash_sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "mp_flash_public_read_active" ON public.marketplace_flash_sales FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "mp_flash_auth_read_active" ON public.marketplace_flash_sales FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_mp_flash_updated BEFORE UPDATE ON public.marketplace_flash_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marketplace Categories
CREATE TABLE public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_categories TO authenticated;
GRANT SELECT ON public.marketplace_categories TO anon;
GRANT ALL ON public.marketplace_categories TO service_role;
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_cat_admin_all" ON public.marketplace_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "mp_cat_public_read_visible" ON public.marketplace_categories FOR SELECT TO anon
  USING (is_hidden = false);
CREATE POLICY "mp_cat_auth_read_visible" ON public.marketplace_categories FOR SELECT TO authenticated
  USING (is_hidden = false OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_mp_cat_updated BEFORE UPDATE ON public.marketplace_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_flash_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_categories;
