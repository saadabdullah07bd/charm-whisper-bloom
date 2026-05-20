# Shifora — Comprehensive Update Plan

এই plan-এ আপনার সব request গুলো গুছিয়ে implement করার roadmap দেওয়া হলো। কাজগুলো logical group-এ ভাগ করা হয়েছে যাতে review এবং test করা সহজ হয়।

---

## 1. Branding: New Logo + Favicon Fix

**নতুন logo design (AI-generated, premium quality)**
- Shifora-এর জন্য একটা minimal, modern medical logo বানাবো — soft gradient (teal → blue), একটা subtle "heartbeat + plus" mark, rounded square container। App-এর dark/light উভয় theme-এ মানাবে।
- `src/assets/shifora-logo.png` এবং `src/assets/shifora-mark.png` replace করবো।

**Favicon properly setup**
- Generate করবো: `public/favicon.ico`, `favicon.png`, `favicon-32.png`, `favicon-192.png`, `favicon-512.png`, `apple-touch-icon.png` (180×180) — সব rounded mark থেকে।
- `index.html`-এ proper `<link rel="icon">`, `apple-touch-icon`, `mask-icon`, theme-color tags যোগ করবো।
- `public/manifest.json`-এ icon paths এবং sizes update করবো।

**Top bar থেকে logo সরানো**
- `src/pages/Index.tsx` (Doctor) এবং `src/pages/PatientDashboard.tsx` — দু'জায়গাতেই top bar/sidebar header থেকে `<img src="/favicon.png" .../>` সরাবো। শুধু "Shifora" title থাকবে।
- Patient dashboard-এ "DASHBOARD" uppercase subtitle এবং patient name remove — শুধু "Shifora" থাকবে।

---

## 2. Appointment & Video Session Flow (full rewrite)

**Database changes** (একটা migration):
- `appointments` table-এ নতুন column: `session_ended_at` (timestamptz), `session_ended_by` (text), `meeting_quality` (text: 'completed' | 'short' | null), `doctor_joined_at`, `patient_joined_at`, `doctor_left_at`, `patient_left_at` (timestamptz).
- নতুন status values support: `pending`, `confirmed`, `reminder_sent`, `ready_to_join`, `in_call`, `completed`, `ended_early`, `auto_expired`, `cancelled`, `rejected`.

**Session window logic** (`src/lib/appointmentWindow.ts` rewrite):
- `getSessionWindow(appointment)` → returns `{ joinOpensAt, joinClosesAt (start+30min), reminderAt (start-10min), isJoinable, isReminderTime, isExpired, sessionEnded }`।
- Join button visible ONLY when: `now >= joinOpensAt && now < joinClosesAt && !sessionEnded`।
- Auto-expire: `now >= joinClosesAt` হলেই UI থেকে সব button/card hide।

**Notifications** (10-min reminder):
- নতুন edge function `appointment-reminders` যা প্রতি মিনিটে cron দিয়ে run হবে (pg_cron + pg_net)। 
- 9:50 PM সময় হলে doctor + patient উভয়কে notification পাঠাবে (existing `notifications.ts` + native push channel)।
- Doctor-এর জন্য আলাদা message: "You have an appointment with [Patient Name] at 10:00 PM."
- Patient-কে appointment confirm/reject হলে notification — existing `appointment-action` edge function-এ patient notification trigger যোগ করবো।

**UI buttons (refined wording)**:
- "Join Video" / "Start Video" সব জায়গা থেকে replace → "Start your appointment" (10:00 আগে কিছুই দেখাবে না, joinable হলে এই button)।
- Patient side-এ একই button: "Join your appointment"।
- Doctor-only extra button: "End Session" (only between 10:00 PM – 10:30 PM, only when status was joinable)।

**End Session flow**:
- Doctor "End Session" click করলে: `session_ended_at = now()`, `session_ended_by = 'doctor'`, status → `completed`। Realtime subscription দিয়ে patient dashboard থেকেও instantly button disappear।

**Post-call popup for doctor** (`VideoCallPage.tsx` enhancement):
- Doctor `left-meeting` event-এ একটা dialog: "Was the meeting completed?"
  - "Yes, End Session" → above end-session call।
  - "No, ask patient to rejoin" → notification পাঠাবে patient-কে: "Your meeting has not been completed yet. Please join again."

**Meeting quality tracking (internal)**:
- `joined-meeting` / `left-meeting` event-এ doctor/patient join/leave timestamps save।
- Doctor leave করার সময় calculate: if both stayed ≥10 min → `meeting_quality = 'completed'`, else `'short'`। কোনো automatic action নয়, শুধু store।

**Doctor appointment confirm/reject notification**:
- যখন patient book করে → doctor dashboard-এ existing notification UI আছে। সেটা polish করবো এবং confirm করলে patient-এর কাছে notification যাবে।

---

## 3. Profile Picture: Premium Upload + Cropper

**নতুন UI**:
- Circular avatar-এর নিচে-ডানে একটা ছোট camera/edit icon button (Facebook-style)। Click করলে file picker।
- File select করার পর একটা modal খুলবে — **circular crop tool** (react-easy-crop ব্যবহার করবো, lightweight)। User zoom + drag করে crop করতে পারবে।
- "Save" করলে cropped image compress হয়ে upload হবে।

**RLS error fix**:
- `useSupabaseStorage` / avatar upload logic check করবো। বর্তমান error: "new row violates row-level security policy"। Most likely `avatars` bucket-এ insert policy আছে কিন্তু path-এ user_id check করছে না। Storage policy update করে `auth.uid()::text = (storage.foldername(name))[1]` pattern follow করাবো এবং upload path-এ user id prefix দেবো।

---

## 4. Swipe Gesture Support

- Mobile-এ left→right swipe হলে previous tab, right→left হলে next tab।
- `src/pages/Index.tsx` এবং `src/pages/PatientDashboard.tsx`-এর main content area-এ touch handler যোগ করবো (lightweight, কোনো লাইব্রেরি ছাড়াই — touchstart/touchmove/touchend)।
- Tab order: dashboard → patients → appointments → history → settings।

---

## 5. Settings: Remove Notifications Tab

- `src/pages/SettingsPage.tsx` থেকে Notifications section সম্পূর্ণ remove।

---

## 6. User Manual Refinement

- `src/components/PatientUserManual.tsx` review করবো — ভাঙা শব্দ ঠিক করবো, Bangla/English ভাষা refine করবো, formatting polish।

---

## 7. Login Screen Enhancements

- Top-right corner-এ দুটো small toggle: theme switcher (sun/moon/system) এবং language toggle (EN / বাং)।
- Layout balance ঠিক রাখবো।

---

## 8. Auto Login (Persistent Session)

- Supabase client এ `persistSession: true`, `autoRefreshToken: true`, `storage: localStorage` (web) এবং Capacitor Preferences (native) নিশ্চিত করবো।
- App reload-এ session restore হবে, user-কে আবার login করতে হবে না।

---

## 9. Loading Spinner Redesign

- `BrandedSpinner.tsx` redesign — conic gradient ring + Shifora mark + soft pulse, app theme-এর সাথে match।

---

## 10. Doctor Dashboard Fixes

- Appointments tab-এর card overflow issue fix — `AppointmentsTab.tsx`-এ proper `overflow-hidden` / `min-w-0` / responsive grid।
- Sidebar header থেকে logo সরানো (already in step 1)।

---

## 11. Performance & Polish

- React `memo`, `useCallback`, `useMemo` যেখানে দরকার সেখানে add।
- Mobile responsiveness audit।
- Page transitions smooth করবো।

---

## 12. Google Login Technical Documentation

Markdown ফাইল `GOOGLE_LOGIN.md` তৈরি করবো বিস্তারিত technical details সহ:
- **Plugin**: `@capgo/capacitor-social-login` (native Android/iOS) + Supabase `signInWithIdToken` (server verification)।
- **Method**: Native Google Sign-In via Credential Manager (Android 14+) with fallback to standard chooser sheet।
- **OAuth setup**: Google Cloud Console → Web Client ID → configured in `capacitor.config.ts` under `plugins.SocialLogin.google.webClientId`।
- **Flow**:
  1. App calls `SocialLogin.login({ provider: 'google' })`
  2. Native UI returns `idToken`
  3. Frontend sends `idToken` to Supabase via `supabase.auth.signInWithIdToken({ provider: 'google', token })`
  4. Supabase verifies token signature against Google's JWKS, creates session
- **MainActivity patch**: `scripts/patch-android-main-activity.mjs` ensures `onActivityResult` routes to plugin (required by Capgo)।
- **Web fallback**: `supabase.auth.signInWithOAuth({ provider: 'google' })` redirect flow।
- **Libraries involved**: `@capacitor/core`, `@capgo/capacitor-social-login`, `@supabase/supabase-js`।

---

## Technical Details (for the curious)

- **Files to create**: 1 migration, 1 cron edge function, `GOOGLE_LOGIN.md`, new logo assets, cropper component, post-call dialog component।
- **Files to modify**: `Index.tsx`, `PatientDashboard.tsx`, `AppointmentsTab.tsx`, `VideoCallPage.tsx`, `appointmentWindow.ts`, `SettingsPage.tsx`, `PatientUserManual.tsx`, `BrandedSpinner.tsx`, `PatientAuthPage.tsx`, `index.html`, `manifest.json`, `capacitor.config.ts`, supabase client config।
- **New dependencies**: `react-easy-crop` (lightweight, ~30KB) for circular avatar cropping।
- **Storage policy migration**: avatars bucket-এ proper RLS।

---

## ⚠️ Scope Note

এটা একটা বড় change set। আমি step-by-step একই session-এ সব করতে পারবো, কিন্তু কোনো একটা specific group-এ আপনি যদি অগ্রাধিকার দিতে চান (যেমন "আগে logo + favicon + session flow ঠিক করো, বাকিগুলো পরে"), জানালে সেটা আগে করে দেবো। অথবা plan approve করলে পুরোটা একসাথে implement শুরু করবো।
