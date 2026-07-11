ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS logo_url_dark text,
  ADD COLUMN IF NOT EXISTS asset_version integer NOT NULL DEFAULT 1;