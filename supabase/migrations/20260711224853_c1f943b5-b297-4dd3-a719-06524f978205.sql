-- Notify super admins (suppliers) whenever a new reseller_order is created.
-- Populates admin_notifications (dashboard bell) + user_notifications for each
-- super_admin (their bell/badge), and best-effort dispatches an email via a
-- public webhook using pg_net so Resend can be called outside the trigger tx.

CREATE OR REPLACE FUNCTION public.notify_supplier_on_new_reseller_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _short TEXT := UPPER(SUBSTRING(NEW.id::text, 1, 8));
  _title TEXT := format('New order #%s — %s', _short, NEW.product_name);
  _body  TEXT := format('%s ordered %s × %s. Ship to: %s',
                         NEW.customer_name, NEW.quantity, NEW.product_name,
                         COALESCE(NEW.shipping_address,''));
  _base  TEXT;
  _secret TEXT;
BEGIN
  -- Dashboard alert.
  INSERT INTO public.admin_notifications (type, title, body, link, related_id)
  VALUES ('reseller_order_new', _title, _body, '/admin-reseller-orders', NEW.id::text);

  -- Per super_admin bell notifications.
  INSERT INTO public.user_notifications (user_id, type, title, body, link, related_id)
  SELECT ur.user_id, 'reseller_order_new', _title, _body, '/admin-reseller-orders', NEW.id::text
  FROM public.user_roles ur
  WHERE ur.role = 'super_admin';

  -- Best-effort email dispatch via pg_net → public webhook.
  BEGIN
    SELECT current_setting('app.public_base_url', true) INTO _base;
    SELECT current_setting('app.reseller_webhook_secret', true) INTO _secret;
    IF _base IS NULL OR length(_base) = 0 THEN
      _base := 'https://easystorebd.com';
    END IF;
    IF _secret IS NOT NULL AND length(_secret) > 0 THEN
      PERFORM net.http_post(
        url := _base || '/api/public/hooks/reseller-order-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', _secret
        ),
        body := jsonb_build_object('order_id', NEW.id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reseller-order-notify pg_net failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_supplier_on_new_reseller_order failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_supplier_on_new_reseller_order ON public.reseller_orders;
CREATE TRIGGER trg_notify_supplier_on_new_reseller_order
AFTER INSERT ON public.reseller_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_supplier_on_new_reseller_order();

-- Store the webhook secret + base URL as DB-level settings so the trigger can
-- read them without needing them in every session. Safe to re-run.
DO $$ BEGIN
  PERFORM set_config('app.public_base_url', 'https://easystorebd.com', false);
END $$;