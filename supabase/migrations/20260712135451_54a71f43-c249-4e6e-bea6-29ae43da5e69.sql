
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.reseller_site_status AS ENUM ('not_created','inactive','live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.reseller_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_user_id UUID,
  subdomain TEXT,
  status public.reseller_site_status NOT NULL DEFAULT 'not_created',
  first_published_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  change_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reseller_sites_subdomain_unique
  ON public.reseller_sites (subdomain) WHERE subdomain IS NOT NULL;

GRANT SELECT ON public.reseller_sites TO authenticated;
GRANT ALL ON public.reseller_sites TO service_role;

ALTER TABLE public.reseller_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their site" ON public.reseller_sites;
CREATE POLICY "Owners can view their site" ON public.reseller_sites
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_reseller_sites_updated_at ON public.reseller_sites;
CREATE TRIGGER trg_reseller_sites_updated_at
  BEFORE UPDATE ON public.reseller_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync trigger: mirror stores → reseller_sites
CREATE OR REPLACE FUNCTION public.sync_reseller_site_from_store()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _status public.reseller_site_status;
  _existing public.reseller_sites%ROWTYPE;
  _slug_changed BOOLEAN;
BEGIN
  IF NEW.slug IS NULL OR length(NEW.slug) = 0 THEN
    _status := 'not_created';
  ELSIF COALESCE(NEW.published, false) THEN
    _status := 'live';
  ELSE
    _status := 'inactive';
  END IF;

  SELECT * INTO _existing FROM public.reseller_sites WHERE store_id = NEW.id;
  _slug_changed := _existing.subdomain IS DISTINCT FROM NEW.slug;

  INSERT INTO public.reseller_sites
    (store_id, owner_user_id, subdomain, status, first_published_at, last_changed_at, change_count)
  VALUES (
    NEW.id, NEW.owner_user_id, NEW.slug, _status,
    CASE WHEN _status = 'live' THEN COALESCE(NEW.published_at, now()) ELSE NULL END,
    CASE WHEN NEW.slug IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN NEW.slug IS NOT NULL THEN 1 ELSE 0 END
  )
  ON CONFLICT (store_id) DO UPDATE SET
    owner_user_id = EXCLUDED.owner_user_id,
    subdomain = EXCLUDED.subdomain,
    status = EXCLUDED.status,
    first_published_at = COALESCE(public.reseller_sites.first_published_at,
                                  CASE WHEN EXCLUDED.status = 'live' THEN COALESCE(NEW.published_at, now()) END),
    last_changed_at = CASE WHEN _slug_changed THEN now() ELSE public.reseller_sites.last_changed_at END,
    change_count = public.reseller_sites.change_count + CASE WHEN _slug_changed THEN 1 ELSE 0 END,
    updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_reseller_site ON public.stores;
CREATE TRIGGER trg_sync_reseller_site
  AFTER INSERT OR UPDATE OF slug, published, published_at, owner_user_id ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_site_from_store();

-- Backfill
INSERT INTO public.reseller_sites (store_id, owner_user_id, subdomain, status,
                                   first_published_at, last_changed_at, change_count)
SELECT s.id, s.owner_user_id, s.slug,
       CASE WHEN s.slug IS NULL THEN 'not_created'::public.reseller_site_status
            WHEN COALESCE(s.published,false) THEN 'live'::public.reseller_site_status
            ELSE 'inactive'::public.reseller_site_status END,
       CASE WHEN COALESCE(s.published,false) THEN s.published_at ELSE NULL END,
       CASE WHEN s.slug IS NOT NULL THEN COALESCE(s.updated_at, now()) ELSE NULL END,
       CASE WHEN s.slug IS NOT NULL THEN 1 ELSE 0 END
FROM public.stores s
ON CONFLICT (store_id) DO NOTHING;

-- Server-side uniqueness RPC (safe: returns boolean, no data leak)
CREATE OR REPLACE FUNCTION public.check_subdomain_available(_slug TEXT, _store_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE slug = lower(_slug)
      AND (_store_id IS NULL OR id <> _store_id)
  );
$$;

REVOKE ALL ON FUNCTION public.check_subdomain_available(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_subdomain_available(TEXT, UUID) TO authenticated;
