
CREATE TABLE public.reseller_sync_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  source_ip text,
  secret_valid boolean NOT NULL DEFAULT false,
  http_status int NOT NULL,
  external_id text,
  source text,
  error text,
  payload jsonb
);
GRANT SELECT ON public.reseller_sync_webhook_logs TO authenticated;
GRANT ALL ON public.reseller_sync_webhook_logs TO service_role;
ALTER TABLE public.reseller_sync_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view sync webhook logs"
  ON public.reseller_sync_webhook_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX reseller_sync_webhook_logs_received_at_idx
  ON public.reseller_sync_webhook_logs (received_at DESC);
