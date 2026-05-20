import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const configText = readFileSync('capacitor.config.ts', 'utf8');
const appId = configText.match(/appId:\s*['"]([^'"]+)['"]/)?.[1] ?? 'com.medhelp.app';
const mainActivityPath = join('android', 'app', 'src', 'main', 'java', ...appId.split('.'), 'MainActivity.java');
const mediaPermissionsPluginPath = join('android', 'app', 'src', 'main', 'java', ...appId.split('.'), 'ShiforaMediaPermissionsPlugin.java');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(mainActivityPath)) {
  console.log(`[cap:patch-main] Android platform not found yet (${mainActivityPath}). Skipping.`);
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────────
// 1) MainActivity.java — Google Sign-In hook + WebView camera/mic grant
// ──────────────────────────────────────────────────────────────────────
const packageLine = `package ${appId};`;

const desiredMediaPermissionsPlugin = `${packageLine}

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "ShiforaMediaPermissions",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"),
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class ShiforaMediaPermissionsPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        resolveCurrentState(call);
    }

    @PluginMethod
    public void request(PluginCall call) {
        requestAllPermissions(call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        resolveCurrentState(call);
    }

    private void resolveCurrentState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("camera", getPermissionState("camera").toString());
        ret.put("microphone", getPermissionState("microphone").toString());
        call.resolve(ret);
    }
}
`;

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
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required marker for @capgo/capacitor-social-login advanced Google flow.
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShiforaMediaPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
        // NOTE: We intentionally do NOT override the WebChromeClient here.
        // Capacitor's built-in BridgeWebChromeClient already implements
        // onPermissionRequest() and asks the OS for CAMERA + RECORD_AUDIO
        // when Daily.co (or any WebRTC iframe) calls getUserMedia. Overriding
        // it caused the microphone path to silently fail because our custom
        // requestPermissions result was being eaten by BridgeActivity.
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            return;
        }

        PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
        if (pluginHandle == null) {
            Log.i("MedHelpGoogleLogin", "SocialLogin plugin handle is null");
            return;
        }

        Plugin plugin = pluginHandle.getInstance();
        if (!(plugin instanceof SocialLoginPlugin)) {
            Log.i("MedHelpGoogleLogin", "SocialLogin plugin instance is invalid");
            return;
        }

        ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
}
`;

const currentMain = readFileSync(mainActivityPath, 'utf8');
if (currentMain.trim() !== desiredMainActivity.trim()) {
  writeFileSync(mainActivityPath, desiredMainActivity);
  console.log('[cap:patch-main] Patched MainActivity (Google Sign-In + WebView media perms).');
} else {
  console.log('[cap:patch-main] MainActivity already patched.');
}

const currentMediaPlugin = existsSync(mediaPermissionsPluginPath)
  ? readFileSync(mediaPermissionsPluginPath, 'utf8')
  : '';
if (currentMediaPlugin.trim() !== desiredMediaPermissionsPlugin.trim()) {
  writeFileSync(mediaPermissionsPluginPath, desiredMediaPermissionsPlugin);
  console.log('[cap:patch-main] Patched ShiforaMediaPermissions native plugin.');
} else {
  console.log('[cap:patch-main] ShiforaMediaPermissions native plugin already patched.');
}

// ──────────────────────────────────────────────────────────────────────
// 2) AndroidManifest.xml — declare CAMERA / RECORD_AUDIO / etc.
// ──────────────────────────────────────────────────────────────────────
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, 'utf8');
  const before = manifest;

  const needed = [
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
  ];

  for (const tag of needed) {
    const nameMatch = tag.match(/android:name="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : '';
    const already = name && new RegExp(`android:name="${name.replace(/\./g, '\\.')}"`).test(manifest);
    if (!already) {
      manifest = manifest.replace(/<application/, `    ${tag}\n    <application`);
    }
  }

  if (manifest !== before) {
    writeFileSync(manifestPath, manifest);
    console.log('[cap:patch-main] Added camera / microphone permissions to AndroidManifest.xml.');
  } else {
    console.log('[cap:patch-main] AndroidManifest.xml already has media permissions.');
  }
} else {
  console.log(`[cap:patch-main] AndroidManifest.xml not found at ${manifestPath} — skipped.`);
}
