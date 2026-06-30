
-- Drop product policies that reference owns_store(), then drop the function
DROP POLICY IF EXISTS "Owners read own products" ON public.products;
DROP POLICY IF EXISTS "Owners insert own products" ON public.products;
DROP POLICY IF EXISTS "Owners update own products" ON public.products;
DROP POLICY IF EXISTS "Owners delete own products" ON public.products;

DROP FUNCTION IF EXISTS public.owns_store(uuid);

-- Recreate with inline EXISTS — relies on stores RLS to scope rows
CREATE POLICY "Owners read own products"
  ON public.products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "Owners insert own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "Owners update own products"
  ON public.products FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "Owners delete own products"
  ON public.products FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.owner_user_id = auth.uid()
  ));
