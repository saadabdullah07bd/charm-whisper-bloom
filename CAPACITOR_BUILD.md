# MedHelp — Building the Android APK

This project is a Vite + React web app wrapped with **Capacitor** so you can ship it as a native Android APK.

All login / auth happens **in-app** (native Google Sign-In via `@capgo/capacitor-social-login`) — the user is never bounced to a browser.

---

## 0. One-time prerequisites on your local machine

Install:
- **Node 20+** and **Bun** (or npm)
- **Android Studio** (includes Android SDK + platform tools)
- **JDK 17** (Android Studio ships one; or `brew install --cask temurin@17`)

Set `ANDROID_HOME` if your shell doesn't pick it up automatically:
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"      # macOS
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

---

## 1. Install dependencies

```bash
bun install
```

## 2. Configure native Google Sign-In

In **Google Cloud Console → APIs & Services → Credentials**, you need **two** OAuth 2.0 client IDs:

1. **Web application** client → this ID is **already used by Supabase**. Copy it.
2. **Android** client → package name `com.medhelp.app`, SHA-1 fingerprint of your signing key
   (debug: run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android` and copy the SHA1).

Open `capacitor.config.ts` and replace `REPLACE_WITH_YOUR_WEB_CLIENT_ID...` with the **Web** client ID
(also paste it as `VITE_GOOGLE_WEB_CLIENT_ID` in `.env` if you prefer env-based config).

> The Android client is matched automatically by Google Play Services using your package name + SHA-1.
> You do **not** put the Android client ID anywhere in the codebase.

## 3. Configure push notifications (Firebase)

1. In **Firebase Console** → add an Android app with package `com.medhelp.app`.
2. Download `google-services.json` and place it at `android/app/google-services.json` **after step 4 below**.
3. Capacitor's `@capacitor/push-notifications` plugin and the Capacitor Android template already wire up the Google Services Gradle plugin.

(If you also want to send pushes from Supabase, store the FCM token — `src/lib/nativePush.ts` already pushes it to `profiles.push_token`. Add that column if it doesn't exist.)

## 4. Add the Android platform (only the first time)

```bash
bun run cap:add:android
```

This creates the `android/` folder. Commit it.

The script also patches `android/app/src/main/java/.../MainActivity.java` so Google Sign-In can receive the native authorization result after account selection. Without this patch Android may show `Google Sign-In cancelled by user` even when the user selected an account.

## 5. Build the APK

Every time you change web code:

```bash
bun run android:build       # debug APK
# or
bun run android:release     # release APK (needs a signing config in android/app/build.gradle)
```

APK output:
- Debug:   `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release-unsigned.apk` (sign with `jarsigner` or use Android Studio → Build → Generate Signed Bundle/APK)

## 6. Open in Android Studio (optional, for emulator / device run)

```bash
bun run cap:open:android
```

---

## Available scripts

| Script                  | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `bun dev`               | Web dev server                                          |
| `bun run build`         | Web production build → `dist/`                          |
| `bun run cap:add:android` | Adds the native `android/` project (run once)         |
| `bun run cap:patch-main` | Patches Android `MainActivity.java` for Google Sign-In |
| `bun run cap:sync`      | Builds web + copies into `android/`, then patches MainActivity |
| `bun run cap:open:android` | Opens the native project in Android Studio           |
| `bun run android:build` | Full build + assemble **debug** APK                     |
| `bun run android:release` | Full build + assemble **release** APK                 |

---

## Notes

- App ID: `com.medhelp.app` — change in `capacitor.config.ts` **before** `cap add android` if you need a different one.
- Network: `allowMixedContent: true` is set so Supabase HTTPS endpoints work fine; HTTP-only endpoints would also load if you ever needed them.
- No browser hop: Google sign-in uses native Play Services and exchanges the ID token via `supabase.auth.signInWithIdToken` — fully in-app.

---

## Video call camera / microphone permissions

The video call uses the in-app WebView. The Android patch script
(`scripts/patch-android-main-activity.mjs`) automatically:

- Adds `CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`,
  `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT`
  permissions to `AndroidManifest.xml`.
- Installs a `WebChromeClient.onPermissionRequest` hook in `MainActivity`
  that translates Daily.co's `getUserMedia()` request into a real Android
  runtime permission dialog (so users don't see the "tap the lock icon in
  your browser" message).
- Requests camera, microphone, and notification runtime permissions when the
  Android app opens, before the video call screen is used.

The iOS patch script (`scripts/patch-ios-info-plist.mjs`) adds
`NSCameraUsageDescription`, `NSMicrophoneUsageDescription` and
`NSPhotoLibraryUsageDescription` to `Info.plist`.

Both run automatically as part of `bun run cap:sync`. If you ever regenerate
the native projects, just re-run `bun run cap:sync` (or
`bun run cap:patch`) to re-apply them.
