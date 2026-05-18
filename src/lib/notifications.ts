// Browser-only notifications helper.

export const isNative = (): boolean => false;

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function showBrowserNotification(
  title: string,
  body: string,
  icon = '/favicon.png',
): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage.getItem('notif_enabled') === '0') return;
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon, badge: icon });
  } catch {
    // ignore
  }
}

export async function scheduleNotification(
  _id: number,
  title: string,
  body: string,
  at: Date,
): Promise<void> {
  const delay = at.getTime() - Date.now();
  if (delay > 0 && delay < 2_147_483_647) {
    setTimeout(() => void showBrowserNotification(title, body), delay);
  }
}

export async function cancelScheduledNotification(_id: number): Promise<void> {
  // No-op on web.
}

export function registerPushListeners(_handlers: {
  onToken?: (token: string) => void;
  onNotification?: (title: string, body: string, data: unknown) => void;
  onAction?: (data: unknown) => void;
} = {}): void {
  // No-op on web.
}
