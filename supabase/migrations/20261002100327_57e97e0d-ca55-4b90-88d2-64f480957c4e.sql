DROP POLICY IF EXISTS "Users can read own covers" ON storage.objects;
CREATE POLICY "Public read covers" ON storage.objects FOR SELECT TO public USING (bucket_id = 'covers');
CREATE POLICY "Users update own covers" ON storage.objects FOR UPDATE TO authenticated
 USING (bucket_id='covers' AND (storage.foldername(name))[1] = auth.uid()::text)
 WITH CHECK (bucket_id='covers' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Signed-in users read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar files" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar files" ON storage.objects;
DROP POLICY IF EXISTS "Admins read deliverable files" ON storage.objects;
CREATE POLICY "Admins and moderators read deliverable files" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='digital-deliverables' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')));
DROP POLICY IF EXISTS "Order parties read vault" ON storage.objects;
CREATE POLICY "Order parties read vault" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='digital-vault' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR public.is_order_party(((storage.foldername(name))[1])::uuid, auth.uid())));
DROP POLICY IF EXISTS "Order parties upload dispute evidence" ON storage.objects;
DROP POLICY IF EXISTS "kyc docs own read" ON storage.objects;
DROP POLICY IF EXISTS "kyc docs own upload" ON storage.objects;