
-- 1) Extend orders with courier/tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_provider TEXT,
  ADD COLUMN IF NOT EXISTS tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS courier_status TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2) Order tracking events (timeline)
CREATE TABLE IF NOT EXISTS public.order_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  courier_status TEXT,
  courier_provider TEXT,
  tracking_id TEXT,
  tracking_url TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_tracking_events_order_idx
  ON public.order_tracking_events(order_id, created_at DESC);

GRANT SELECT ON public.order_tracking_events TO authenticated;
GRANT ALL ON public.order_tracking_events TO service_role;

ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view own order events" ON public.order_tracking_events;
CREATE POLICY "Store owners can view own order events"
  ON public.order_tracking_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_tracking_events.order_id
        AND s.owner_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 3) Per-owner courier partner settings
CREATE TABLE IF NOT EXISTS public.courier_partner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  base_url TEXT,
  pickup_zone TEXT,
  pickup_address TEXT,
  status_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_partner_settings TO authenticated;
GRANT ALL ON public.courier_partner_settings TO service_role;

ALTER TABLE public.courier_partner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their courier settings" ON public.courier_partner_settings;
CREATE POLICY "Owners manage their courier settings"
  ON public.courier_partner_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_courier_partner_settings_updated_at ON public.courier_partner_settings;
CREATE TRIGGER trg_courier_partner_settings_updated_at
  BEFORE UPDATE ON public.courier_partner_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Trigger: log tracking/status changes on orders
CREATE OR REPLACE FUNCTION public.log_order_tracking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status_changed BOOLEAN := NEW.status IS DISTINCT FROM OLD.status;
  _cstatus_changed BOOLEAN := NEW.courier_status IS DISTINCT FROM OLD.courier_status;
  _tracking_changed BOOLEAN := (NEW.tracking_id IS DISTINCT FROM OLD.tracking_id)
                            OR (NEW.tracking_url IS DISTINCT FROM OLD.tracking_url)
                            OR (NEW.courier_provider IS DISTINCT FROM OLD.courier_provider);
  _event TEXT;
BEGIN
  IF NOT (_status_changed OR _cstatus_changed OR _tracking_changed) THEN
    RETURN NEW;
  END IF;
  IF _status_changed AND _tracking_changed THEN _event := 'status_and_tracking';
  ELSIF _status_changed THEN _event := 'status_change';
  ELSIF _cstatus_changed THEN _event := 'courier_update';
  ELSE _event := 'tracking_update';
  END IF;

  INSERT INTO public.order_tracking_events
    (order_id, event_type, old_status, new_status, courier_status, courier_provider, tracking_id, tracking_url)
  VALUES
    (NEW.id, _event,
     CASE WHEN _status_changed THEN OLD.status::text ELSE NULL END,
     CASE WHEN _status_changed THEN NEW.status::text ELSE NULL END,
     NEW.courier_status, NEW.courier_provider, NEW.tracking_id, NEW.tracking_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_tracking_change ON public.orders;
CREATE TRIGGER trg_log_order_tracking_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_tracking_change();

-- 5) Webhook helper: idempotent order update from courier callback
CREATE OR REPLACE FUNCTION public.apply_courier_order_status(
  _order_id UUID,
  _provider TEXT,
  _external_status TEXT,
  _tracking_id TEXT DEFAULT NULL,
  _tracking_url TEXT DEFAULT NULL
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.orders;
  _new_status public.order_status;
  _lower TEXT := lower(coalesce(_external_status,''));
BEGIN
  -- Map common courier statuses → internal order status
  _new_status := CASE
    WHEN _lower IN ('delivered','delivery_completed','delivery-completed','completed','success') THEN 'delivered'::order_status
    WHEN _lower IN ('in_transit','shipped','picked','picked_up','out_for_delivery','on_the_way') THEN 'shipped'::order_status
    WHEN _lower IN ('cancelled','canceled','returned','failed','lost') THEN 'cancelled'::order_status
    WHEN _lower IN ('confirmed','accepted','ready') THEN 'confirmed'::order_status
    ELSE NULL
  END;

  UPDATE public.orders
     SET courier_provider = COALESCE(_provider, courier_provider),
         courier_status = COALESCE(_external_status, courier_status),
         tracking_id = COALESCE(_tracking_id, tracking_id),
         tracking_url = COALESCE(_tracking_url, tracking_url),
         status = COALESCE(_new_status, status),
         shipped_at = CASE
           WHEN _new_status = 'shipped'::order_status AND shipped_at IS NULL THEN now()
           ELSE shipped_at END,
         delivered_at = CASE
           WHEN _new_status = 'delivered'::order_status AND delivered_at IS NULL THEN now()
           ELSE delivered_at END,
         updated_at = now()
   WHERE id = _order_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
