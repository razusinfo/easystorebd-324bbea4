
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;

CREATE POLICY "Public read approved product images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.published = true
      AND p.status = 'approved'
      AND (s.owner_user_id)::text = (storage.foldername(objects.name))[1]
      AND (
        p.image_url LIKE '%' || objects.name || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(p.gallery_urls) g WHERE g LIKE '%' || objects.name || '%'
        )
      )
  )
);
