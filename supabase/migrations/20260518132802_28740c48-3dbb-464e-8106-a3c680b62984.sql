-- 1. Appointment session tracking columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_ended_by text,
  ADD COLUMN IF NOT EXISTS meeting_quality text,
  ADD COLUMN IF NOT EXISTS doctor_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS doctor_left_at  timestamptz,
  ADD COLUMN IF NOT EXISTS patient_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_left_at  timestamptz;

-- 2. Storage policies for avatars bucket (user-scoped folder pattern)
-- Drop existing potentially-broken policies first (safe if they don't exist)
DROP POLICY IF EXISTS "Avatars are publicly viewable"   ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar"     ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar"     ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar"     ON storage.objects;

CREATE POLICY "Avatars are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);