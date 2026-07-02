
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS public.product_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_status product_status,
  new_status product_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_audit_logs TO authenticated;
GRANT ALL ON public.product_audit_logs TO service_role;

ALTER TABLE public.product_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own product audit logs"
  ON public.product_audit_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_audit_logs.product_id AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "Admins read all product audit logs"
  ON public.product_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners insert own product audit logs"
  ON public.product_audit_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_audit_logs.product_id AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "Admins insert product audit logs"
  ON public.product_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.log_product_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.product_audit_logs (product_id, actor_id, action, old_status, new_status)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_product_status_change_trg ON public.products;
CREATE TRIGGER log_product_status_change_trg
  AFTER UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_status_change();
