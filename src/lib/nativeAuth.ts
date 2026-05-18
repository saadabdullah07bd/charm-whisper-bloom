import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;
const GOOGLE_WEB_CLIENT_PLACEHOLDER = 'REPLACE_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

function getGoogleWebClientId() {
  return (
    (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
    GOOGLE_WEB_CLIENT_PLACEHOLDER
  );
}

function isGoogleCancelError(error: unknown) {
  const anyError = error as { message?: string; code?: string };
  const message = `${anyError?.message ?? ''} ${anyError?.code ?? ''}`.toLowerCase();
  return message.includes('cancelled') || message.includes('canceled') || message.includes('user_cancelled');
}

/**
 * Initialise native Google sign-in once on app start (no-op on web).
 * Reads webClientId from capacitor.config.ts at native runtime.
 */
export async function initNativeAuth() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  const webClientId = getGoogleWebClientId();
  await SocialLogin.initialize({
    google: { webClientId, mode: 'online' },
  });
  initialized = true;
}

/**
 * Native, in-app Google sign-in. Returns the Supabase session.
 * On web, falls back to Supabase OAuth redirect flow.
 */
export async function signInWithGoogleNative() {
  if (!Capacitor.isNativePlatform()) {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  await initNativeAuth();
  const webClientId = getGoogleWebClientId();
  if (!webClientId || webClientId === GOOGLE_WEB_CLIENT_PLACEHOLDER) {
    throw new Error('Google Web Client ID সেট করা হয়নি। capacitor.config.ts অথবা VITE_GOOGLE_WEB_CLIENT_ID-তে Web Client ID দিন।');
  }

  // NOTE: Do NOT pass custom `scopes` here — @capgo/capacitor-social-login
  // requires modifying MainActivity for extra scopes and will throw
  // "You cannot use scopes without modifying the main activity".
  // The default Google sign-in already returns email + profile + idToken.
  let res;
  try {
    res = await SocialLogin.login({
      provider: 'google',
      options: {
        style: 'bottom',
        filterByAuthorizedAccounts: false,
        autoSelectEnabled: false,
      },
    });
  } catch (error) {
    if (!isGoogleCancelError(error)) throw error;
    res = await SocialLogin.login({
      provider: 'google',
      options: {
        style: 'standard',
      },
    });
  }

  // @capgo/capacitor-social-login returns { result: { idToken, accessToken, ... } }
  const anyRes = res as any;
  const idToken: string | undefined =
    anyRes?.result?.idToken ?? anyRes?.idToken;
  const accessToken: string | undefined =
    anyRes?.result?.accessToken?.token ?? anyRes?.accessToken;

  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    access_token: accessToken,
  });
  if (error) throw error;
  return { data, error: null };
}

export async function signOutNative() {
  try {
    if (Capacitor.isNativePlatform()) {
      await SocialLogin.logout({ provider: 'google' });
    }
  } catch {
    // ignore
  }
  await supabase.auth.signOut();
}
