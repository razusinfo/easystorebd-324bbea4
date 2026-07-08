
-- 1. Add image-sync tracking + category-missing reason to reseller_products
ALTER TABLE public.reseller_products
  ADD COLUMN IF NOT EXISTS image_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS image_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS image_sync_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category_missing_reason TEXT;

-- 2. Configurable category mapping table.
--    Admin defines, per supplier `source` (NULL = default fallback for all),
--    an ordered list of dotted JSON paths into the webhook payload plus an
--    optional literal fallback value.
CREATE TABLE IF NOT EXISTS public.reseller_category_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT,
  payload_path TEXT,
  fallback_value TEXT,
  priority INT NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reseller_category_mappings_has_source_or_value
    CHECK (payload_path IS NOT NULL OR fallback_value IS NOT NULL)
);

GRANT SELECT ON public.reseller_category_mappings TO authenticated;
GRANT ALL ON public.reseller_category_mappings TO service_role;

ALTER TABLE public.reseller_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read category mappings"
  ON public.reseller_category_mappings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins manage category mappings"
  ON public.reseller_category_mappings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER reseller_category_mappings_set_updated_at
  BEFORE UPDATE ON public.reseller_category_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Marker RPC for retry (actual rehost runs in a server function using
--    service-role; this RPC exists so we can call from the client through
--    RLS-safe channels if needed). The server function itself will use
--    supabaseAdmin, so we only need a permission check helper here.
CREATE OR REPLACE FUNCTION public.can_manage_reseller_sync(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin');
$$;
