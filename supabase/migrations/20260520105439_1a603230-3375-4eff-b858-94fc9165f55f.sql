-- Clean patient-facing test data while preserving doctor/admin configuration and Rahim Ahmed.
-- Schema, roles, settings, storage buckets, and admin panel structure are not changed.

WITH rahim AS (
  SELECT id, user_id
  FROM public.patients
  WHERE id = '44857ea3-ba82-4825-bca4-d6e6013e777e'::uuid
     OR lower(name) = 'rahim ahmed'
     OR name = 'রাহিম আহমেদ'
), non_rahim_patients AS (
  SELECT id, user_id
  FROM public.patients
  WHERE id NOT IN (SELECT id FROM rahim)
), deleted_appointments AS (
  DELETE FROM public.appointments
  WHERE patient_id IN (SELECT id FROM non_rahim_patients)
     OR patient_id IS NULL
     OR (
       lower(patient_name) <> 'rahim ahmed'
       AND patient_name <> 'রাহিম আহমেদ'
       AND patient_id NOT IN (SELECT id FROM rahim)
     )
  RETURNING id
), deleted_prescription_files AS (
  DELETE FROM public.prescription_files
  WHERE patient_id IN (SELECT id FROM non_rahim_patients)
  RETURNING id
), deleted_prescriptions AS (
  DELETE FROM public.prescriptions
  WHERE patient_id IN (SELECT id FROM non_rahim_patients)
  RETURNING id
), deleted_reports AS (
  DELETE FROM public.patient_reports
  WHERE patient_id IN (SELECT id FROM non_rahim_patients)
  RETURNING id
), deleted_visits AS (
  DELETE FROM public.visits
  WHERE patient_id IN (SELECT id FROM non_rahim_patients)
  RETURNING id
), deleted_google_tokens AS (
  DELETE FROM public.patient_google_tokens
  WHERE user_id IN (SELECT user_id FROM non_rahim_patients WHERE user_id IS NOT NULL)
    AND user_id NOT IN (SELECT user_id FROM rahim WHERE user_id IS NOT NULL)
  RETURNING user_id
), deleted_patient_roles AS (
  DELETE FROM public.user_roles
  WHERE role = 'patient'
    AND user_id IN (SELECT user_id FROM non_rahim_patients WHERE user_id IS NOT NULL)
    AND user_id NOT IN (SELECT user_id FROM rahim WHERE user_id IS NOT NULL)
  RETURNING user_id
)
DELETE FROM public.patients
WHERE id IN (SELECT id FROM non_rahim_patients);