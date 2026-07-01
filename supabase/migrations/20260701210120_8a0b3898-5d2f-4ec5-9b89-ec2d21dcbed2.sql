
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('assign_role','revoke_role')),
  role app_role NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND actor_id = auth.uid());

CREATE INDEX idx_admin_audit_logs_target ON public.admin_audit_logs(target_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- Assign role
CREATE OR REPLACE FUNCTION public.admin_assign_role(_target_user_id UUID, _role app_role, _notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_audit_logs (actor_id, target_user_id, action, role, notes)
  VALUES (_actor, _target_user_id, 'assign_role', _role, _notes);
END;
$$;

-- Revoke role
CREATE OR REPLACE FUNCTION public.admin_revoke_role(_target_user_id UUID, _role app_role, _notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
  _remaining_super_admins INT;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  -- Prevent removing the last super_admin
  IF _role = 'super_admin' THEN
    SELECT COUNT(*) INTO _remaining_super_admins
    FROM public.user_roles
    WHERE role = 'super_admin' AND user_id <> _target_user_id;
    IF _remaining_super_admins = 0 THEN
      RAISE EXCEPTION 'Cannot revoke the last super_admin';
    END IF;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id AND role = _role;

  INSERT INTO public.admin_audit_logs (actor_id, target_user_id, action, role, notes)
  VALUES (_actor, _target_user_id, 'revoke_role', _role, _notes);
END;
$$;

-- List audit logs with actor + target email
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(_limit INT DEFAULT 100)
RETURNS TABLE(
  id UUID,
  actor_id UUID,
  actor_email TEXT,
  target_user_id UUID,
  target_email TEXT,
  action TEXT,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin only';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.actor_id,
    (SELECT u.email::text FROM auth.users u WHERE u.id = l.actor_id) AS actor_email,
    l.target_user_id,
    (SELECT u.email::text FROM auth.users u WHERE u.id = l.target_user_id) AS target_email,
    l.action,
    l.role::text,
    l.notes,
    l.created_at
  FROM public.admin_audit_logs l
  ORDER BY l.created_at DESC
  LIMIT _limit;
END;
$$;
