# Shifora — Building the Android APK

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
2. **Android** client → package name `com.shifora.app`, SHA-1 fingerprint of your signing key
   (debug: run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android` and copy the SHA1).

Open `capacitor.config.ts` and replace `REPLACE_WITH_YOUR_WEB_CLIENT_ID...` with the **Web** client ID
(also paste it as `VITE_GOOGLE_WEB_CLIENT_ID` in `.env` if you prefer env-based config).

> The Android client is matched automatically by Google Play Services using your package name + SHA-1.
> You do **not** put the Android client ID anywhere in the codebase.

## 3. Configure push notifications (Firebase)

1. In **Firebase Console** → add an Android app with package `com.shifora.app`.
2. Download `google-services.json` and place it at `android/app/google-services.json` **after step 4 below**.
3. Capacitor's `@capacitor/push-notifications` plugin and the Capacitor Android template already wire up the Google Services Gradle plugin.

(If you also want to send pushes from Supabase, store the FCM token — `src/lib/nativePush.ts` already pushes it to `profiles.push_token`. Add that column if it doesn't exist.)

## 4. Add the Android platform (only the first time)

```bash
bun run cap:add:android
```

This creates the `android/` folder. Commit it.

The script also patches `android/app/src/main/java/.../MainActivity.java` so Google Sign-In can receive the native authorization result after account selection. Without this patch Android may show `Google Sign-In cancelled by user` even when the user selected an account.

## 5. Build the debug APK (for testing)

```bash
bun run android:build       # debug APK
```

APK output:
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 6. Build the release APK (official signing key)

You said you already generated an SHA-1 key and registered it with Google. To build a **signed release APK**, you need to create one small properties file so Gradle can find your keystore.

### Step A — Place your keystore file inside `android/`

Copy your `.jks` or `.keystore` file into the `android/` folder. For example:

```bash
cp /path/to/your-key.jks android/shifora-release-key.jks
```

### Step B — Create `android/keystore.properties`

Create a file named `android/keystore.properties` (do NOT commit this file to git — it contains passwords):

```properties
storeFile=shifora-release-key.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=YOUR_KEY_ALIAS
keyPassword=YOUR_KEY_PASSWORD
```

Replace the four values with your actual credentials.

### Step C — Build the release APK

Run this single command (it builds the web app, syncs Capacitor, patches native files, and produces the signed APK):

```bash
git pull
bun install
bun run cap:sync
cd android && ./gradlew assembleRelease
cd ..
```

The signed APK will be at:

```
android/app/build/outputs/apk/release/app-release.apk
```

> 💡 The patch script (`scripts/patch-android-main-activity.mjs`) automatically injects the `signingConfigs.release` block into `android/app/build.gradle` every time you run `cap:sync`. So you only need to create `keystore.properties` once.

---

## 7. Open in Android Studio (optional, for emulator / device run)

```bash
bun run cap:open:android
```

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

- App ID: `com.shifora.app` — change in `capacitor.config.ts` **before** `cap add android` if you need a different one.
- Network: `allowMixedContent: true` is set so Supabase HTTPS endpoints work fine; HTTP-only endpoints would also load if you ever needed them.
- No browser hop: Google sign-in uses native Play Services and exchanges the ID token via `supabase.auth.signInWithIdToken` — fully in-app.


