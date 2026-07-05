
CREATE TYPE public.payout_method AS ENUM ('bkash', 'nagad', 'bank');
CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'paid', 'rejected');

CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method public.payout_method NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  branch_name TEXT,
  status public.payout_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reference TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payout_requests_user_created_idx ON public.payout_requests (user_id, created_at DESC);
CREATE INDEX payout_requests_status_idx ON public.payout_requests (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payout requests"
  ON public.payout_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users create own payout requests"
  ON public.payout_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update payout requests"
  ON public.payout_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- When admin marks a request as paid, debit the user's wallet.
CREATE OR REPLACE FUNCTION public.apply_payout_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    NEW.processed_at := COALESCE(NEW.processed_at, now());
    NEW.processed_by := COALESCE(NEW.processed_by, auth.uid());

    INSERT INTO public.reseller_wallets (user_id, balance, updated_at)
    VALUES (NEW.user_id, -NEW.amount, now())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.reseller_wallets.balance - NEW.amount,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payout_apply_on_paid
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_payout_on_paid();
