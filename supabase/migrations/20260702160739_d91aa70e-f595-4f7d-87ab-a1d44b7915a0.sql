CREATE TYPE public.order_status AS ENUM ('pending','confirmed','processing','shipped','delivered','cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','refunded');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, order_number)
);
CREATE INDEX orders_store_id_created_at_idx ON public.orders (store_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage their orders" ON public.orders
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.owner_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.owner_user_id = auth.uid()));

CREATE POLICY "Super admins view all orders" ON public.orders
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  variant_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage their order items" ON public.order_items
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = order_items.order_id AND s.owner_user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = order_items.order_id AND s.owner_user_id = auth.uid()
));

CREATE POLICY "Super admins view all order items" ON public.order_items
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Anyone reads variants of visible products" ON public.product_variants;
CREATE POLICY "Public reads variants of approved products in published stores"
ON public.product_variants FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = product_variants.product_id AND p.status = 'approved' AND s.published = true
));

DROP POLICY IF EXISTS "Anyone reads details of visible products" ON public.product_details;
CREATE POLICY "Public reads details of approved products in published stores"
ON public.product_details FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = product_details.product_id AND p.status = 'approved' AND s.published = true
));