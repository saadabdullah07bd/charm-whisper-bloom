import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;

/**
 * Initialise native Google sign-in once on app start (no-op on web).
 * Reads webClientId from capacitor.config.ts at native runtime.
 */
export async function initNativeAuth() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  const webClientId =
    (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
    'REPLACE_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
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
  // NOTE: Do NOT pass custom `scopes` here — @capgo/capacitor-social-login
  // requires modifying MainActivity for extra scopes and will throw
  // "You cannot use scopes without modifying the main activity".
  // The default Google sign-in already returns email + profile + idToken.
  const res = await SocialLogin.login({
    provider: 'google',
    options: {},
  });

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
