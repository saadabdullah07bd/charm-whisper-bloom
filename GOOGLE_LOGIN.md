# Google Login — Technical Implementation

This document describes how Shifora implements native Google Sign-In across web, Android, and iOS.

## Stack at a glance

| Layer | What we use |
|---|---|
| Native plugin | [`@capgo/capacitor-social-login`](https://github.com/Cap-go/capacitor-social-login) |
| Capacitor runtime | `@capacitor/core` v7 |
| Backend verification | Supabase Auth — `supabase.auth.signInWithIdToken({ provider: 'google', token })` |
| Web fallback | Supabase OAuth — `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Session storage | `localStorage` (web) via `@supabase/supabase-js` with `persistSession: true` |

We do **not** use Firebase, the deprecated `@codetrix-studio/capacitor-google-auth` plugin, or any custom OAuth server. The entire flow is **native UI → ID token → Supabase**.

## Authentication method

**Android (and modern iOS):** Google's [Credential Manager API](https://developers.google.com/identity/android-credential-manager) via the Capgo plugin's `style: 'bottom'` mode, which presents the in-app bottom sheet (no browser redirect). On the first cancel, we fall back to `style: 'standard'` which shows the classic account-chooser dialog.

**Web (PWA / browser):** Standard Supabase OAuth redirect — opens `accounts.google.com`, comes back to the app via the Supabase callback URL configured in the Supabase dashboard.

## OAuth setup

1. **Google Cloud Console** → APIs & Services → Credentials → "Create credentials" → "OAuth client ID" → **Web application**.
2. **Authorized redirect URIs**: add Supabase's auth callback (`https://<project>.supabase.co/auth/v1/callback`) plus your custom domain(s).
3. Copy the **Web client ID** (looks like `498318841307-xxx.apps.googleusercontent.com`).
4. Paste it into two places:
   - `capacitor.config.ts` under `plugins.SocialLogin.google.webClientId` — used by the native plugin to request an ID token signed for *your* project.
   - **Supabase dashboard** → Authentication → Providers → Google → enable + paste the same client ID and client secret — so Supabase trusts ID tokens issued for this client.

> For Android, do **not** create a separate Android OAuth client. The Capgo plugin asks Google for an ID token tied to the **Web** client ID; Supabase only verifies Web-typed tokens.

## End-to-end flow

```
┌─────────────┐      1. user taps "Continue with Google"
│   App UI    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────┐
│ signInWithGoogleNative()     │  src/lib/nativeAuth.ts
│  • Capacitor.isNativePlatform│
│    ? native path             │
│    : web OAuth redirect      │
└──────┬───────────────────────┘
       │
       ▼ (native)
┌──────────────────────────────┐  2. Android Credential Manager opens
│ SocialLogin.login({          │     → user picks account
│   provider: 'google',        │     → Google returns { idToken, accessToken }
│   options: { style: 'bottom'}│
│ })                           │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐  3. Supabase verifies the JWT signature
│ supabase.auth                │     against Google's public JWKS, checks
│   .signInWithIdToken({       │     `aud === webClientId`, then issues a
│     provider: 'google',      │     Supabase access + refresh token.
│     token: idToken,          │
│     access_token: accessToken│
│   })                         │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐  4. Session persists in localStorage.
│ Supabase session created     │     onAuthStateChange fires → app routes
│ (RLS now scoped to user)     │     to dashboard.
└──────────────────────────────┘
```

## Required Android patch

The Capgo plugin needs `MainActivity` to extend its base class so `onActivityResult` is routed correctly. Without this patch you'll see the misleading error **"Google sign-in cancelled by user"** even after the user successfully picks an account.

We automate this with `scripts/patch-android-main-activity.mjs`, which runs automatically on:
- `bun run cap:sync`
- `bun run cap:add:android`
- `bun run android:build`

The patched `MainActivity.java` looks like:

```java
public class MainActivity extends ModifiedMainActivityForSocialLoginPlugin {
  @Override
  public void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
  }
}
```

## ⚠️ Don't use `scopes`

The Capgo plugin throws **"You cannot use scopes without modifying the main activity"** if you pass a custom `scopes` array. The default Google sign-in already returns `email + profile + openid`, which is everything Supabase needs to create the user. We deliberately omit `scopes` in `signInWithGoogleNative()`.

If you ever need extra Google API access (Calendar, Drive, etc.), do it server-side via the standard OAuth refresh-token flow in a separate edge function — not via the Capgo plugin.

## Where the code lives

| File | Purpose |
|---|---|
| `src/lib/nativeAuth.ts` | `initNativeAuth()` + `signInWithGoogleNative()` + `signOutNative()` |
| `capacitor.config.ts` | `plugins.SocialLogin.google.webClientId` |
| `src/pages/PatientAuthPage.tsx` | Patient login button |
| `scripts/patch-android-main-activity.mjs` | Auto-patches `MainActivity.java` after `cap sync` |
| `src/integrations/supabase/client.ts` | Supabase client with `persistSession: true` for auto-login |

## Auto-login

Because the Supabase JS client is created with `persistSession: true`, `autoRefreshToken: true`, and `storage: localStorage`, the user stays signed in across app launches. The bearer token is silently refreshed in the background. To force a sign-out we call `signOutNative()` which both revokes the native Google session and clears Supabase storage.
