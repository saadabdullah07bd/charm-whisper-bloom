// Client-side helper to send a native push notification to a user via the
// `send-push` edge function. Safe to await — failures are logged but never
// thrown, so a failed push never blocks the calling UI flow.
import { supabase } from '@/integrations/supabase/client';

export async function notifyUser(
  userId: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await supabase.functions.invoke('send-push', {
      body: { userId, title, body, data: data ?? {} },
    });
    if (error) console.warn('[push] send-push error', error);
  } catch (e) {
    console.warn('[push] send-push failed', e);
  }
}

let cachedDoctorUserId: string | null = null;
export async function getDoctorUserId(): Promise<string | null> {
  if (cachedDoctorUserId) return cachedDoctorUserId;
  const { data } = await supabase
    .from('doctor_settings')
    .select('user_id')
    .limit(1)
    .maybeSingle();
  cachedDoctorUserId = (data?.user_id as string) ?? null;
  return cachedDoctorUserId;
}
