CREATE TABLE public.customer_wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_slug TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_slug, product_id)
);

CREATE INDEX customer_wishlists_user_slug_idx
  ON public.customer_wishlists (user_id, store_slug);

GRANT SELECT, INSERT, DELETE ON public.customer_wishlists TO authenticated;
GRANT ALL ON public.customer_wishlists TO service_role;

ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shoppers view their own wishlist"
  ON public.customer_wishlists FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Shoppers add to their own wishlist"
  ON public.customer_wishlists FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shoppers remove from their own wishlist"
  ON public.customer_wishlists FOR DELETE TO authenticated
  USING (auth.uid() = user_id);