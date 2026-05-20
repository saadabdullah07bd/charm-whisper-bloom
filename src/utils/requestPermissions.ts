import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';

const PERMISSIONS_REQUESTED_KEY = 'app_permissions_requested_v1';

/**
 * Notification permission — requested ONCE on first app launch.
 * Persists a flag in Capacitor Preferences so subsequent launches don't re-prompt.
 * On grant, registers the device for FCM and upserts the token into
 * `device_push_tokens` (same logic as the previous initPushNotifications).
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
  // Even if we've prompted before, we still want to (re)register so the
  // token listener fires and the row gets refreshed. Just don't re-prompt.
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

/**
 * Camera + Microphone — requested ONLY immediately before joining a video
 * call. Returns true if both are granted.
 *
 * - Camera: requested via `@capacitor/camera` (triggers Android runtime perm).
 * - Microphone: requested via `getUserMedia({ audio: true })` which surfaces
 *   the native Android mic dialog because MainActivity is patched to grant
 *   WebView mic requests. The probe stream is stopped immediately.
 */
export const requestCameraAndMicForVideoCall = async (): Promise<boolean> => {
  // On the web we let the browser prompt at getUserMedia time inside Daily.
  if (!Capacitor.isNativePlatform()) return true;

  let cameraGranted = false;
  let micGranted = false;

  // Camera
  try {
    let camStatus = await Camera.checkPermissions();
    if (camStatus.camera !== 'granted') {
      camStatus = await Camera.requestPermissions({ permissions: ['camera'] });
    }
    cameraGranted = camStatus.camera === 'granted';
  } catch (e) {
    console.error('[perms] camera request failed', e);
  }

  // Microphone (no official Capacitor plugin — probe via getUserMedia).
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    micGranted = true;
  } catch (e) {
    console.error('[perms] microphone request failed', e);
    micGranted = false;
  }

  const success = cameraGranted && micGranted;
  if (!success) {
    const missing = [
      !cameraGranted && 'Camera',
      !micGranted && 'Microphone',
    ].filter(Boolean).join(' and ');
    alert(`${missing} permission is required to join the video call. Please enable it in Settings.`);
  }
  return success;
};
