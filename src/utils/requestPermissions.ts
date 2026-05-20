import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
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

export interface MediaPermissionResult {
  ok: boolean;
  cameraGranted: boolean;
  micGranted: boolean;
  /** True if at least one permission was permanently denied (user must open settings). */
  permanentlyDenied: boolean;
}

/**
 * Camera + Microphone — requested ONLY immediately before joining a video
 * call. Returns a structured result; the caller is responsible for any UI.
 *
 * - Camera: requested via `@capacitor/camera` (triggers Android runtime perm).
 * - Microphone: requested via `getUserMedia({ audio: true })` which triggers
 *   MainActivity's WebChromeClient → ActivityCompat.requestPermissions and
 *   surfaces the native RECORD_AUDIO dialog the first time.
 */
export const requestCameraAndMicForVideoCall = async (): Promise<MediaPermissionResult> => {
  // On the web we let the browser prompt at getUserMedia time inside Daily.
  if (!Capacitor.isNativePlatform()) {
    return { ok: true, cameraGranted: true, micGranted: true, permanentlyDenied: false };
  }

  let cameraGranted = false;
  let micGranted = false;
  let permanentlyDenied = false;

  // ── Camera ───────────────────────────────────────────────────────────
  try {
    let camStatus = await Camera.checkPermissions();
    if (camStatus.camera !== 'granted') {
      camStatus = await Camera.requestPermissions({ permissions: ['camera'] });
    }
    cameraGranted = camStatus.camera === 'granted';
    if (camStatus.camera === 'denied') permanentlyDenied = true;
  } catch (e) {
    console.error('[perms] camera request failed', e);
  }

  // ── Microphone (probe via getUserMedia, surfaces native dialog) ──────
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    micGranted = true;
  } catch (e: any) {
    console.error('[perms] microphone request failed', e);
    // NotAllowedError = user denied; SecurityError can mean "don't ask again".
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
      permanentlyDenied = true;
    }
    micGranted = false;
  }

  return { ok: cameraGranted && micGranted, cameraGranted, micGranted, permanentlyDenied };
};
