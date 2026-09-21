CREATE POLICY "Sellers manage own deliverable files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'digital-deliverables' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'digital-deliverables' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Buyers read purchased deliverable files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'digital-deliverables'
  AND EXISTS (
    SELECT 1
    FROM public.listing_instant_delivery d
    JOIN public.orders o ON o.listing_id = d.listing_id
    WHERE d.file_path = storage.objects.name
      AND o.buyer_id = auth.uid()
      AND o.status = 'completed'
  )
);

CREATE POLICY "Admins read deliverable files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'digital-deliverables' AND public.has_role(auth.uid(), 'admin'));