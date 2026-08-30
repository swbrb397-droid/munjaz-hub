-- AVATARS (also used for listing cover images): signed-in read, owner-folder write
CREATE POLICY "Signed-in users read avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- DIGITAL VAULT: path layout is <order_id>/<filename>
CREATE POLICY "Order parties read vault" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'digital-vault'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.is_order_party(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
CREATE POLICY "Order parties upload vault" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'digital-vault'
    AND public.is_order_party(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "Order parties delete vault" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'digital-vault'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.is_order_party(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

-- KYC DOCUMENTS: owner folder only, admins may review
CREATE POLICY "Owner and admins read kyc" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "Owner uploads kyc" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner deletes kyc" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);