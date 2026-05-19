
-- 1) Tighten appointments INSERT policy: drop public anon access, require auth + own patient row
DROP POLICY IF EXISTS "Public can book appointments" ON public.appointments;

CREATE POLICY "Patients can book own appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  appointment_date >= CURRENT_DATE
  AND char_length(patient_name) BETWEEN 1 AND 200
  AND char_length(time_slot) BETWEEN 1 AND 50
  AND status = 'pending'
  AND patient_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = appointments.patient_id
      AND p.user_id = auth.uid()
  )
);

-- 2) Prevent doctor role self-assignment via trigger
CREATE OR REPLACE FUNCTION public.prevent_doctor_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'doctor' THEN
    -- Only the service_role (bypasses RLS / called via service key) may assign doctor.
    -- auth.role() returns 'service_role' for service-role calls, 'authenticated' for users.
    IF coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Only administrators may assign the doctor role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_doctor_role_escalation ON public.user_roles;
CREATE TRIGGER trg_prevent_doctor_role_escalation
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_doctor_role_escalation();

-- 3) Recreate doctor_public_info view with security_invoker so RLS of caller applies
DROP VIEW IF EXISTS public.doctor_public_info;
CREATE VIEW public.doctor_public_info
WITH (security_invoker = true) AS
SELECT id, name, name_bn, degrees, degrees_bn, specialization, specialization_bn,
       title, title_bn, institution, institution_bn, website, letterhead_url
FROM public.doctor_settings;

GRANT SELECT ON public.doctor_public_info TO anon, authenticated;
