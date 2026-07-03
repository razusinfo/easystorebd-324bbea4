ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS image_url TEXT;

DROP POLICY IF EXISTS "cat_img_read_own" ON storage.objects;
DROP POLICY IF EXISTS "cat_img_write_own" ON storage.objects;
DROP POLICY IF EXISTS "cat_img_update_own" ON storage.objects;
DROP POLICY IF EXISTS "cat_img_delete_own" ON storage.objects;

CREATE POLICY "cat_img_read_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'category-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cat_img_write_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'category-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cat_img_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'category-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cat_img_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'category-images' AND (storage.foldername(name))[1] = auth.uid()::text);