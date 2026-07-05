CREATE OR REPLACE FUNCTION public.trg_order_stock_decrement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _valid_statuses TEXT[] := ARRAY['pending','confirmed','processing','shipped','delivered','cancelled'];
  _new_status TEXT := NEW.status::text;
  _old_status TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END;
BEGIN
  -- Defensive check: if the enum somehow carries an unknown value, log and
  -- exit successfully rather than blocking the order insert/update.
  IF _new_status IS NOT NULL AND NOT (_new_status = ANY(_valid_statuses)) THEN
    RAISE WARNING 'trg_order_stock_decrement: unknown order status "%" on order % (op=%). Skipping stock decrement.',
      _new_status, NEW.id, TG_OP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF _new_status = 'delivered' THEN
      PERFORM public.apply_order_stock_decrement(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF _new_status = 'delivered'
       AND (_old_status IS DISTINCT FROM 'delivered') THEN
      PERFORM public.apply_order_stock_decrement(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let an unexpected trigger failure block the order.
  RAISE WARNING 'trg_order_stock_decrement failed for order % (op=%, status=%): %',
    NEW.id, TG_OP, _new_status, SQLERRM;
  RETURN NEW;
END;
$function$;