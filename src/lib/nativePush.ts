import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;

/**
 * Register the device for FCM push notifications and store the token
 * on the user's profile (table: profiles.push_token — adjust as needed).
 */
export async function initPushNotifications() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  const perm = await PushNotifications.checkPermissions();
  let status = perm.receive;
  if (status === 'prompt' || status === 'prompt-with-rationale') {
    status = (await PushNotifications.requestPermissions()).receive;
  }
  if (status !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    console.log('[push] FCM token:', token.value);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Best-effort — silently ignore if column/table doesn't exist yet.
      await supabase
        .from('profiles' as any)
        .update({ push_token: token.value } as any)
        .eq('id', user.id);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] registration error', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notif) => {
    console.log('[push] received', notif);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[push] action', action);
  });
}
