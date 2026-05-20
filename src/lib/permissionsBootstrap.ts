import { Capacitor } from '@capacitor/core';
import { initPushNotifications } from './nativePush';
import { requestNotificationPermission } from './notifications';

let started = false;

/**
 * Run once on app start: request notification permission and register for push.
 * Camera/microphone are intentionally requested only from the video-call flow.
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

  // 2) Do not call getUserMedia() here: Android WebView can cache a web-origin
  // denial if this runs outside the actual call flow, even after OS permission
  // has already been granted.
}
