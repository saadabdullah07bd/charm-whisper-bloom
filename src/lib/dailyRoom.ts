import { supabase } from '@/integrations/supabase/client';

export interface DailyJoin {
  url: string;
  token: string | null;
  room: string;
  isDoctor: boolean;
}

/** Request a Daily.co room URL + meeting token for the given appointment. */
export async function getDailyJoin(
  appointmentId: string,
  displayName?: string,
): Promise<DailyJoin | null> {
  try {
    const { data, error } = await supabase.functions.invoke('daily-room', {
      body: { appointmentId, displayName },
    });
    const d = (data ?? {}) as any;
    if (error) {
      const serverMsg = d?.error || (error as any)?.message || 'Daily room request failed';
      console.error('Daily room error:', serverMsg, d);
      throw new Error(serverMsg);
    }
    if (!d?.url) throw new Error(d?.error || 'Daily room response did not include a URL');
    return { url: d.url, token: d.token ?? null, room: d.room, isDoctor: !!d.isDoctor };
  } catch (err) {
    console.error('Daily room request failed:', err);
    throw err;
  }
}
