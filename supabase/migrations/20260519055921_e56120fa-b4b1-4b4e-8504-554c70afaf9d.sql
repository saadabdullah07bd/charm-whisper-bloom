
-- Clean duplicate / legacy avatar policies
DROP POLICY IF EXISTS "Avatars are publicly viewable"   ON storage.objects;
DROP POLICY IF EXISTS "Public can read avatars"         ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar"         ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar"         ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar"         ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar"     ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar"     ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar"     ON storage.objects;

-- Public read (avatars are public profile pictures)
CREATE POLICY "Avatars are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users may upload to their own user-id folder
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Bump bucket size limit to match the 8 MB the client UI accepts
UPDATE storage.buckets
SET file_size_limit = 8 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'avatars';
