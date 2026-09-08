ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS cover_url text;

-- covers bucket RLS: owners manage their own folder (<uid>/...)
CREATE POLICY "Users can upload own covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own covers"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);