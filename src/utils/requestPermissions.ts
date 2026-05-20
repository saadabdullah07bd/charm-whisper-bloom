import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';
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

type NativePermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | string;

interface NativeMediaPermissionStatus {
  camera: NativePermissionState;
  microphone: NativePermissionState;
}

const NativeMediaPermissions = registerPlugin<{
  check(): Promise<NativeMediaPermissionStatus>;
  request(): Promise<NativeMediaPermissionStatus>;
}>('ShiforaMediaPermissions');

const isGranted = (state?: NativePermissionState) => state === 'granted';

/**
 * Camera + Microphone — requested ONLY immediately before joining a video
 * call. Returns a structured result; the caller is responsible for any UI.
 *
 * Android: requested through a tiny native Capacitor bridge. We intentionally
 * do NOT probe the microphone with getUserMedia() here because Android WebView
 * and older devices can falsely reject that probe even after the OS permission
 * is granted. Daily will request WebRTC resources after the native permission
 * is available, and MainActivity grants those WebView resources.
 */
export const requestCameraAndMicForVideoCall = async (): Promise<MediaPermissionResult> => {
  // On the web we let the browser prompt at getUserMedia time inside Daily.
  if (!Capacitor.isNativePlatform()) {
    return { ok: true, cameraGranted: true, micGranted: true, permanentlyDenied: false };
  }

  // The native bridge below is Android-only. On iOS, let Daily/WebRTC surface
  // the system camera + microphone prompts during the user-initiated join.
  if (Capacitor.getPlatform() !== 'android') {
    return { ok: true, cameraGranted: true, micGranted: true, permanentlyDenied: false };
  }

  try {
    let status = await NativeMediaPermissions.check();
    if (!isGranted(status.camera) || !isGranted(status.microphone)) {
      status = await NativeMediaPermissions.request();
    }

    const cameraGranted = isGranted(status.camera);
    const micGranted = isGranted(status.microphone);
    return {
      ok: cameraGranted && micGranted,
      cameraGranted,
      micGranted,
      permanentlyDenied: false,
    };
  } catch (e) {
    console.error('[perms] native camera/microphone request failed', e);

    // If the installed native shell has not been synced with the new bridge yet,
    // do not falsely block the call. Daily + MainActivity's WebChromeClient will
    // still get a chance to request/grant WebRTC permissions during join.
    if (Capacitor.getPlatform() === 'android') {
      return { ok: true, cameraGranted: true, micGranted: true, permanentlyDenied: false };
    }

    return { ok: false, cameraGranted: false, micGranted: false, permanentlyDenied: false };
  }
};
