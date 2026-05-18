# Patient app overhaul — phased plan

This touches ~10 areas. I'll execute in phases so each one is verifiable.

## Phase 1 — Foundations (DB + shared utils)

1. **Status lifecycle migration** — add two new appointment statuses:
   `pending → confirmed → in_call → awaiting_prescription → completed`
   - No CHECK constraint (status is plain text); just update labels/colors in code.
   - Add automation: when doctor opens the call, status flips to `in_call`; when call ends, flips to `awaiting_prescription`; when a prescription row is inserted for that appointment's patient on/after that date, flips to `completed`.
2. **Timezone helper** `src/lib/timezone.ts` — Asia/Dhaka default, respects device tz for display.
   - All `new Date(date+"T00:00:00")` calls in dashboards switch to this helper so 9:00 PM means 9 PM Dhaka regardless of viewer.
3. **Patient avatar** — `patients.avatar_url` column already exists. Storage bucket `avatars` is public. Add RLS for patients to upload `${user_id}/...`.

## Phase 2 — Patient Settings page (new)

Create `src/pages/PatientSettingsPage.tsx` (currently patients have no dedicated settings file — settings is inline in PatientDashboard). It will include:
- Profile picture uploader (camera + crop preview, 5MB max → `avatars/${userId}/avatar.{ext}`)
- Modern DOB picker — shadcn `Calendar` inside `Popover` with month/year dropdown navigation
- Collapsed-by-default **Appearance** section (mirrors doctor SettingsPage pattern)
- Sign Out at bottom

## Phase 3 — Theme system

- Add 5 more accents: `amber`, `teal`, `sky`, `pink`, `lime` (total 10).
- Bump gradient opacity from ~0.25 to ~0.55 in `src/index.css` `[data-gradient]` selectors.
- Patient settings + doctor settings show the new accents.

## Phase 4 — Patient Dashboard

- **Hub back behavior**: when on a Hub sub-tab (visits/files/account/settings), tapping `Hub` returns to the `more` grid, not stays.
- **Profile tabs interactive**: the Upcoming/Visits/Rx summary chips on profile page become buttons that switch to the corresponding tab.
- **Profile page redesign (Health snapshot focused)**:
  - Greeting + avatar + next appointment hero (with Join Now CTA when in window)
  - Vitals strip (height, weight, BMI auto-calc, age)
  - Allergies & conditions chips
  - Recent prescriptions (3) + recent reports (3) cards linking to their tabs
  - Quick actions: Book Appointment, Upload Report, Join Call
  - Removes Chief Complaint field (was non-persistent) and other stale fields per user request
- **Desktop sliding tab indicator**: patient sidebar gets the same `motion.div` sliding indicator the doctor uses.
- **Files tab**: remove Share button.

## Phase 5 — Video calling

- **Pre-join waiting room**: show local camera preview + mic toggle + "Join Call" button before connecting to room. Uses LiveKit `PreJoin` component.
- **Notification → join**: clicking the appointment-ready browser notification opens the call modal directly (not just the appointments tab). Implemented via a new custom event `app:open-call` carrying the appointmentId.
- **Notification settings card** in Settings: "Appointment reminders", "Call ready", master enable toggle persisted to localStorage.
- **Audio UX**: device picker exposed via LiveKit `ControlBar`, plus an unmute hint when joining muted.
- **Status hooks**: opening modal triggers `in_call`, `onDisconnected` triggers `awaiting_prescription`.
- Server function `livekit-token` already enforces 30-min window — no change.

## Phase 6 — Toaster

`src/components/ui/sonner.tsx`:
- Spring-based entrance animation (scale + slide-down)
- Larger touch target on mobile, better contrast, success/error colored left bar
- Action button styled to match accent
- Auto-dismiss 4s, swipe-to-dismiss kept

---

## Technical notes (for me, not the user)

- Asia/Dhaka conversion: format strings via `formatInTimeZone` from `date-fns-tz`. Need `bun add date-fns-tz`.
- Avatar storage policy uses `(storage.foldername(name))[1] = auth.uid()::text`.
- LiveKit `PreJoin` ships in `@livekit/components-react`; gated behind a `joined` state in `VideoCallModal`.
- Status automation lives client-side for now (patient + doctor write status on call open/close); a future DB trigger could replace it.
- Hub back: in `MobileBottomTabs` click handler, when active key is already `more` keep current; when on a Hub sub-tab and `more` is clicked, route to `more`.
- Desktop sliding indicator: lift the existing pattern from `DashboardPage`/sidebar nav into the patient sidebar.

## Out of scope (will not touch unless you say so)

- Full WhatsApp-grade in-call chat / reactions
- Push notifications via service worker (browser Notification API only)
- Migrating Edge function logic into TanStack server functions (this project still mixes both)

If this plan looks right, approve it and I'll execute Phase 1 → Phase 6 in order with verification after each phase.
