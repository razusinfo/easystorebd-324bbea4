
-- Wallet ledger: transparent transaction history for every wallet movement.
CREATE TABLE public.wallet_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  entry_type TEXT NOT NULL, -- 'order_charge' | 'refund' | 'commission' | 'payout' | 'adjustment'
  description TEXT,
  related_order_id UUID,
  balance_after NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger"
  ON public.wallet_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_wallet_ledger_user_created ON public.wallet_ledger (user_id, created_at DESC);

-- Trigger: append a ledger row on every reseller_wallets balance change.
CREATE OR REPLACE FUNCTION public.log_wallet_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delta NUMERIC;
  _type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _delta := NEW.balance;
    _type := CASE WHEN _delta < 0 THEN 'order_charge' ELSE 'adjustment' END;
  ELSE
    _delta := NEW.balance - OLD.balance;
    IF _delta = 0 THEN RETURN NEW; END IF;
    _type := CASE WHEN _delta < 0 THEN 'order_charge' ELSE 'refund' END;
  END IF;

  INSERT INTO public.wallet_ledger (user_id, amount, entry_type, description, balance_after)
  VALUES (NEW.user_id, _delta, _type,
          CASE WHEN _delta < 0 THEN 'Reseller wallet debit' ELSE 'Reseller wallet credit' END,
          NEW.balance);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_wallet_change
AFTER INSERT OR UPDATE OF balance ON public.reseller_wallets
FOR EACH ROW EXECUTE FUNCTION public.log_wallet_change();
