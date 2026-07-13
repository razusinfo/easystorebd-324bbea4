CREATE TABLE public.oauth_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL DEFAULT 'google',
  host text,
  tenant_slug text,
  redirect_uri text,
  message text,
  status_hint text,
  user_agent text,
  path text
);
GRANT INSERT ON public.oauth_error_logs TO anon, authenticated;
GRANT SELECT ON public.oauth_error_logs TO authenticated;
GRANT ALL ON public.oauth_error_logs TO service_role;
ALTER TABLE public.oauth_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can log oauth errors" ON public.oauth_error_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "super admins read oauth errors" ON public.oauth_error_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE INDEX oauth_error_logs_created_idx ON public.oauth_error_logs (created_at DESC);
CREATE INDEX oauth_error_logs_host_idx ON public.oauth_error_logs (host);