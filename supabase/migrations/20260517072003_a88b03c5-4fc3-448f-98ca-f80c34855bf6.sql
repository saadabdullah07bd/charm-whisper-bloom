DROP POLICY IF EXISTS "Patients read own prescription files" ON storage.objects;
CREATE POLICY "Patients read own prescription files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = (storage.foldername(storage.objects.name))[1]
  )
);