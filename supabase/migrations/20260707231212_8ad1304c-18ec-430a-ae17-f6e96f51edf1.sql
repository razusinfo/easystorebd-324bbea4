CREATE POLICY "Read reseller-images" ON storage.objects FOR SELECT USING (bucket_id = 'reseller-images');
CREATE POLICY "Service write reseller-images" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'reseller-images');
CREATE POLICY "Service update reseller-images" ON storage.objects FOR UPDATE TO service_role USING (bucket_id = 'reseller-images');