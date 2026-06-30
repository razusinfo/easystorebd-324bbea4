CREATE TABLE public.sms_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  otp_template text NOT NULL DEFAULT 'Your {app} verification code is {code}. It expires in {minutes} minutes. Do not share this code.{signature}',
  signature text NOT NULL DEFAULT '',
  app_name text NOT NULL DEFAULT 'EazyStore',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sms_settings TO authenticated;
GRANT ALL ON public.sms_settings TO service_role;

ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read sms settings"
ON public.sms_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert sms settings"
ON public.sms_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update sms settings"
ON public.sms_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_sms_settings_updated_at
BEFORE UPDATE ON public.sms_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sms_settings (id) VALUES (true) ON CONFLICT DO NOTHING;