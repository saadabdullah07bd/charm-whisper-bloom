import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medhelp.app',
  appName: 'MedHelp',
  webDir: 'dist',
  server: {
    url: 'https://fafdf217-8775-4149-b126-e3c11fa832e1.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      // Auto-light/dark via Android night-resources (see colors.xml notes in CAPACITOR_BUILD.md)
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DEFAULT', // follows system; we also sync dynamically at runtime
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SocialLogin: {
      // Fill in from Google Cloud Console → OAuth 2.0 Client IDs
      // webClientId = the "Web application" client ID (used by Supabase too)
      // Android automatically uses the Android OAuth client (SHA-1 matched) — no androidClientId field needed.
      google: {
        webClientId: '498318841307-hjim9efued265v7r5tqfjvqcdpm6jq8h.apps.googleusercontent.com',
        mode: 'online',
      },
    },
  },
};

export default config;
