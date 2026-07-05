-- Defer reseller wallet settlement until the fulfillment status is 'delivered'.
-- Previously the reseller wallet was debited immediately on INSERT of a
-- reseller_orders row (as soon as the order was forwarded to the supplier).
-- The business rule is: no funds move until the courier/admin confirms delivery.

DROP TRIGGER IF EXISTS trg_charge_reseller_wallet ON public.reseller_orders;

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
  -- Always keep the profit_margin column in sync on insert/update.
  NEW.profit_margin := (COALESCE(NEW.reseller_price,0) - COALESCE(NEW.original_price,0)) * NEW.quantity;

  IF TG_OP = 'INSERT' THEN
    -- Only settle immediately if the order is being created already delivered
    -- (e.g. backfill / manual admin entry). Normal flow: wait for status update.
    IF NEW.status = 'delivered' THEN
      should_settle := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Settle exactly once, on the transition into 'delivered'.
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
      should_settle := true;
    END IF;
  END IF;

  IF should_settle THEN
    charge := COALESCE(NEW.reseller_price, 0) * NEW.quantity;

    INSERT INTO public.reseller_wallets (user_id, balance, updated_at)
    VALUES (NEW.reseller_id, -charge, now())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.reseller_wallets.balance - charge,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Fire before insert (for the edge case of "created as delivered") AND
-- before update (the normal Delivered transition).
CREATE TRIGGER trg_charge_reseller_wallet
BEFORE INSERT OR UPDATE OF status ON public.reseller_orders
FOR EACH ROW
EXECUTE FUNCTION public.charge_reseller_wallet_on_order();