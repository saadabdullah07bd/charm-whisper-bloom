ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_meet_link text,
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS doctor_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS doctor_left_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_left_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_ended_by text,
  ADD COLUMN IF NOT EXISTS meeting_quality text;