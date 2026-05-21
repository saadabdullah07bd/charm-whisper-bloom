import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const configText = readFileSync('capacitor.config.ts', 'utf8');
const appId = configText.match(/appId:\s*['"]([^'"]+)['"]/)?.[1] ?? 'com.medhelp.app';
const pkgPath = appId.split('.');
const javaDir = join('android', 'app', 'src', 'main', 'java', ...pkgPath);
const mainActivityPath = join(javaDir, 'MainActivity.java');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
const appGradlePath = join('android', 'app', 'build.gradle');

const hasAndroidPlatform = existsSync(manifestPath) || existsSync(mainActivityPath) || existsSync(appGradlePath);
if (!hasAndroidPlatform) {
  console.log('[cap:patch-main] Android platform not found yet. Skipping.');
  process.exit(0);
}

const writeIfChanged = (p, content) => {
  mkdirSync(dirname(p), { recursive: true });
  const current = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if (current.trim() !== content.trim()) {
    writeFileSync(p, content);
    console.log(`[cap:patch-main] wrote ${p}`);
  }
};

// ──────────────────────────────────────────────────────────────────────
// MainActivity.java — Google Sign-In bridge
// ──────────────────────────────────────────────────────────────────────
const packageLine = `package ${appId};`;

const desiredMainActivity = `${packageLine}

import android.os.Bundle;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            return;
        }
        PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
        if (pluginHandle == null) { Log.i("ShiforaGoogleLogin", "SocialLogin plugin handle is null"); return; }
        Plugin plugin = pluginHandle.getInstance();
        if (!(plugin instanceof SocialLoginPlugin)) { Log.i("ShiforaGoogleLogin", "SocialLogin plugin instance is invalid"); return; }
        ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
}
`;

if (existsSync(mainActivityPath)) {
  writeIfChanged(mainActivityPath, desiredMainActivity);
} else {
  console.log(`[cap:patch-main] MainActivity not found (${mainActivityPath}). Skipping MainActivity patch.`);
}

// ──────────────────────────────────────────────────────────────────────
// App-level build.gradle — release signing only (Daily SDK removed)
// ──────────────────────────────────────────────────────────────────────
if (existsSync(appGradlePath)) {
  let g = readFileSync(appGradlePath, 'utf8');
  const before = g;

  if (!/keystoreProperties/.test(g)) {
    g = g.replace(
      /android\s*\{/,
      `def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {`,
    );
  }

  if (!/signingConfigs\s*\{/.test(g)) {
    g = g.replace(
      /(\n\s*buildTypes\s*\{)/,
      `\n    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }

    buildTypes {`,
    );
  }

  if (!/signingConfig signingConfigs\.release/.test(g)) {
    g = g.replace(
      /(release\s*\{[\s\S]*?)(minifyEnabled\s+\w+)/,
      `$1signingConfig signingConfigs.release\n            $2`,
    );
  }

  if (g !== before) {
    writeFileSync(appGradlePath, g);
    console.log('[cap:patch-main] Patched android/app/build.gradle (signing).');
  }
}

// ──────────────────────────────────────────────────────────────────────
// AndroidManifest.xml — camera + microphone permissions for WebView video calls
// ──────────────────────────────────────────────────────────────────────
if (existsSync(manifestPath)) {
  let m = readFileSync(manifestPath, 'utf8');
  const before = m;
  const requiredPerms = [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_CAMERA',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  ];
  for (const perm of requiredPerms) {
    if (!m.includes(`android:name="${perm}"`)) {
      m = m.replace(
        /<manifest([^>]*)>/,
        `<manifest$1>\n    <uses-permission android:name="${perm}" />`,
      );
    }
  }
  // Camera feature (not required so app still installs on devices without camera)
  if (!m.includes('android.hardware.camera')) {
    m = m.replace(
      /<manifest([^>]*)>/,
      `<manifest$1>\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />`,
    );
  }
  if (m !== before) {
    writeFileSync(manifestPath, m);
    console.log('[cap:patch-main] Patched AndroidManifest.xml (camera/mic permissions).');
  }
}

console.log('[cap:patch-main] Done.');

