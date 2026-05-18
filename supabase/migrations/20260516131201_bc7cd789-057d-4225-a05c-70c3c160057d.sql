
-- =====================================================================
-- ENUM: app_role
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('doctor', 'patient');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- Updated-at trigger function
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- TABLE: user_roles
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

DO $$ BEGIN
  CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own role" ON public.user_roles
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- TABLE: patients
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  age integer NOT NULL,
  gender text NOT NULL DEFAULT 'male',
  marital_status text NOT NULL DEFAULT 'single',
  phone text,
  address text,
  occupation text,
  date_of_birth date,
  avatar_url text,
  height_cm numeric,
  height_feet integer,
  height_inches integer,
  weight numeric,
  allergies text[],
  medical_conditions text[],
  chief_complaint text,
  history_of_present_illness text,
  past_illness_history text,
  drug_history text,
  immunization_history text,
  personal_history text,
  ob_gyn_history text,
  pregnancy_status text,
  previous_childbirths integer,
  physical_activity text,
  socio_economic_status text,
  telegram_id text,
  treatment_history text,
  profile_locked boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors can manage all patients" ON public.patients
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'doctor'::app_role))
    WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can view own record" ON public.patients
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can insert own record" ON public.patients
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can update own record" ON public.patients
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_patients_updated_at ON public.patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- TABLE: patient_reports
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.patient_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  uploaded_by uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  category text NOT NULL DEFAULT 'report' CHECK (category IN ('report', 'prescription')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors can read reports" ON public.patient_reports
    FOR SELECT TO authenticated USING (has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Doctors can delete reports" ON public.patient_reports
    FOR DELETE TO authenticated USING (has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can view own reports" ON public.patient_reports
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can upload own reports" ON public.patient_reports
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can delete own reports" ON public.patient_reports
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- TABLE: appointments
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_phone text,
  patient_email text,
  patient_telegram_id text,
  chief_complaint text,
  appointment_date date NOT NULL,
  time_slot text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  cancel_reason text,
  reschedule_date date,
  reschedule_time_slot text,
  google_event_id text,
  google_meet_link text,
  meet_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors can manage appointments" ON public.appointments
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'doctor'::app_role))
    WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients view own appointments" ON public.appointments
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public can book appointments" ON public.appointments
    FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- get_booked_slots function (publicly callable for booking widget)
CREATE OR REPLACE FUNCTION public.get_booked_slots(target_date date)
RETURNS TABLE(time_slot text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT time_slot FROM public.appointments
  WHERE appointment_date = target_date
    AND status NOT IN ('cancelled', 'rejected');
$$;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;

-- =====================================================================
-- TABLE: doctor_settings
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.doctor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  name_bn text,
  title text,
  title_bn text,
  degrees text NOT NULL DEFAULT '',
  degrees_bn text,
  specialization text,
  specialization_bn text,
  institution text,
  institution_bn text,
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  website text,
  chambers jsonb,
  online_consultation jsonb,
  signature_data_url text,
  telegram_chat_id text,
  twilio_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors manage own settings" ON public.doctor_settings
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public can view doctor settings" ON public.doctor_settings
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_doctor_settings_updated_at ON public.doctor_settings;
CREATE TRIGGER update_doctor_settings_updated_at
  BEFORE UPDATE ON public.doctor_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- TABLE: prescriptions
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid,
  chamber_id text NOT NULL DEFAULT '',
  consultation_type text,
  symptoms text NOT NULL DEFAULT '',
  diagnosis text NOT NULL DEFAULT '',
  examination_findings text,
  tests text,
  advice text,
  follow_up_days text,
  language text NOT NULL DEFAULT 'en',
  medicines jsonb,
  provisional_medicines jsonb,
  is_provisional boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors manage prescriptions" ON public.prescriptions
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'doctor'::app_role))
    WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients view own prescriptions" ON public.prescriptions
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- TABLE: visits
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescription_id uuid,
  date date NOT NULL,
  stage text NOT NULL DEFAULT 'initial',
  chief_complaint text,
  examination_findings text,
  investigations text,
  investigation_notes text,
  provisional_medicines jsonb,
  medicines jsonb,
  final_diagnosis text,
  advice text,
  follow_up_days text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors manage visits" ON public.visits
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'doctor'::app_role))
    WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients view own visits" ON public.visits
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_visits_updated_at ON public.visits;
CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- TABLE: notification_logs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  channel text NOT NULL DEFAULT 'telegram',
  recipient text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'sent',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Doctors view notification logs" ON public.notification_logs
    FOR SELECT TO authenticated USING (has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- TABLE: patient_google_tokens
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.patient_google_tokens (
  user_id uuid PRIMARY KEY,
  refresh_token text NOT NULL,
  access_token text,
  expires_at timestamptz,
  scope text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_google_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own google tokens" ON public.patient_google_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_patient_google_tokens_updated_at ON public.patient_google_tokens;
CREATE TRIGGER update_patient_google_tokens_updated_at
  BEFORE UPDATE ON public.patient_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- STORAGE BUCKETS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('patient-reports', 'patient-reports', false, 20971520,
        ARRAY['image/jpeg','image/jpg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','application/pdf'];

-- Avatars storage policies
DO $$ BEGIN
  CREATE POLICY "Avatars are publicly viewable" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own avatar" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Patient-reports storage policies
DO $$ BEGIN
  CREATE POLICY "Patients view own report files" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'patient-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients upload own report files" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'patient-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients delete own report files" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'patient-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Doctors can read report files" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'patient-reports' AND has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Doctors can delete report files" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'patient-reports' AND has_role(auth.uid(), 'doctor'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
