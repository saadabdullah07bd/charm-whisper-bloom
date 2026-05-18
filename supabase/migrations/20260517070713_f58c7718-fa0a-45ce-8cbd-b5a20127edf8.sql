-- 1) Fix broken prescriptions storage policy
DROP POLICY IF EXISTS "Patients read own prescription files" ON storage.objects;
CREATE POLICY "Patients read own prescription files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.user_id = auth.uid()
      AND (p.id)::text = (storage.foldername(name))[1]
  )
);

-- 2) Lock down doctor_settings: drop public SELECT, keep safe public columns via the view
DROP POLICY IF EXISTS "Public read safe doctor columns" ON public.doctor_settings;

-- Make the public view bypass RLS so unauthenticated visitors still get safe columns
ALTER VIEW public.doctor_public_info SET (security_invoker = false);
GRANT SELECT ON public.doctor_public_info TO anon, authenticated;

-- 3) Provide a controlled accessor for doctor email used by authenticated patients
CREATE OR REPLACE FUNCTION public.get_doctor_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.doctor_settings LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_doctor_email() FROM public;
GRANT EXECUTE ON FUNCTION public.get_doctor_email() TO authenticated;