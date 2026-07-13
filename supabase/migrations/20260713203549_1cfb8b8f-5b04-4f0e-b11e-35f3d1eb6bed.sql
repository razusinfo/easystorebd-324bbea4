
CREATE TABLE IF NOT EXISTS public.order_status_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('status','payment_status')),
  from_value TEXT,
  to_value TEXT NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_status_audit_order_idx ON public.order_status_audit(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_status_audit_store_idx ON public.order_status_audit(store_id, created_at DESC);

GRANT SELECT ON public.order_status_audit TO authenticated;
GRANT ALL ON public.order_status_audit TO service_role;

ALTER TABLE public.order_status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners and admins can view audit rows"
  ON public.order_status_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = order_status_audit.store_id
        AND s.owner_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_audit(order_id, store_id, field, from_value, to_value, changed_by)
    VALUES (NEW.id, NEW.store_id, 'status', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.order_status_audit(order_id, store_id, field, from_value, to_value, changed_by)
    VALUES (NEW.id, NEW.store_id, 'payment_status', OLD.payment_status::text, NEW.payment_status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_order_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
  AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();
