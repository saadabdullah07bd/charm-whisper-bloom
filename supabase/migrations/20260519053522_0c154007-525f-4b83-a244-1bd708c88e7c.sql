-- Push tokens table
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android','ios','web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_push_tokens_token_uidx ON public.device_push_tokens(token);
CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx ON public.device_push_tokens(user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.device_push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON public.device_push_tokens
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Doctors can read all push tokens" ON public.device_push_tokens;
CREATE POLICY "Doctors can read all push tokens"
  ON public.device_push_tokens
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::app_role));

CREATE TRIGGER device_push_tokens_set_updated_at
  BEFORE UPDATE ON public.device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Schedule daily-appointment-digest at 5 PM Bangladesh (UTC+6) = 11:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-appointment-digest-5pm-bd') THEN
    PERFORM cron.unschedule('daily-appointment-digest-5pm-bd');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-appointment-digest-5pm-bd',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwlmqpjtesjwvujsquiu.supabase.co/functions/v1/daily-appointment-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bG1xcGp0ZXNqd3Z1anNxdWl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODkyNzI1OSwiZXhwIjoyMDk0NTAzMjU5fQ.6oRMyJTHEEuYAB_kBkdypEFRWzmaKEHzbU2cQbLOpqM"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);