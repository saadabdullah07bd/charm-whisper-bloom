import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const configText = readFileSync('capacitor.config.ts', 'utf8');
const appId = configText.match(/appId:\s*['"]([^'"]+)['"]/)?.[1] ?? 'com.medhelp.app';
const mainActivityPath = join('android', 'app', 'src', 'main', 'java', ...appId.split('.'), 'MainActivity.java');

if (!existsSync(mainActivityPath)) {
  console.log(`[cap:patch-main] Android platform not found yet (${mainActivityPath}). Skipping.`);
  process.exit(0);
}

let source = readFileSync(mainActivityPath, 'utf8');
const packageLine = source.match(/^package\s+[^;]+;/m)?.[0] ?? `package ${appId};`;

const desired = `${packageLine}

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

if (source.trim() === desired.trim()) {
  console.log('[cap:patch-main] MainActivity already patched.');
  process.exit(0);
}

writeFileSync(mainActivityPath, desired);
console.log('[cap:patch-main] Patched MainActivity for native Google Sign-In.');