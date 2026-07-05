
CREATE TABLE IF NOT EXISTS public.reseller_order_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.reseller_orders(id) ON DELETE CASCADE,
  actor_id UUID,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  tracking_id TEXT,
  tracking_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_order_events_order_id ON public.reseller_order_events(order_id, created_at DESC);

GRANT SELECT ON public.reseller_order_events TO authenticated;
GRANT ALL ON public.reseller_order_events TO service_role;

ALTER TABLE public.reseller_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all order events" ON public.reseller_order_events;
CREATE POLICY "Admins can view all order events"
  ON public.reseller_order_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Resellers can view own order events" ON public.reseller_order_events;
CREATE POLICY "Resellers can view own order events"
  ON public.reseller_order_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reseller_orders o
    WHERE o.id = reseller_order_events.order_id AND o.reseller_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.log_reseller_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status_changed BOOLEAN := NEW.status IS DISTINCT FROM OLD.status;
  _tracking_changed BOOLEAN := (NEW.tracking_id IS DISTINCT FROM OLD.tracking_id)
                            OR (NEW.tracking_url IS DISTINCT FROM OLD.tracking_url);
  _event TEXT;
BEGIN
  IF NOT (_status_changed OR _tracking_changed) THEN
    RETURN NEW;
  END IF;
  IF _status_changed AND _tracking_changed THEN
    _event := 'status_and_tracking';
  ELSIF _status_changed THEN
    _event := 'status_change';
  ELSE
    _event := 'tracking_update';
  END IF;
  INSERT INTO public.reseller_order_events (order_id, actor_id, event_type, old_status, new_status, tracking_id, tracking_url)
  VALUES (NEW.id, auth.uid(), _event,
          CASE WHEN _status_changed THEN OLD.status::text ELSE NULL END,
          CASE WHEN _status_changed THEN NEW.status::text ELSE NULL END,
          NEW.tracking_id, NEW.tracking_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_reseller_order_event ON public.reseller_orders;
CREATE TRIGGER trg_log_reseller_order_event
  AFTER UPDATE ON public.reseller_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_reseller_order_event();
