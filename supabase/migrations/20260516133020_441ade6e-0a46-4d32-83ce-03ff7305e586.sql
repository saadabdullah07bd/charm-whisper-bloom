-- Drop overly broad avatars listing policy. Files in public buckets remain
-- accessible via direct CDN URL; this only prevents enumerating the bucket.
DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;

-- Tighten the "Public can book appointments" INSERT policy so it is not WITH CHECK (true).
DROP POLICY IF EXISTS "Public can book appointments" ON public.appointments;
CREATE POLICY "Public can book appointments" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    appointment_date >= CURRENT_DATE
    AND char_length(patient_name) BETWEEN 1 AND 200
    AND char_length(time_slot) BETWEEN 1 AND 50
    AND status = 'pending'
  );

-- Revoke direct EXECUTE on has_role from clients. RLS policies still call it
-- via SECURITY DEFINER from inside the server, but it should not be exposed
-- as an RPC endpoint to anon or signed-in users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;