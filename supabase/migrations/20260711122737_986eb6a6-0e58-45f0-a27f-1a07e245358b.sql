
-- Setting toggle
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS unknown_tenant_redirect boolean NOT NULL DEFAULT false;

-- Audit table
CREATE TABLE IF NOT EXISTS public.tenant_resolver_audit (
  host text PRIMARY KEY,
  kind text NOT NULL,
  attempted text,
  hit_count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenant_resolver_audit TO authenticated;
GRANT ALL    ON public.tenant_resolver_audit TO service_role;

ALTER TABLE public.tenant_resolver_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can read tenant audit"
  ON public.tenant_resolver_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_tenant_resolver_audit_last_seen
  ON public.tenant_resolver_audit (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_resolver_audit_hits
  ON public.tenant_resolver_audit (hit_count DESC);
