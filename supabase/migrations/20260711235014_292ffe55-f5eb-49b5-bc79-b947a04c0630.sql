
CREATE OR REPLACE FUNCTION public.notify_reseller_on_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _short TEXT := UPPER(SUBSTRING(NEW.id::text, 1, 8));
  _status_changed BOOLEAN := NEW.status IS DISTINCT FROM OLD.status;
  _tracking_changed BOOLEAN := (NEW.tracking_id IS DISTINCT FROM OLD.tracking_id)
                            OR (NEW.tracking_url IS DISTINCT FROM OLD.tracking_url);
  _notes_changed BOOLEAN := NEW.notes IS DISTINCT FROM OLD.notes;
  _title TEXT;
  _body_parts TEXT[] := ARRAY[]::TEXT[];
  _notes_preview TEXT;
BEGIN
  IF NOT (_status_changed OR _tracking_changed OR _notes_changed) THEN
    RETURN NEW;
  END IF;

  IF _status_changed THEN
    _title := format('Order #%s is now %s', _short, NEW.status);
  ELSIF _tracking_changed THEN
    _title := format('Tracking updated for order #%s', _short);
  ELSE
    _title := format('Supplier note added to order #%s', _short);
  END IF;

  _body_parts := _body_parts || format('%s × %s for %s',
    COALESCE(NEW.quantity, 1), NEW.product_name, NEW.customer_name);
  _body_parts := _body_parts || format('Status: %s', NEW.status);
  IF NEW.tracking_id IS NOT NULL AND length(NEW.tracking_id) > 0 THEN
    _body_parts := _body_parts || format('Tracking: %s', NEW.tracking_id);
  END IF;
  IF NEW.notes IS NOT NULL AND length(trim(NEW.notes)) > 0 THEN
    _notes_preview := substring(NEW.notes FROM 1 FOR 140);
    IF length(NEW.notes) > 140 THEN
      _notes_preview := _notes_preview || '…';
    END IF;
    _body_parts := _body_parts || format('Note: %s', _notes_preview);
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
  VALUES (
    NEW.reseller_id,
    'reseller_order_update',
    _title,
    array_to_string(_body_parts, ' · '),
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
AFTER UPDATE OF status, tracking_id, tracking_url, notes ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_reseller_on_order_change();
