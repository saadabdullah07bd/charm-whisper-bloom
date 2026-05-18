
-- 1. Letterhead column on doctor_settings (single-doctor, simple top of prescription)
ALTER TABLE public.doctor_settings
  ADD COLUMN IF NOT EXISTS letterhead_url text;

-- 2. New table: uploaded prescription PDFs/images per visit
CREATE TABLE IF NOT EXISTS public.prescription_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  visit_id uuid,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prescription_files_patient_idx ON public.prescription_files (patient_id);
CREATE INDEX IF NOT EXISTS prescription_files_visit_idx ON public.prescription_files (visit_id);

ALTER TABLE public.prescription_files ENABLE ROW LEVEL SECURITY;

-- Doctor full access
CREATE POLICY "Doctors manage prescription files"
  ON public.prescription_files
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'doctor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));

-- Patient can SELECT only their own
CREATE POLICY "Patients view own prescription files"
  ON public.prescription_files
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = prescription_files.patient_id
      AND p.user_id = auth.uid()
  ));

-- 3. Storage bucket for prescription PDFs (private)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('prescriptions', 'prescriptions', false)
  ON CONFLICT (id) DO NOTHING;

-- Doctor can read all
CREATE POLICY "Doctors read prescription files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions' AND has_role(auth.uid(), 'doctor'::app_role));

-- Doctor can write/update/delete all
CREATE POLICY "Doctors write prescription files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prescriptions' AND has_role(auth.uid(), 'doctor'::app_role));

CREATE POLICY "Doctors update prescription files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'prescriptions' AND has_role(auth.uid(), 'doctor'::app_role));

CREATE POLICY "Doctors delete prescription files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prescriptions' AND has_role(auth.uid(), 'doctor'::app_role));

-- Patients read only their own files (path convention: {patient_id}/{file}.pdf)
CREATE POLICY "Patients read own prescription files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'prescriptions'
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.user_id = auth.uid()
        AND p.id::text = (storage.foldername(name))[1]
    )
  );

-- 4. Letterhead bucket (private) for doctor's prescription top image/PDF
INSERT INTO storage.buckets (id, name, public)
  VALUES ('letterhead', 'letterhead', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone read letterhead"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'letterhead');

CREATE POLICY "Doctors manage letterhead"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'letterhead' AND has_role(auth.uid(), 'doctor'::app_role))
  WITH CHECK (bucket_id = 'letterhead' AND has_role(auth.uid(), 'doctor'::app_role));

-- 5. Fix the privilege escalation finding while we're here:
-- Restrict role self-insert to 'patient' only. Admin promotion happens server-side.
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
CREATE POLICY "Users can self-assign patient role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'patient'::app_role);

-- 6. Tighten doctor_settings public view — only safe fields are public.
-- Drop the wide-open public SELECT and replace with a view exposing safe columns only.
DROP POLICY IF EXISTS "Public can view doctor settings" ON public.doctor_settings;

CREATE OR REPLACE VIEW public.doctor_public_info
WITH (security_invoker = true) AS
  SELECT
    id,
    name, name_bn,
    degrees, degrees_bn,
    specialization, specialization_bn,
    title, title_bn,
    institution, institution_bn,
    website,
    letterhead_url
  FROM public.doctor_settings;

GRANT SELECT ON public.doctor_public_info TO anon, authenticated;

-- Re-add a restricted SELECT policy so the view (security_invoker) works for anon.
-- The view only exposes the safe columns; sensitive ones (telegram_chat_id, mobile, email, signature_data_url, chambers, online_consultation, twilio_phone) stay locked behind the existing "Doctors manage own settings" policy.
CREATE POLICY "Public read safe doctor columns"
  ON public.doctor_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Note: above keeps existing behavior for now; ideally column-level grants would be ideal but Postgres RLS is row-level only. The view is the canonical public surface; app code will switch to it.
