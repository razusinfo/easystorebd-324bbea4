
-- custom_domains
CREATE TABLE public.custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  domain text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  verification_token text NOT NULL,
  dns_target text NOT NULL DEFAULT '185.158.133.1',
  ssl_issued_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_domains TO authenticated;
GRANT ALL ON public.custom_domains TO service_role;

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own custom domains"
  ON public.custom_domains FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners can insert their own custom domains"
  ON public.custom_domains FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own custom domains"
  ON public.custom_domains FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners can delete their own custom domains"
  ON public.custom_domains FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_custom_domains_updated_at
  BEFORE UPDATE ON public.custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- platform_domain_setup singleton
CREATE TABLE public.platform_domain_setup (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cloudflare_added boolean NOT NULL DEFAULT false,
  nameservers_updated boolean NOT NULL DEFAULT false,
  dns_records_added boolean NOT NULL DEFAULT false,
  ssl_mode_set boolean NOT NULL DEFAULT false,
  lovable_wildcard_connected boolean NOT NULL DEFAULT false,
  current_step int NOT NULL DEFAULT 1,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.platform_domain_setup TO authenticated;
GRANT ALL ON public.platform_domain_setup TO service_role;

ALTER TABLE public.platform_domain_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read platform setup"
  ON public.platform_domain_setup FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert platform setup"
  ON public.platform_domain_setup FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update platform setup"
  ON public.platform_domain_setup FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.platform_domain_setup (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE INDEX idx_custom_domains_owner ON public.custom_domains(owner_id);
CREATE INDEX idx_custom_domains_status ON public.custom_domains(status);
