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

export type CameraMicPermissionResult =
  | { granted: true; stream: MediaStream }
  | { granted: false; message: string; errorName?: string };

const describeMediaError = (err: unknown): { message: string; errorName?: string } => {
  const name = err instanceof Error ? err.name : 'UnknownError';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      errorName: name,
      message: 'Camera or microphone permission was blocked. Please allow both permissions for Shifora in Android app settings, then try again.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return { errorName: name, message: 'No usable camera or microphone was found on this device.' };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return { errorName: name, message: 'Camera or microphone is already being used by another app. Close it and try again.' };
  }
  return { errorName: name, message: 'Could not open camera and microphone. Please check device permissions and try again.' };
};

/**
 * Request camera + microphone from the browser/WebView. This must be called
 * directly from a user click. Do not await Capacitor Camera first: that plugin
 * only covers photo camera permission, not microphone, and can break the
 * getUserMedia user-gesture chain on Android WebView.
 */
export const requestCameraMicStream = async (): Promise<CameraMicPermissionResult> => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { granted: false, message: 'Camera and microphone are not available in this app view.' };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    return { granted: true, stream };
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : 'UnknownError';
    const message = err instanceof Error ? err.message : String(err);
    console.error('[perms] camera/mic denied', name, message);
    return { granted: false, ...describeMediaError(err) };
  }
};

export const stopMediaStream = (stream: MediaStream | null | undefined) => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const requestCameraMicPermissions = async (): Promise<boolean> => {
  const result = await requestCameraMicStream();
  if (!result.granted) return false;
  stopMediaStream(result.stream);
  return true;
};

