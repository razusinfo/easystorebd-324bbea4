
-- Shared updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.store_category AS ENUM ('Clothes', 'Electronics', 'Sports');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.store_template AS ENUM ('minimal', 'boutique', 'techgrid', 'sporty', 'luxe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============= stores =============
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category public.store_category NOT NULL,
  template public.store_template NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own store"
  ON public.stores FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins read all stores"
  ON public.stores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners insert own store"
  ON public.stores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners update own store"
  ON public.stores FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners delete own store"
  ON public.stores FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= products =============
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status public.product_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_store_id_idx ON public.products (store_id);
CREATE INDEX products_status_idx ON public.products (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Helper: does this product belong to the current user's store?
CREATE OR REPLACE FUNCTION public.owns_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND s.owner_user_id = auth.uid()
  );
$$;

CREATE POLICY "Owners read own products"
  ON public.products FOR SELECT TO authenticated
  USING (public.owns_store(store_id));

CREATE POLICY "Admins read all products"
  ON public.products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners insert own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.owns_store(store_id));

CREATE POLICY "Owners update own products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));

CREATE POLICY "Admins update product status"
  ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners delete own products"
  ON public.products FOR DELETE TO authenticated
  USING (public.owns_store(store_id));

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
