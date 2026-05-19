import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;

/**
 * Register the device for FCM push notifications and store the token in
 * `device_push_tokens`. Safe to call on every app start — it's idempotent.
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
    console.log('[push] FCM token registered');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
    // Upsert on the unique `token` column so the same device only stores once
    // even if it ends up logged into multiple accounts (last-wins ownership).
    await supabase.from('device_push_tokens').upsert(
      { user_id: user.id, token: token.value, platform },
      { onConflict: 'token' },
    );
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] registration error', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notif) => {
    console.log('[push] received in foreground', notif);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[push] tapped', action);
    // Optional: route based on action.notification.data.deeplink
  });
}
