
-- Lock down notification_logs writes to doctors only (explicit; default-deny was already in effect)
CREATE POLICY "Doctors insert notification logs"
  ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));

CREATE POLICY "Doctors update notification logs"
  ON public.notification_logs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'doctor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));

CREATE POLICY "Doctors delete notification logs"
  ON public.notification_logs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'doctor'::app_role));

-- Remove broad public SELECT on avatars bucket (files remain reachable via public URLs;
-- the SELECT policy only enabled directory listing).
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
