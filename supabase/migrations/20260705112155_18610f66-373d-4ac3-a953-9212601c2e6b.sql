
CREATE OR REPLACE FUNCTION public.trg_order_stock_decrement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'delivered'::order_status THEN
      PERFORM public.apply_order_stock_decrement(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'delivered'::order_status
       AND (OLD.status IS DISTINCT FROM 'delivered'::order_status) THEN
      PERFORM public.apply_order_stock_decrement(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
