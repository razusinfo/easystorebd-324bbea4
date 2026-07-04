CREATE TABLE public.reseller_marketplace_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  product_id TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reseller_marketplace_audit_logs TO authenticated;
GRANT ALL ON public.reseller_marketplace_audit_logs TO service_role;

ALTER TABLE public.reseller_marketplace_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view marketplace audit logs"
  ON public.reseller_marketplace_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX reseller_marketplace_audit_logs_created_at_idx
  ON public.reseller_marketplace_audit_logs (created_at DESC);