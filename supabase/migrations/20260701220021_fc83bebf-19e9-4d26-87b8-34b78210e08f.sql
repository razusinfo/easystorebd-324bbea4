-- 1. phone_otps: defense-in-depth. RLS is enabled with no policies (deny by default),
-- but also explicitly revoke any table privileges from anon/authenticated/public
-- so no client role can ever read OTP hashes or phone numbers via PostgREST.
REVOKE ALL ON TABLE public.phone_otps FROM PUBLIC;
REVOKE ALL ON TABLE public.phone_otps FROM anon;
REVOKE ALL ON TABLE public.phone_otps FROM authenticated;
GRANT ALL ON TABLE public.phone_otps TO service_role;

-- 2. Admin SECURITY DEFINER RPCs: remove public/anon/authenticated EXECUTE.
-- These are now called only via server functions running with the service role.
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_audit_logs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assign_role(uuid, public.app_role, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, public.app_role, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text) TO service_role;

-- 3. Rewrite the admin RPCs to accept an explicit actor id (verified by the
-- server function before invocation) instead of reading auth.uid(), so they
-- work when called with the service role.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    COALESCE(
      NULLIF(u.raw_user_meta_data->>'full_name', ''),
      NULLIF(u.raw_user_meta_data->>'name', ''),
      split_part(u.email::text, '@', 1)
    ) AS full_name,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(
      (SELECT array_agg(ur.role::text ORDER BY ur.role::text)
       FROM public.user_roles ur WHERE ur.user_id = u.id),
      ARRAY[]::text[]
    ) AS roles
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, actor_id uuid, actor_email text, target_user_id uuid, target_email text, action text, role text, notes text, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_role(_target_user_id uuid, _role public.app_role, _notes text DEFAULT NULL::text, _actor_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'actor id required';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_audit_logs (actor_id, target_user_id, action, role, notes)
  VALUES (_actor_id, _target_user_id, 'assign_role', _role, _notes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_target_user_id uuid, _role public.app_role, _notes text DEFAULT NULL::text, _actor_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _remaining_super_admins INT;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'actor id required';
  END IF;

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
  VALUES (_actor_id, _target_user_id, 'revoke_role', _role, _notes);
END;
$function$;

-- Ensure the new signatures are only callable by the service role.
REVOKE ALL ON FUNCTION public.admin_assign_role(uuid, public.app_role, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, public.app_role, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text, uuid) TO service_role;