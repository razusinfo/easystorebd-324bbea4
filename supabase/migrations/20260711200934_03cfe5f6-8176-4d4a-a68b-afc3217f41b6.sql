
CREATE TABLE public.splash_logo_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('upload','change','remove','toggle')),
  old_path TEXT,
  new_path TEXT,
  affected_scopes TEXT[] NOT NULL DEFAULT '{}'::text[],
  host_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_splash_audit_store_created
  ON public.splash_logo_audit_logs (store_id, created_at DESC);

GRANT SELECT ON public.splash_logo_audit_logs TO authenticated;
GRANT ALL ON public.splash_logo_audit_logs TO service_role;

ALTER TABLE public.splash_logo_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their splash audit logs"
  ON public.splash_logo_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = splash_logo_audit_logs.store_id
        AND s.owner_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Super admin views all splash audit logs"
  ON public.splash_logo_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));
