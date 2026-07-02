
-- 1) Lock down SECURITY DEFINER functions from anonymous callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2) Allow the public to read logos of published stores from the private store-logos bucket.
--    Logos are stored under `<owner_user_id>/...` folders.
DROP POLICY IF EXISTS "Public can read logos of published stores" ON storage.objects;
CREATE POLICY "Public can read logos of published stores"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'store-logos'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.published = true
      AND s.owner_user_id::text = (storage.foldername(storage.objects.name))[1]
  )
);
