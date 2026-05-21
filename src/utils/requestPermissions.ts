import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';

const PERMISSIONS_REQUESTED_KEY = 'app_permissions_requested_v1';

/**
 * Notification permission — requested ONCE on first app launch.
 */
let pushListenersBound = false;
function bindPushListenersOnce() {
  if (pushListenersBound) return;
  pushListenersBound = true;

  PushNotifications.addListener('registration', async (token) => {
    console.log('[push] FCM token registered');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
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
  });
}

export const requestNotificationPermissionOnStart = async () => {
  if (!Capacitor.isNativePlatform()) return;

  const { value } = await Preferences.get({ key: PERMISSIONS_REQUESTED_KEY });
  try {
    bindPushListenersOnce();

    const status = await PushNotifications.checkPermissions();
    let granted = status.receive === 'granted';

    if (!granted && value !== 'true' && (status.receive === 'prompt' || status.receive === 'prompt-with-rationale')) {
      const result = await PushNotifications.requestPermissions();
      granted = result.receive === 'granted';
    }

    if (granted) {
      await PushNotifications.register();
    }

    await Preferences.set({ key: PERMISSIONS_REQUESTED_KEY, value: 'true' });
  } catch (error) {
    console.error('Notification permission error:', error);
  }
};
