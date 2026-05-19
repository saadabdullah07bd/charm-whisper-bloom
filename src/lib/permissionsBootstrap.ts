import { Capacitor } from '@capacitor/core';
import { initPushNotifications } from './nativePush';
import { requestNotificationPermission } from './notifications';

let started = false;

/**
 * Run once on app start: request notification permission, register for push
 * (native only), and pre-warm camera/microphone permission so the in-app
 * WebView grants access without the "tap the lock icon" message when the
 * user opens a video call later.
 */
export async function bootstrapPermissions(): Promise<void> {
  if (started) return;
  started = true;

  // 1) Notifications
  try {
    if (Capacitor.isNativePlatform()) {
      await initPushNotifications();
    } else {
      await requestNotificationPermission();
    }
  } catch (e) {
    console.warn('[perms] notification request failed', e);
  }

  // 2) Camera + microphone — only pre-warm on native (Capacitor WebView),
  //    where our patched MainActivity translates this into the real OS
  //    permission dialog. On web we skip it to avoid an unexpected prompt
  //    before the user actually opens a video call.
  if (Capacitor.isNativePlatform()) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
      console.log('[perms] camera + microphone granted');
    } catch (e) {
      console.warn('[perms] camera/mic permission deferred:', e);
    }
  }
}
