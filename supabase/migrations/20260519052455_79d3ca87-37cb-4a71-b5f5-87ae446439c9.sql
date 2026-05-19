-- Enable extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule prior version if it exists (idempotent reruns)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'appointment-reminders-every-minute') THEN
    PERFORM cron.unschedule('appointment-reminders-every-minute');
  END IF;
END $$;

-- Every minute, invoke the appointment-reminders edge function.
-- Sends 10-minute pre-appointment reminders to both patient and doctor.
SELECT cron.schedule(
  'appointment-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwlmqpjtesjwvujsquiu.supabase.co/functions/v1/appointment-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bG1xcGp0ZXNqd3Z1anNxdWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MjcyNTksImV4cCI6MjA5NDUwMzI1OX0.sbw5QOUGd3OiRyXDmpDqwhqIB66u3dmvNvkYnSN9yog"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);