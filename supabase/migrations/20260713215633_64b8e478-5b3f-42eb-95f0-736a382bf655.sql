CREATE OR REPLACE FUNCTION public.record_reseller_site_event(
  _kind text,
  _store_id uuid,
  _slug text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _store public.stores;
  _title text;
  _body text;
  _link text;
  _type text;
  _id uuid;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF _kind NOT IN ('created','changed') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  SELECT * INTO _store FROM public.stores WHERE id = _store_id;
  IF _store.id IS NULL THEN
    RAISE EXCEPTION 'store not found';
  END IF;
  IF _store.owner_user_id <> _actor AND NOT public.has_role(_actor, 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _type := CASE WHEN _kind = 'created' THEN 'reseller_site_created' ELSE 'reseller_site_changed' END;
  _title := CASE WHEN _kind = 'created' THEN 'New reseller website published' ELSE 'Reseller changed website name' END;
  _body := _store.name || ' → ' || _slug || '.easystorebd.com';
  _link := 'https://' || _slug || '.easystorebd.com';

  INSERT INTO public.admin_notifications (type, title, body, link, related_id)
  VALUES (_type, _title, _body, _link, _store_id::text)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_reseller_site_event(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_reseller_site_event(text, uuid, text) TO authenticated;