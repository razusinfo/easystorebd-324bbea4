
-- Drop the security-definer view flagged by the linter.
DROP VIEW IF EXISTS public.site_settings_public;

-- Restore public SELECT on the base table, but use column-level privileges
-- so anon / authenticated cannot project updated_by or low_stock_threshold.
DROP POLICY IF EXISTS site_settings_super_admin_select ON public.site_settings;

CREATE POLICY site_settings_public_read
  ON public.site_settings
  FOR SELECT
  USING (true);

-- Reset then grant only the safe columns to anon/authenticated.
REVOKE SELECT ON public.site_settings FROM anon, authenticated;

GRANT SELECT (
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
  created_at,
  updated_at
) ON public.site_settings TO anon, authenticated;

-- Super admins keep full-column visibility for the admin settings page.
GRANT SELECT ON public.site_settings TO service_role;
