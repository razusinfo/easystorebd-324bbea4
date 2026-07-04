CREATE TABLE public.notification_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  from_email TEXT NOT NULL DEFAULT 'orders@resend.dev',
  from_name TEXT NOT NULL DEFAULT 'EazyStore',
  reply_to TEXT,
  notify_customer BOOLEAN NOT NULL DEFAULT true,
  notify_reseller BOOLEAN NOT NULL DEFAULT true,
  statuses_email TEXT[] NOT NULL DEFAULT ARRAY['pending','confirmed','shipped','delivered','cancelled'],
  statuses_sms TEXT[] NOT NULL DEFAULT ARRAY['pending','confirmed','shipped','delivered','cancelled'],
  delivery_eta TEXT NOT NULL DEFAULT '3-5 business days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated can read notification settings"
ON public.notification_settings FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Super admins can update notification settings"
ON public.notification_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert notification settings"
ON public.notification_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_settings (id) VALUES (true) ON CONFLICT DO NOTHING;