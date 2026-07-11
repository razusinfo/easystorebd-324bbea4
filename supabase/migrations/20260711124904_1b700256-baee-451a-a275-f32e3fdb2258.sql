DROP POLICY IF EXISTS "Read reseller-images" ON storage.objects;
CREATE POLICY "Read reseller-images" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'reseller-images'
  AND EXISTS (
    SELECT 1 FROM public.reseller_products rp
    WHERE rp.external_id = split_part(storage.objects.name, '/', 1)
      AND rp.image_sync_status = 'ok'
  )
);