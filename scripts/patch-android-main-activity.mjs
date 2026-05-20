import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const configText = readFileSync('capacitor.config.ts', 'utf8');
const appId = configText.match(/appId:\s*['"]([^'"]+)['"]/)?.[1] ?? 'com.medhelp.app';
const mainActivityPath = join('android', 'app', 'src', 'main', 'java', ...appId.split('.'), 'MainActivity.java');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(mainActivityPath)) {
  console.log(`[cap:patch-main] Android platform not found yet (${mainActivityPath}). Skipping.`);
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────────
// 1) MainActivity.java — Google Sign-In hook + WebView camera/mic grant
// ──────────────────────────────────────────────────────────────────────
const packageLine = `package ${appId};`;

const desiredMainActivity = `${packageLine}

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    private static final int RC_MEDIA_PERMS = 9201;
    private PermissionRequest pendingPermissionRequest;

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required marker for @capgo/capacitor-social-login advanced Google flow.
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        // Daily.co / WebRTC inside the in-app WebView needs us to grant camera+mic
        // resources when getUserMedia() fires. Without this, the user sees the
        // generic "unblock your camera and microphone — tap the lock icon" message.
        webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }
        });
        requestAppStartupPermissions();
    }

    private void requestAppStartupPermissions() {
        java.util.List<String> toAsk = new java.util.ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            toAsk.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            toAsk.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            toAsk.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!toAsk.isEmpty()) {
            ActivityCompat.requestPermissions(this, toAsk.toArray(new String[0]), RC_MEDIA_PERMS);
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        boolean wantsCamera = false;
        boolean wantsMic = false;
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
            else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
        }

        boolean hasCamera = !wantsCamera || ContextCompat.checkSelfPermission(
                this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        boolean hasMic = !wantsMic || ContextCompat.checkSelfPermission(
                this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

        if (hasCamera && hasMic) {
            request.grant(request.getResources());
            return;
        }

        // Need to ask the OS first. Stash the request and trigger the runtime
        // permission dialog — onRequestPermissionsResult will grant/deny.
        pendingPermissionRequest = request;
        java.util.List<String> toAsk = new java.util.ArrayList<>();
        if (!hasCamera) toAsk.add(Manifest.permission.CAMERA);
        if (!hasMic) toAsk.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Optional: BLUETOOTH_CONNECT helps when using BT headsets during calls.
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED) {
                toAsk.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
        }
        ActivityCompat.requestPermissions(this, toAsk.toArray(new String[0]), RC_MEDIA_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != RC_MEDIA_PERMS || pendingPermissionRequest == null) return;

        boolean cameraOk = ContextCompat.checkSelfPermission(
                this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        boolean micOk = ContextCompat.checkSelfPermission(
                this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

        java.util.List<String> granted = new java.util.ArrayList<>();
        for (String r : pendingPermissionRequest.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && cameraOk) granted.add(r);
            else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && micOk) granted.add(r);
        }
        if (granted.isEmpty()) {
            pendingPermissionRequest.deny();
        } else {
            pendingPermissionRequest.grant(granted.toArray(new String[0]));
        }
        pendingPermissionRequest = null;
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
