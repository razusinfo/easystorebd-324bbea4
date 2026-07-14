
CREATE POLICY "mp_banners_admin_write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'marketplace-banners' AND public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (bucket_id = 'marketplace-banners' AND public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "mp_banners_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marketplace-banners' AND public.has_role(auth.uid(),'super_admin'));
