
CREATE POLICY "Owners read own store logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'store-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners upload own store logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update own store logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners delete own store logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
