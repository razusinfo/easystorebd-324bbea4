
-- 1) phone_otps: lock down explicitly. Server-only (service role / SECURITY DEFINER).
REVOKE ALL ON public.phone_otps FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.phone_otps TO service_role;

-- Explicit "deny all" policies for anon/authenticated so intent is documented,
-- even though absence of policies with RLS enabled already blocks access.
DROP POLICY IF EXISTS "phone_otps_no_client_access" ON public.phone_otps;
CREATE POLICY "phone_otps_no_client_access"
  ON public.phone_otps
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.phone_otps IS
  'OTP verification records. Client access is forbidden; only service_role or SECURITY DEFINER functions may read/write.';

-- 2) site_settings: hide updated_by (admin user id) and low_stock_threshold from public reads.
-- Replace the permissive public SELECT on the base table with a super-admin-only SELECT,
-- and expose a safe projection view for the storefront.

DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;

CREATE POLICY site_settings_super_admin_select
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE VIEW public.site_settings_public
WITH (security_invoker = false) AS
SELECT
  id,
  logo_url,
  favicon_url,
  primary_color,
  sidebar_categories,
  whatsapp_url,
  contact_email,
  contact_phone,
  facebook_url,
  instagram_url,
  updated_at
FROM public.site_settings;

-- View is owned by the migration role and runs with definer semantics,
-- so it bypasses the base-table RLS and only exposes safe columns.
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

COMMENT ON VIEW public.site_settings_public IS
  'Public storefront projection of site_settings. Excludes updated_by (admin id) and low_stock_threshold.';
