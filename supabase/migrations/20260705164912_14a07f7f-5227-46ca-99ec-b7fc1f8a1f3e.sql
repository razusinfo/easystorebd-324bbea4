-- 1. Idempotency + courier metadata columns.
ALTER TABLE public.reseller_orders
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS courier_provider TEXT,
  ADD COLUMN IF NOT EXISTS courier_status TEXT;

-- 2. Rewrite the settlement trigger to be idempotent.
CREATE OR REPLACE FUNCTION public.charge_reseller_wallet_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  charge NUMERIC;
  should_settle BOOLEAN := false;
BEGIN
  NEW.profit_margin := (COALESCE(NEW.reseller_price,0) - COALESCE(NEW.original_price,0)) * NEW.quantity;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'delivered' AND NEW.settled_at IS NULL THEN
      should_settle := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'delivered'
       AND OLD.status IS DISTINCT FROM 'delivered'
       AND OLD.settled_at IS NULL
       AND NEW.settled_at IS NULL THEN
      should_settle := true;
    END IF;
  END IF;

  IF should_settle THEN
    charge := COALESCE(NEW.reseller_price, 0) * NEW.quantity;
    NEW.settled_at := now();
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());

    INSERT INTO public.reseller_wallets (user_id, balance, updated_at)
    VALUES (NEW.reseller_id, -charge, now())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.reseller_wallets.balance - charge,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Webhook-friendly helper: safely mark delivered (idempotent).
CREATE OR REPLACE FUNCTION public.mark_reseller_order_delivered(
  _order_id UUID,
  _provider TEXT DEFAULT NULL,
  _external_status TEXT DEFAULT 'Delivered'
) RETURNS public.reseller_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.reseller_orders;
BEGIN
  UPDATE public.reseller_orders
     SET status = 'delivered'::reseller_order_status,
         delivered_at = COALESCE(delivered_at, now()),
         courier_provider = COALESCE(_provider, courier_provider),
         courier_status = _external_status,
         updated_at = now()
   WHERE id = _order_id
     AND (status IS DISTINCT FROM 'delivered' OR settled_at IS NULL)
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    SELECT * INTO _row FROM public.reseller_orders WHERE id = _order_id;
  END IF;
  RETURN _row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_reseller_order_delivered(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reseller_order_delivered(UUID, TEXT, TEXT) TO service_role;