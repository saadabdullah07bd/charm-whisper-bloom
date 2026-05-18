export const WELCOME_DONE_KEY = 'drmabari-welcome-done';

export function isWelcomeDone(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(WELCOME_DONE_KEY) === '1';
  } catch {
    return true;
  }
}

export function setWelcomeDone() {
  try {
    window.localStorage.setItem(WELCOME_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}
