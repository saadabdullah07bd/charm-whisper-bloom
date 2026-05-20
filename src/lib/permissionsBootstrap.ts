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

  // 2) Camera + microphone are requested natively in MainActivity on app open.
  // Do not call getUserMedia() here: Android WebView can cache a web-origin
  // denial if this runs outside the actual call flow, even after OS permission
  // has already been granted.
}
