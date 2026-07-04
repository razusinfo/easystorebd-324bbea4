
CREATE TABLE public.product_category_assignments (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_category_assignments TO authenticated;
GRANT SELECT ON public.product_category_assignments TO anon;
GRANT ALL ON public.product_category_assignments TO service_role;

ALTER TABLE public.product_category_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own product assignments"
ON public.product_category_assignments
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = product_category_assignments.product_id
    AND s.owner_user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = product_category_assignments.product_id
    AND s.owner_user_id = auth.uid()
));

CREATE POLICY "Public read assignments for public products"
ON public.product_category_assignments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = product_category_assignments.product_id
    AND p.status = 'approved'::product_status
    AND s.published = true
));

CREATE INDEX product_category_assignments_category_id_idx
  ON public.product_category_assignments(category_id);
