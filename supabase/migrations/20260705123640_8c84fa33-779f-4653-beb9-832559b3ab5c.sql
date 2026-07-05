-- Tracking columns on reseller_orders
ALTER TABLE public.reseller_orders
  ADD COLUMN IF NOT EXISTS tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Notify reseller in-app on any status or tracking change
CREATE OR REPLACE FUNCTION public.notify_reseller_on_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _short TEXT := UPPER(SUBSTRING(NEW.id::text, 1, 8));
  _status_changed BOOLEAN := NEW.status IS DISTINCT FROM OLD.status;
  _tracking_changed BOOLEAN := (NEW.tracking_id IS DISTINCT FROM OLD.tracking_id)
                            OR (NEW.tracking_url IS DISTINCT FROM OLD.tracking_url);
  _title TEXT;
  _body  TEXT;
BEGIN
  IF NOT (_status_changed OR _tracking_changed) THEN
    RETURN NEW;
  END IF;

  IF _status_changed THEN
    _title := format('Order #%s is now %s', _short, NEW.status);
    _body  := format('%s''s order for "%s" has been updated by admin.', NEW.customer_name, NEW.product_name);
  ELSE
    _title := format('Tracking added to order #%s', _short);
    _body  := format('Tracking %s attached to %s''s order for "%s".',
                     COALESCE(NEW.tracking_id, 'link'), NEW.customer_name, NEW.product_name);
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
  VALUES (
    NEW.reseller_id,
    'reseller_order_update',
    _title,
    _body,
    '/my-orders',
    NEW.id::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_reseller_on_order_change failed: %', SQLERRM;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.notify_reseller_on_order_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_reseller_on_order_change ON public.reseller_orders;
CREATE TRIGGER trg_notify_reseller_on_order_change
AFTER UPDATE OF status, tracking_id, tracking_url ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_reseller_on_order_change();