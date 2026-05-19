import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const plistPath = join('ios', 'App', 'App', 'Info.plist');

if (!existsSync(plistPath)) {
  console.log(`[cap:patch-ios] iOS platform not found yet (${plistPath}). Skipping.`);
  process.exit(0);
}

let plist = readFileSync(plistPath, 'utf8');
const before = plist;

const entries = [
  { key: 'NSCameraUsageDescription', value: 'MedHelp uses the camera so doctors and patients can see each other during video consultations.' },
  { key: 'NSMicrophoneUsageDescription', value: 'MedHelp uses the microphone so doctors and patients can hear each other during video consultations.' },
  { key: 'NSPhotoLibraryUsageDescription', value: 'MedHelp needs photo library access to upload reports and prescriptions.' },
];

for (const { key, value } of entries) {
  if (new RegExp(`<key>${key}</key>`).test(plist)) continue;
  plist = plist.replace(
    /<\/dict>\s*<\/plist>\s*$/,
    `    <key>${key}</key>\n    <string>${value}</string>\n</dict>\n</plist>\n`,
  );
}

if (plist !== before) {
  writeFileSync(plistPath, plist);
  console.log('[cap:patch-ios] Added camera / microphone usage descriptions to Info.plist.');
} else {
  console.log('[cap:patch-ios] Info.plist already has media usage descriptions.');
}
