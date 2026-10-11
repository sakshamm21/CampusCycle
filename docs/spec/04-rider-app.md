# 04 · Rider app (`apps/mobile`)

The rider app has 19 screens (R01–R19) built with Expo + expo-router, running on Android, iOS (config only, untested) and the web (Expo web export, used for the shareable demo link). Its job: get someone from opening the app to riding in under a minute, with the Rider Pass as the hero.

Read `06-design-system.md` for every component named here (`Pill`, `Card`, `Headline`, `RiderPass`, …) and `03-api-and-functions.md` for every wrapper (`getMyContext`, `borrowBike`, …). Copy tables list `key → text`; keys live under `en.<screen>` in `packages/shared/src/strings/en.ts` (01 §9). `*word*` marks the italic accent word.

## 1. App-wide behaviour

### 1.1 Providers (`app/_layout.tsx`)

Order, outermost first: `GestureHandlerRootView` → `SafeAreaProvider` → `QueryClientProvider` (retry 1, staleTime 30 s, refetchOnWindowFocus true) → `ThemeProvider` (06 §2.3) → `SessionProvider` (§1.2) → `ReturnFlowProvider` (§1.10) → `ToastProvider` → `Glow` + `Stack` + `Grain` + `OfflineBanner` + `DemoBanner` + `TorqFab`. Fonts are loaded with `useFonts`; `SplashScreen.preventAutoHideAsync()` until fonts and the first session check finish.

### 1.2 Session and the routing gate

`src/lib/session.tsx` exposes `useSession(): { status: 'loading' | 'signedOut' | 'signedIn', ctx: MyContext | null, refresh(): Promise<void> }`.

- On start: `db.auth.getSession()`; if a session exists, fetch `getMyContext()` (query key `['ctx']`).
- Subscribes to `db.auth.onAuthStateChange`; on `SIGNED_OUT` clears the query cache and realtime channels.
- When signed in, opens realtime channel `me:<uid>` (03 §3.7). Any `profiles`/`rider_passes` update → `refresh()`. A notification insert → invalidate `['notifications']` and show a Toast with its title.

`app/index.tsx` and the `(main)` layout redirect with `gate(ctx)`:

| Condition (checked in order)                                       | Route                               |
| ------------------------------------------------------------------ | ----------------------------------- |
| `status === 'signedOut'`                                           | `/welcome` (R01)                    |
| `ctx === null` (profile missing)                                   | sign out, then `/welcome`           |
| AsyncStorage `cc-perms-seen` not set                               | `/permissions` (R05)                |
| `ctx.college === null`                                             | `/blocked?variant=no_college` (R07) |
| `profile.status === 'pending'`                                     | `/pending` (R06)                    |
| `profile.status === 'rejected'`                                    | `/blocked?variant=rejected` (R07)   |
| `profile.status === 'suspended'`                                   | `/blocked?variant=suspended` (R07)  |
| `ctx.ride !== null` and this is the app's first route since launch | `/riding` (R13)                     |
| otherwise                                                          | `/(main)` Home (R08)                |

The gate re-runs whenever `ctx` changes, so approval on R06 moves the rider to Home (and the pass mints), and a suspension pushes them to R07.

### 1.3 Pass display state

`src/features/pass/passState.ts`:

```ts
export function passDisplayState(ctx: MyContext): PassState {
  const p = ctx.profile,
    pass = ctx.pass;
  if (p.status === 'suspended' || pass.status === 'suspended') return 'suspended';
  if (p.status !== 'approved') return 'pending';
  if (pass.status === 'overdue') return 'overdue';
  if (pass.status === 'riding') return 'riding';
  if (pass.minted_seen_at === null) return 'minting';
  return 'ready';
}
```

`returned` is set only transiently by R15. `minting` plays once, then calls `markPassMintedSeen()` and `refresh()`.

### 1.4 Location (`src/lib/location.ts`)

```ts
export async function getFix(ctx: MyContext): Promise<GeoFix>;
```

- Demo accounts (`ctx.profile.is_demo`): return `{ lat: null, lng: null, accuracy: null, isMock: false }` without asking for permission.
- Otherwise: `requestForegroundPermissionsAsync()`; denied → throw `AppError('CC_LOCATION_DENIED')`. Then `getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })` raced against `LOCATION_TIMEOUT_MS` → timeout throws `CC_LOCATION_TIMEOUT`. Return `{ lat, lng, accuracy: coords.accuracy, isMock: position.mocked === true }`.
- Location is read only when borrowing, returning or listing nearby stands. There is no background or continuous tracking.
- A fix is reused if it is younger than 60 s (module-level cache).

### 1.5 Query keys

`['ctx']`, `['stands', latRounded3, lngRounded3]`, `['stand', id]`, `['passStats']`, `['passQr']`, `['rides', page]`, `['ride', id]`, `['reports']`, `['notifications']`, `['threads']`, `['messages', threadId]`, `['pickable']`, `['idCheck']`.

### 1.6 Camera and scanning (`src/lib/camera.ts`)

- Scanner uses `CameraView` from `expo-camera` with `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}` and `onBarcodeScanned`. A scan is ignored for 1500 ms after the previous one.
- Permission via `useCameraPermissions()`; denied → `CC_CAMERA_DENIED` state with "Open settings" (`Linking.openSettings()`) and "Enter code".
- On the web, if `await CameraView.isAvailableAsync()` is false, the scanner shows only manual entry (and the demo picker for demo accounts).

### 1.7 Photos and the upload queue

- Capture with `CameraView.takePictureAsync({ quality: 0.8, skipProcessing: false })`.
- Compress with `expo-image-manipulator`: resize so the long edge is `PHOTO_MAX_EDGE_PX` (1080), JPEG `PHOTO_JPEG_QUALITY` (0.6).
- Upload with `uploadPhoto()` (03 §3.5), 20 s timeout.
- `src/lib/queue.ts` keeps failed return-photo uploads in AsyncStorage key `cc-photo-queue` as `[{ rideId, uri, createdAt }]`. `flushQueue()` runs on app start, on `AppState` → active and on NetInfo → online: for each item, upload then `attachReturnPhoto(rideId, path)`; remove on success or when older than 24 h.

### 1.8 Push notifications

- `src/lib/push.ts` `registerPush(ctx)`: runs after sign-in on native when permission is granted. Creates Android channel `default` (importance HIGH, vibration on, light colour primary), gets the Expo push token with `projectId = Constants.expoConfig.extra.eas.projectId`, saves it with `updateMyProfile({ push_token })` if different.
- Foreground behaviour: `setNotificationHandler` shows banner + sound, no badge.
- Tapping a push or an inbox row navigates by `data.screen`:

| `data.screen`                 | Route                                                     |
| ----------------------------- | --------------------------------------------------------- |
| `home`                        | `/(main)`                                                 |
| `riding`                      | `/riding`                                                 |
| `rides`                       | `/ride/<data.ride_id>` if present, else `/(main)/history` |
| `profile`                     | `/(main)/profile`                                         |
| `blocked`                     | gate decides (refresh ctx)                                |
| `notifications`               | `/notifications`                                          |
| anything else (admin screens) | `/notifications`                                          |

- Web: no push; the inbox (R18) still works.

### 1.9 Demo mode

When `ctx.profile.is_demo`:

- `DemoBanner` (06 §5.13) on every signed-in screen: `en.common.demo_banner` = "Demo mode · resets every night at 4:00 AM IST · GPS checks are off".
- No location permission is requested; borrow uses the bike's own stand; return asks which stand (R14 step 1).
- The scanner offers "Pick a demo bike" (list from `listPickableBikes()`).
- Change password and Delete account are hidden in R19.
- Every TORQ feature works and draws from the shared demo pool.

### 1.10 Return flow context

`src/features/ride/ReturnFlowProvider.tsx` holds `{ scan: { code, sig } | null, demoStandId: string | null, result: ReturnResult | null }` with setters. R11 (return mode) writes `scan` then `router.back()`; R14 reads it. R14 writes `result` before navigating to R15. Cleared when R15 unmounts.

### 1.11 Offline

`OfflineBanner` shows `en.common.offline` = "You're offline. Borrowing and returning need a connection." while NetInfo reports no internet. Borrow (R12 slide), Return (R14 finish) and Send (R16, R17) are disabled while offline.

## 2. Routes

| Id           | Route file (`apps/mobile/app/`)            | Presentation              |
| ------------ | ------------------------------------------ | ------------------------- |
| R01          | `welcome.tsx`                              | stack, no header          |
| R02          | `sign-in.tsx`                              | stack                     |
| R03          | `forgot.tsx`                               | stack                     |
| R04          | `sign-up.tsx`                              | stack                     |
| R05          | `permissions.tsx`                          | stack, no back            |
| R06          | `pending.tsx`                              | stack, no back            |
| R07          | `blocked.tsx`                              | stack, no back            |
| R08          | `(main)/index.tsx`                         | tab (dock)                |
| R09          | `(main)/map.tsx`                           | tab                       |
| R15 (list)   | `(main)/history.tsx`                       | tab                       |
| R19          | `(main)/profile.tsx`                       | tab                       |
| R10          | `stand/[id].tsx`                           | stack                     |
| R11          | `scan.tsx` (`?mode=borrow\|return`)        | full-screen modal         |
| R12          | `borrow.tsx` (`?code=&sig=`)               | stack                     |
| R13          | `riding.tsx`                               | stack                     |
| R14          | `return.tsx`                               | stack                     |
| R15 (detail) | `ride/[id].tsx` (`?fresh=1`)               | stack                     |
| R16          | `report.tsx` (`?bike=&ride=&stand=&type=`) | stack                     |
| R17          | `torq.tsx` (`?listen=1`)                   | modal                     |
| R18          | `notifications.tsx`                        | stack                     |
| —            | `b/[code].tsx`                             | deep link handler (03 §5) |

`(main)/_layout.tsx` renders the four tab screens with the custom `Dock` (06 §5.9) instead of the default tab bar.

Common header (stack screens): 44 px back IconButton (chevron-left, label `en.common.back`) on the left, optional title as `Kicker`, optional right action. No native header.

## 3. Screens

Each screen lists: purpose, data, layout (top to bottom), states, behaviour, copy, acceptance.

---

### R01 Welcome

- **Data:** none.
- **Layout:** status-bar spacer → brand mark + wordmark (top-left) → `Marquee` band (06 §5.21) → `Headline` xl `en.r01.title` → body `en.r01.lede` (muted, max 32 ch) → sticker row (three `Sticker`s: yellow −3° `en.r01.s1`, coral 4° `en.r01.s2`, mint −2° `en.r01.s3`) → spacer → `Pill` primary lg `en.r01.sign_up` → `Pill` secondary lg `en.r01.sign_in` → `Pill` ghost md `en.r01.demo`.
- **Behaviour:** Sign up → R04. Sign in → R02. Try the demo → `signIn(DEMO_EMAILS.rider, DEMO_PASSWORD)` then gate (loading state on the button; failure → Toast with `messageFor`).
- **Copy:** `title` "ride _anywhere_ on campus." · `lede` "Scan a bike at any stand, ride, and drop it at any other. Free for students, run by your college." · `s1` "scan to borrow" · `s2` "return at any stand" · `s3` "free for students" · `sign_up` "sign up" · `sign_in` "I have an account" · `demo` "Try the demo rider".
- **Acceptance:** renders in both themes; marquee stops with reduce motion; demo button lands on Home as Aanya Sharma with the pass `IITK · 0421`.

### R02 Sign in

- **Layout:** header (back) → `Headline` l `en.r02.title` → `Field` email (keyboard email, autocomplete email) → `Field` password (secure, eye toggle) → link button `en.r02.forgot` (right-aligned, primary text) → `Pill` primary lg `en.r02.submit` → divider → `Pill` ghost md `en.r02.demo`.
- **Behaviour:** validate with `SignInSchema` (email valid, password ≥ 1). Submit → `signIn` → gate. Errors under the form via `messageFor` (`CC_AUTH_INVALID`, `CC_NETWORK`).
- **Copy:** `title` "welcome _back_." · `email` "Email" · `password` "Password" · `forgot` "Forgot password?" · `submit` "sign in" · `demo` "Try the demo rider".
- **Acceptance:** wrong password shows "Wrong email or password."; correct login of a pending user lands on R05 (first time) then R06.

### R03 Forgot and reset password

- **Layout:** header → `Headline` l `en.r03.title` → body `en.r03.body` → `Field` email → `Pill` primary lg `en.r03.submit` → after success, a `Card` with ok icon, `en.r03.sent_title` and `en.r03.sent_body`, and `Pill` secondary `en.r03.back`.
- **Behaviour:** `requestPasswordReset(email)` (always succeeds). Show the sent card regardless of whether the email exists.
- **Copy:** `title` "forgot your _password_?" · `body` "Your college admin resets passwords. Send a request and they'll give you a temporary password in person or by phone." · `submit` "ask my admin" · `sent_title` "Request sent" · `sent_body` "If an account exists for this email, your college admin can now see your request." · `back` "Back to sign in".
- **Acceptance:** submitting creates `password_reset_requested_at` on the profile and an admin notification (checked in the database test 020).

### R04 Sign up

Four steps in one screen with a progress row of four 4 px bars (filled = `primary`). Back on step 1 leaves the screen; on later steps goes to the previous step. Values persist between steps.

| Step           | Fields                                              | Schema (`validation.ts`)                                                           |
| -------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1 You          | full name, phone, roll or employee number           | `full_name` 2–120 chars; `phone` matches `/^\+?[0-9 ]{8,20}$/`; `roll_number` 2–40 |
| 2 Account      | email, password, confirm password                   | email valid; password ≥ 8; confirm equals password                                 |
| 3 College      | searchable list from `listColleges()`               | `college_id` uuid required                                                         |
| 4 ID and rules | optional ID photo, consent checkbox, rules checkbox | `rules` must be true; `consent` must be true if a photo is attached                |

- **Step 3 layout:** search `Field` → list rows (college name display s, short code chip). Selecting shows a check. If the typed email's domain is in the college's `email_domains`, show an ok chip `en.r04.domain_match`; otherwise nothing (no blocking).
- **Step 4 layout:** a dashed photo tile `en.r04.id_tile` → opens camera (`CameraView`, back camera) or, on web, `expo-image-picker` library; preview with Retake. Checkbox `en.r04.consent` (shown only when a photo exists). A `Card` with `en.r04.rules_title` and the five rules from `en.r04.rules` as a numbered list, then checkbox `en.r04.rules_accept`.
- **Submit (`en.r04.submit`):** `signUp({ ..., id_check_consent, rules_accepted: 'true' })`. If the result has a session: if a photo exists, compress, `uploadPhoto('id-cards', uid, ...)`, `setIdPhoto(path, consent)`; then gate (R05 → R06). Upload failure does not block: show Toast `en.r04.photo_later` and continue.
- **Errors:** `CC_EMAIL_TAKEN` jumps back to step 2 with the error under email; `CC_WEAK_PASSWORD` the same under password.
- **Copy:** `title_1` "who's _riding_?" · `title_2` "make an _account_." · `title_3` "pick your _campus_." · `title_4` "almost _there_." · `full_name` "Full name" · `phone` "Phone" · `roll` "Roll or employee number" · `email` "Email" · `password` "Password (8+ characters)" · `confirm` "Confirm password" · `search` "Search colleges" · `domain_match` "Email matches this college" · `id_tile` "Add your college ID card (optional). It helps your admin approve you faster." · `consent` "Let TORQ, CampusCycle's AI, check my ID card against these details. The photo is only sent to AI providers that don't keep data." · `rules_title` "The ride rules" · `rules` ["Borrow and return only at CampusCycle stands.", "One bike per pass; it stays on your pass until you return it.", "Return within your college's time limit or get a strike.", "Report a faulty bike instead of riding it.", "Never lend your pass."] · `rules_accept` "I'll follow the ride rules" · `next` "next" · `submit` "send for approval" · `photo_later` "Your ID photo didn't upload. You can add it from the Pending screen."
- **Acceptance:** a new account appears in A03 with the ID photo and domain badge (when matching); `rules_accepted_at` is set; without a photo the account is still created.

### R05 Permissions

- **Layout:** `Headline` l `en.r05.title` → body `en.r05.body` → four `Card` rows, each: icon, title, one-line reason, and on the right either `Pill` sm `en.r05.allow`, an ok chip `en.r05.granted`, or a warn chip `en.r05.denied` with link `en.r05.settings`. Rows: Location (`expo-location` foreground), Camera (`expo-camera`), Notifications (`expo-notifications`; hidden on web), Microphone (`expo-speech-recognition` permissions). → `Pill` primary lg `en.r05.continue`.
- **Behaviour:** each Allow requests only that permission. Continue sets AsyncStorage `cc-perms-seen = '1'`, registers push if granted, then gate. Nothing is required; later screens ask again when they need a permission.
- **Copy:** `title` "a few _permissions_." · `body` "Ask once, explained up front. You can change these any time in Settings." · `loc_t` "Location" · `loc_d` "Only when you borrow or return, to check you're at a stand. Never during a ride." · `cam_t` "Camera" · `cam_d` "Scan bike QR codes and take one photo when you return." · `not_t` "Notifications" · `not_d` "Approval, ride-time reminders and report updates." · `mic_t` "Microphone" · `mic_d` "Hold to talk to TORQ. Speech becomes text on your phone." · `allow` "Allow" · `granted` "ON" · `denied` "OFF" · `settings` "Open settings" · `continue` "continue".
- **Acceptance:** shown once per install; denying everything still reaches R06/R08.

### R06 Pending approval

- **Data:** `ctx`; `['idCheck']` = `from('profiles').select('id_check_result').eq('id', uid).single()`.
- **Layout:** kicker `en.r06.kicker` ("{college} · applied {time}") → `Headline` xl `en.r06.title` → `RiderPass` state `pending` (non-interactive, idle sway on) → steps list (06 `.steps` style): 1 ✓ `en.r06.step_applied`; 2 ID: one of `en.r06.id_match` (✓ ok), `en.r06.id_mismatch` (! warn), `en.r06.id_checking` (spinner, when photo + consent and no result yet), `en.r06.id_none` (○, no photo); 3 ○ `en.r06.step_review` → body `en.r06.body` → `Pill` secondary md `en.r06.edit` → `Pill` ghost sm `en.r06.sign_out`.
- **Edit details sheet:** fields full name, phone, roll, college picker (same as R04 step 3) and the ID photo tile with consent → `updateApplication(...)`, then if the photo changed: upload + `setIdPhoto`. Save button `en.r06.save`. Errors via `messageFor`.
- **Behaviour:** pull to refresh calls `refresh()`. Realtime approval → gate moves to Home where the pass plays `minting`.
- **Copy:** `kicker` "{college} · applied {time}" · `title` "hold tight, _{first}_." · `step_applied` "Applied with roll number {roll}" · `id_match` "ID card matches, checked by TORQ" · `id_mismatch` "ID card doesn't match your details. Your admin will look closer." · `id_checking` "TORQ is checking your ID card" · `id_none` "No ID card added. Adding one speeds things up." · `step_review` "Admin review, usually within a day" · `body` "Your pass goes live the moment you're approved. We'll ping you." · `edit` "Edit details" · `save` "save" · `sign_out` "Sign out".
- **Acceptance:** approving the rider in A03 while R06 is open moves the app to Home within 3 s and the mint animation plays once.

### R07 Rejected, suspended or no college

`variant` from the gate.

- **rejected:** `RiderPass` state `suspended` styling replaced by a frosted pending card (state `pending`, content blur) → `Headline` xl `en.r07.rej_title` → reason `Card` (kicker `en.r07.reason`, text `profile.rejection_reason`) → `Pill` primary lg `en.r07.reapply` (opens the same edit sheet as R06; saving calls `updateApplication`, which sets status back to pending) → `Pill` ghost sm `en.r07.sign_out`.
- **suspended:** `RiderPass` state `suspended` → `Headline` xl `en.r07.sus_title` → reason `Card` (`profile.suspended_reason`) → body `en.r07.sus_body` (strikes `{n} of {limit}`) → `Pill` secondary md `en.r07.contact` (opens a Sheet with `en.r07.contact_body`) → sign out.
- **no_college** (an admin account without a college, e.g. the owner): `Headline` l `en.r07.nc_title` → body `en.r07.nc_body` → `Pill` primary `en.r07.open_admin` (opens `EXPO_PUBLIC_ADMIN_URL`) → sign out.
- **Copy:** `rej_title` "not _this_ time." · `reason` "Reason from your admin" · `reapply` "fix and re-apply" · `sus_title` "pass _paused_." · `sus_body` "You have {strikes} of {limit} strikes. A college admin can reinstate your pass." · `contact` "Contact admin" · `contact_body` "Visit your college's CampusCycle desk or speak to your college admin. Only they can reinstate a pass." · `nc_title` "admins live on the _web_." · `nc_body` "Your account manages CampusCycle and isn't linked to a campus, so it has no Rider Pass." · `open_admin` "open the admin app" · `sign_out` "Sign out".
- **Acceptance:** rejecting in A03 shows the reason here; re-apply returns the rider to R06 and notifies admins.

### R08 Home: Rider Pass

- **Data:** `ctx`, `getStands(fix)` when location permission is already granted (do not prompt here; without permission call `getStands()` and sort by name), unread count from `['notifications']`.
- **Layout:**
  1. Top row: kicker with the college name (left); bell `IconButton` with unread badge → R18 (right).
  2. `Headline` xl: ready `en.r08.hey` / minting `en.r08.minted` / riding or overdue `en.r08.riding`.
  3. `RiderPass` interactive (tilt, flip to QR + stats on tap). While riding/overdue it shows the live timer.
  4. If riding/overdue: `Card` "ride strip" → kicker `en.r08.on_pass`, bike code numericM, time left (or over) → whole card opens R13.
  5. Otherwise nearest stand `Card`: kicker `en.r08.nearest` ("Nearest stand · {distance}") with `{walk} min walk` on the right; stand name displayL lowercase; `en.r08.free` ("{n} bikes free") in ok; a 6 px bar of free/capacity; tap → R10. Without permission: kicker `en.r08.nearest_noloc` and a link `en.r08.turn_on_loc` (requests permission, then refetch). If no stand has free bikes: `en.r08.none_free` in warn.
  6. Next finish `Card`: kicker `en.r08.next_finish`, finish name displayM, `en.r08.rides_to` ("{n} more rides to unlock {finish}"), progress bar. At Holo: `en.r08.max_finish`.
  7. Bottom spacer for the dock (96 px).
- **States:** loading → pass skeleton (card-shaped `Skeleton`) + two card skeletons. Error → `ErrorState` with retry.
- **Behaviour:** when `passDisplayState` is `minting`: play mint (06 §6.5), haptic, then `markPassMintedSeen()`, show Toast `en.r08.mint_toast`. Dock centre button: Borrow → R11 `mode=borrow`; Return → R14.
- **Copy:** `hey` "hey _{first}_" · `minted` "you're _in_, {first}." · `riding` "riding _{bike}_" · `on_pass` "On your pass" · `nearest` "Nearest stand · {distance}" · `walk` "{min} min walk" · `free` "{n} bikes free" · `none_free` "No free bikes nearby right now." · `nearest_noloc` "Stands" · `turn_on_loc` "Turn on location to see the nearest stand" · `next_finish` "Next finish" · `rides_to` "{n} more rides to unlock {finish}" · `max_finish` "Holo unlocked. You've ridden 50+ times." · `mint_toast` "Your Rider Pass is live."
- **Acceptance:** demo rider sees Graphite finish and "3 more rides to unlock Chrome"; tapping the pass flips it and shows a QR that changes every 30 s; tilting the phone moves the shine.

### R09 Map and stand list

- **Data:** `getStands(fix?)`; refetch every 30 s while focused; pull to refresh in list mode.
- **Layout:** `Headline` l `en.r09.title` → `Segmented` Map | List (persist choice in AsyncStorage `cc-map-mode`) →
  - **Map:** `StandMap` fills the rest above the dock. Native `StandMap.native.tsx` uses `@maplibre/maplibre-react-native` (`MapView` with `styleURL` = dark `https://tiles.openfreemap.org/styles/dark` or day `https://tiles.openfreemap.org/styles/positron`; if the dark URL fails to load at Phase 3, use `https://tiles.openfreemap.org/styles/fiord`), `Camera` centred on the user (if a fix exists) else college centre, zoom 15.5; `MarkerView` per stand with `StandPin`; user dot (`UserLocation`) only when permission granted. Web `StandMap.web.tsx` uses `maplibre-gl` directly with the same styles and HTML markers. Recenter `IconButton` (crosshair) bottom-right. Tapping a pin selects it and shows a bottom `Card` (name, distance, free count, `Pill` sm `en.r09.open`) → R10.
  - **List:** search `Field` (filters by name) → rows: name (display s), kicker distance + walk time, right side free count (numericM, coloured ok/warn/bad by 06 §5.23 thresholds) and label `en.r09.free`. Tap → R10.
- **Empty:** `en.r09.empty` (college has no active stands).
- **Copy:** `title` "find a _bike_." · `map` "Map" · `list` "List" · `open` "Open" · `free` "free" · `search` "Search stands" · `empty` "Your college hasn't added stands yet." · `recenter` "Center on me".
- **Acceptance:** demo campus shows 10 IITK stands with counts; counts change after a borrow elsewhere within 30 s.

### R10 Stand detail

- **Data:** `getStandDetail(id)`, distance from the stand list cache (or computed with haversine from the last fix).
- **Layout:** header (back, right: report IconButton → R16 with `stand`) → kicker `en.r10.kicker` ("{distance} · {walk} min walk") → `Headline` l with the stand name lowercase → two big numbers side by side: free bikes (numericL, ok) with label `en.r10.free`, capacity (numericL, muted) with label `en.r10.capacity` → small static map (same `StandMap` with one pin, non-interactive, height 160, radius 22) → list of bikes at the stand: code (mono bold), `StatusPill`, `en.r10.seen` ("checked {relative}") → bottom bar: `Pill` secondary md `en.r10.directions` + `Pill` primary md `en.r10.borrow_here`.
- **Behaviour:** Directions opens `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=walking` with `Linking.openURL` (works on Android and the web). Borrow here → R11 `mode=borrow` (disabled with `en.r10.not_ready` if the pass is not ready).
- **Copy:** `kicker` "{distance} · {walk} min walk" · `free` "bikes free" · `capacity` "spaces" · `seen` "checked {relative}" · `directions` "Directions" · `borrow_here` "Borrow here" · `not_ready` "Return your current bike first." · `empty_bikes` "No bikes parked here right now."
- **Acceptance:** list shows only bikes that are available or in maintenance at that stand.

### R11 Scanner

`mode` = `borrow` or `return`.

- **Layout:** full-screen camera; dark overlay with a 260 px rounded (28) cut-out frame and corner ticks in `primary`; kicker above the frame (`en.r11.kicker_borrow` or `en.r11.kicker_return` with the bike code); close `IconButton` top-left; torch toggle `IconButton` top-right (`enableTorch`); bottom: `Pill` secondary md `en.r11.enter_code`; demo accounts also get `Pill` primary md `en.r11.demo_pick` (borrow) or `en.r11.demo_use` (return).
- **Behaviour (on a scan):**
  - `parseQr(raw)` → `bike`: borrow mode → `router.replace('/borrow', { code, sig })`; return mode → `setScan({ code, sig })`, `router.back()`.
  - `pass` → Toast `en.r11.is_pass`.
  - `unknown` → Toast `en.r11.unknown`.
- **Enter code sheet:** `Field` (auto upper case, placeholder `K-042`) → `normalizeCode`; invalid → `CC_BAD_CODE` under the field; valid → same as a scan with `sig = ''`.
- **Demo pick sheet (borrow):** list from `listPickableBikes()` grouped by stand: rows "K-004 · Lecture Hall Complex" → behaves exactly like scanning that row's `payload`. **Demo use (return):** one button "Use {bike}" that sets `scan = { code: ctx.ride.bike_code, sig: '' }`.
- **Permission denied:** `ErrorState` `CC_CAMERA_DENIED` with `Open settings` and `Enter code` (and demo pick for demo accounts).
- **Copy:** `kicker_borrow` "Scan the sticker on the bike" · `kicker_return` "Scan {bike} to return it" · `enter_code` "Enter code" · `code_label` "Bike code" · `code_hint` "Printed under the QR, like K-042" · `go` "continue" · `demo_pick` "Pick a demo bike" · `demo_use` "Use {bike}" · `is_pass` "That's a rider pass. Scan the bike's sticker." · `unknown` "That's not a CampusCycle code." · `torch` "Torch" · `close` "Close".
- **Acceptance:** scanning a printed label from A09 opens R12 with that bike; scanning a pass QR does nothing but the toast.

### R12 Borrow

- **Data:** on mount: `fix = await getFix(ctx)` → `previewBike(code, sig, fix)`.
- **Layout (preview ok):** header (back) → kicker with live dot `en.r12.in_range` ("{stand} stand · in range"; demo: `en.r12.demo_range`) → `Headline` xl `en.r12.title` ("{code}, all _yours_?" lower case) → `Card` raised: bike id (numericL), kicker `en.r12.checked` ("checked {relative}") and, when `notes` is non-empty, the note as body text → checklist: ✓ `en.r12.pass_free`, ✓ `en.r12.at_stand`, and if `manual` a warn row `en.r12.manual` → body `en.r12.terms` ("It stays on your pass until you return it at any stand. Max {hours} hours.") → `SlideToConfirm` `en.r12.slide`.
- **On confirm:** `borrowBike(code, sig, fix)` (reuse `fix`, which is < 60 s old). Success → invalidate `['ctx']`, `router.replace('/riding', { docked: '1' })`.
- **Loading:** kicker `en.r12.checking` + bike card skeleton.
- **Errors** (from preview or borrow) → `ErrorState` with the copy from 03 §2 and these actions:

| Code                                                                           | Primary action              | Secondary action                     |
| ------------------------------------------------------------------------------ | --------------------------- | ------------------------------------ |
| `CC_NOT_AT_STAND`                                                              | `en.r12.show_stands` → R09  | `en.r12.try_again`                   |
| `CC_POOR_ACCURACY`, `CC_LOCATION_TIMEOUT`                                      | `en.r12.try_again`          | —                                    |
| `CC_LOCATION_DENIED`                                                           | `en.common.open_settings`   | —                                    |
| `CC_MOCK_LOCATION`                                                             | `en.r12.try_again`          | —                                    |
| `CC_BIKE_NOT_AT_THIS_STAND`, `CC_BIKE_IN_MAINTENANCE`, `CC_BIKE_NOT_AVAILABLE` | `en.r12.scan_another` → R11 | `en.r12.report_bike` → R16 with bike |
| `CC_PASS_HAS_BIKE`                                                             | `en.r12.go_ride` → R13      | —                                    |
| `CC_BAD_QR`, `CC_BAD_CODE`, `CC_BIKE_NOT_FOUND`                                | `en.r12.scan_another`       | `en.r11.enter_code`                  |
| others                                                                         | `en.r12.try_again`          | —                                    |

- **Copy:** `in_range` "{stand} stand · in range" · `demo_range` "Demo · {stand} stand" · `title` "{code}, all _yours_?" · `checked` "checked {relative}" · `pass_free` "Your pass is free" · `at_stand` "You're at {stand} stand" · `manual` "Code typed by hand. Make sure it's the bike in front of you." · `terms` "It stays on your pass until you return it at any stand. Max {hours} hours." · `slide` "slide to borrow" · `checking` "Checking the bike…" · `show_stands` "Show stands" · `try_again` "Try again" · `scan_another` "Scan another bike" · `report_bike` "Report this bike" · `go_ride` "Go to my ride" · `deeplink_not_ready` "Your pass can't borrow right now."
- **Acceptance:** two phones sliding for the same bike at once: exactly one succeeds, the other sees `CC_BIKE_NOT_AVAILABLE`.

### R13 Riding

- **Data:** `ctx.ride` (redirect to Home if null), `getStands(fix)` once on mount for nearest stands (skip silently if no permission).
- **Layout:** header (back to Home) → kicker `en.r13.kicker` ("riding from {start}") → `RiderPass` riding/overdue (plays dock animation once when `docked=1`) → timer `Card`: kicker `en.r13.ride_time`, `formatTimer(now − started_at)` in numericXL (ticks every second), then a row: `en.r13.time_left` with value, or when overdue `en.r13.over` in warn and a warn banner `en.r13.overdue_note` → nearest stands `Card` (up to 3 rows: name, distance, `{n} free`) → bottom bar: `Pill` primary lg `en.r13.return` → R14; `Pill` secondary md `en.r13.report` → R16 with `ride` → link buttons `en.r13.cant_reach` (sheet) and `en.r13.lost` (→ R16 with `type=bike_missing`).
- **Can't reach a stand sheet:** body `en.r13.cant_reach_body`, `Field` note (min 3 chars), `Pill` primary `en.r13.ask_close` → `requestRideClose(note)` → Toast `en.r13.close_sent`.
- **Behaviour:** the timer uses device time; on app foreground `refresh()` updates overdue state. The screen keeps working after the app is closed and reopened (state comes from the server).
- **Copy:** `kicker` "riding from {start}" · `ride_time` "Ride time" · `time_left` "Time left {left}" · `over` "Over by {over}" · `overdue_note` "Return it at any stand now. A late return adds a strike." · `nearest` "Nearest stands" · `return` "return here" · `report` "Report problem" · `cant_reach` "Can't reach a stand?" · `cant_reach_body` "Flat tyre far away or an accident? Tell your admin what happened and they'll close the ride for you." · `ask_close` "ask admin to close my ride" · `close_sent` "Sent. An admin will close your ride." · `lost` "Bike lost or taken?"
- **Acceptance:** killing and reopening the app during a ride opens R13 with the correct elapsed time.

### R14 Return

Three ticks at the top (06 `.steps` style, horizontal): `en.r14.t1` at a stand, `en.r14.t2` same bike, `en.r14.t3` photo. Each tick turns ok when done.

1. **At a stand.** Non-demo: `getFix` → `checkReturnLocation(fix)`. Demo: a Sheet `en.r14.demo_pick` lists the college's stands (from `getStands()`); choosing one calls `checkReturnLocation(fix, standId)` and stores `demoStandId`. Success shows kicker ✓ `en.r14.at` ("at {stand}") and, if `stand_full`, a warn note `en.r14.full`. Errors use the R12 table (location rows).
2. **Same bike.** `Pill` primary lg `en.r14.scan` → R11 `mode=return`. When `scan` arrives: if `scan.code !== ctx.ride.bike_code` show `messageFor('CC_WRONG_BIKE', { scanned, pass_bike })` and keep the step open; else tick ok.
3. **Photo.** In-screen `CameraView` (height 360, radius 26) with a 72 px round shutter button; after capture show the photo with `Pill` secondary `en.r14.retake`. On web without a camera, or with camera permission denied, show `Pill` ghost `en.r14.skip_photo` (allowed only then).
4. **Finish:** `Pill` primary lg `en.r14.finish` ("return {bike}"), enabled when steps 1–3 are done. Calls in order: compress → `uploadPhoto('return-photos')` (20 s timeout; on failure `path = null` and enqueue `{ rideId: ctx.ride.id, uri }`) → `returnBike(scan.code, scan.sig, fix, path, demoStandId)`. Success → `setResult(result)` → `router.replace('/ride/' + result.ride_id + '?fresh=1')`.

- **Copy:** `title` "drop it _off_." · `t1` "At a stand" · `t2` "Same bike" · `t3` "Photo" · `checking` "Checking where you are…" · `at` "at {stand}" · `full` "This stand is full. You can still return here; admins are told." · `demo_pick` "Demo: which stand are you returning to?" · `scan` "scan {bike}" · `photo_hint` "Take one photo of the bike parked at the stand." · `retake` "Retake" · `skip_photo` "Skip photo" · `finish` "return {bike}" · `uploading` "Uploading photo…"
- **Acceptance:** returning at a different stand than the start works; wrong bike shows "That's K-005. Your pass holds K-004, so scan that bike."; with the network cut after step 3 the ride still ends once the network is back for the RPC, and the photo attaches later.

### R15 Ride summary and history

**Summary** (`ride/[id]`). With `fresh=1` it uses `result` from the return flow context; otherwise it loads `getRide(id)` (Q2).

- **Layout (fresh):** ticks row (✓ at {end stand} ✓ {bike} ✓ photo or `en.r15.photo_later`) → `RiderPass` small (width 70%) in `returned` state with stamp `RETURNED AT {STAND} · {N} MIN` (after 2.5 s back to ready; if `finish_after !== finish_before` play the level-up) → `Headline` xl `en.r15.title` → `Receipt` (06 §5.19):
  - top (primary): kicker `en.r15.kicker` ("Ride time · {bike}"), duration numericL (`mm:ss` for < 1 h else `h:mm`), route row: start stand · dashed line · end stand (06 `.route`);
  - bottom: rows `en.r15.date` (date and start–end clock times), `en.r15.ride_no` ("Ride #{total_rides}"), finish progress (`en.r08.rides_to`), and when `late` a warn row `en.r15.late` ("Returned late · strike {strikes} of {limit}"); when `suspended` a bad row `en.r15.suspended`.
  - Stickers on the receipt: if this was the rider's first ride, sticker `en.r15.first` (yellow, 7°) on the top-right corner.
- Buttons: `Pill` secondary md `en.r15.share` and `Pill` primary lg `en.r15.done` (→ Home).
- **Share (shareable ride receipt):** wraps the pass + receipt block in a `ViewShot` (`react-native-view-shot`, PNG, 1080 px wide, background `bg`, includes the wordmark at the bottom) → `expo-sharing` `shareAsync(uri, { mimeType: 'image/png', dialogTitle: en.r15.share })`. Web: `navigator.share({ text: en.r15.share_text })` if available, else copy `en.r15.share_text` to the clipboard and Toast `en.common.copied`. `share_text` = "Just rode {minutes} min from {from} to {to} on CampusCycle."
- **Non-fresh:** same receipt without stamp animation, using Q2 data; photo check chip from `photo_check` (`ok` → "Photo checked", `unclear`/`failed` → "Photo flagged for an admin", `pending` → "Photo being checked", `skipped` → nothing); `force_returned` shows `en.r15.forced` with `force_note`.

**History** (`(main)/history`).

- **Layout:** `Headline` l `en.r15.h_title` → stats row of three numbers from `getPassStats()`: rides, minutes, fave stand → next finish card (same as R08 card 6) → list (infinite scroll, Q1, 20 per page) grouped by month (kicker `OCT 2026`): rows with date (mono), `{from} → {to}`, duration, chips `LATE` (warn) or `CLOSED BY ADMIN` (subtle). Tap → `ride/[id]`.
- **Empty:** sticker `en.r15.first_q` (yellow −4°) + `Headline` m `en.r15.empty` + `Pill` primary `en.r15.borrow` → R11.
- **Copy:** `title` "nice ride, _{first}_." · `kicker` "Ride time · {bike}" · `date` "{date} · {start}–{end}" · `ride_no` "Ride #{n}" · `late` "Returned late · strike {strikes} of {limit}" · `suspended` "Your pass is now suspended. Contact your college admin." · `first` "first ride!" · `share` "Share" · `share_text` "Just rode {minutes} min from {from} to {to} on CampusCycle." · `done` "done" · `photo_later` "photo uploading" · `forced` "Closed by an admin: {note}" · `h_title` "your _rides_." · `rides` "rides" · `minutes` "minutes" · `fave` "favourite stand" · `first_q` "first ride?" · `empty` "your rides land _here_" · `borrow` "borrow a bike".
- **Acceptance:** after a return the stamp lands, then the receipt shows the right stands and minutes; Share produces a PNG on Android.

### R16 Report issue

- **Params:** `bike`, `ride`, `stand`, `type` (all optional). If the rider is riding and no `bike` is given, prefill with `ctx.ride.bike_code` and `ride` with `ctx.ride.id`.
- **Layout:** header (back) → `Headline` l `en.r16.title` → photo tile (dashed, 180 high): `en.r16.snap` → camera capture → preview + Retake; while TORQ works, a chip `en.r16.looking` with spinner; when done a chip `en.r16.suggested` (✓) → type chips (wrap): Flat tyre, Brakes, Chain, Damaged QR sticker, Bike missing, Accident, Other (`en.r16.types.*`) → `Field` bike code (optional, upper case) → `Field` note multiline (max 1000, counter) → `Pill` primary lg `en.r16.send`.
- **Behaviour:** after capture: compress → `uploadPhoto('issue-photos')` → `torq-suggest` with the path → if a type comes back, select it and fill the note **only if the note is still empty**; store `ai_suggested_type`. The rider can change anything. Send → `reportIssue({ type, note, bike_code, ride_id, stand_id, photo_path, ai_suggested_type })` → Toast `en.r16.sent` → back. Type `bike_missing` during a ride: Toast `en.r16.missing_sent` instead. Send is disabled until a type is chosen.
- **Copy:** `title` "what's _wrong_?" · `snap` "Snap a photo and TORQ fills in the rest" · `looking` "TORQ is looking…" · `suggested` "Suggested by TORQ, edit if needed" · `types` { flat_tyre: "Flat tyre", brakes: "Brakes", chain: "Chain", damaged_qr: "Damaged QR sticker", bike_missing: "Bike missing", accident: "Accident", other: "Other" } · `bike` "Bike code (optional)" · `note` "What happened?" · `send` "send report" · `sent` "Thanks. Your admin can see it now." · `missing_sent` "Reported. An admin will review it and release your pass."
- **Acceptance:** a photo of a flat tyre pre-selects Flat tyre; a report without a photo works; the report appears in A11.

### R17 TORQ chat

Full spec of the harness is in `07-torq.md`; this is the screen.

- **Layout:** header: close IconButton, TORQ mark, title `TORQ` (mono bold), kicker `en.r17.kicker`; right: history IconButton (Sheet with the last 30 threads, Q13; tap opens it) and new-chat IconButton → message list (inverted `FlatList`) → `AskBar` (06 §5.18) above the keyboard → footer note `en.r17.footer` (bodyS, subtle).
- **Empty thread:** `Headline` l `en.r17.empty_title` → suggestion chips (tap sends): `en.r17.sugg` = ["Nearest free bike?", "How long do I have left?", "My bike has a flat tyre", "Explain the ride rules", "साइकिल कहाँ लौटाऊँ?"].
- **Sending:** `streamChat` (03 §4.3) with `surface: 'rider_chat'`, `location` when permission is granted (use the cached fix only; never prompt here), `photo_path` when a photo is attached (camera IconButton → capture → compress → `uploadPhoto('torq-photos')`). The user bubble appears immediately; an assistant placeholder bubble shows `StepChips` from `step` events (labels from 07 §10.2); on `message` it is replaced by the final bubble; `action` events render `ConfirmCard`s under that bubble.
- **Confirm card:** Confirm → POST `torq-action` `{ action_id, decision: 'confirm' }` (button loading) → card shows the result pill, and the returned `message` is appended. Cancel → `decision: 'cancel'`.
- **Voice:** hold the mic: `ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false })`; interim text fills the input; on release `stop()`; when the final result arrives, send with `input_mode: 'voice'`. Language chip next to the mic toggles `en-IN` ↔ `hi-IN` (`en.r17.lang_en` / `en.r17.lang_hi`, persisted in AsyncStorage `cc-voice-lang`). If recognition isn't available (`isRecognitionAvailable()` false), the mic is hidden. `?listen=1` starts listening on open.
- **Read aloud:** speaker IconButton under each assistant bubble → `Speech.speak(text, { language: /[ऀ-ॿ]/.test(text) ? 'hi-IN' : 'en-IN' })`; tap again stops. If R19's "Read TORQ replies aloud" is on, new replies are spoken automatically after a voice question.
- **Errors:** `error` events and HTTP errors appear as a centred system line with `messageFor(code)` (e.g., demo pool empty). The input stays usable.
- **Copy:** `kicker` "AI · reads live stands" · `empty_title` "ask _torq_." · `placeholder` "Ask TORQ, or hold to talk" · `footer` "TORQ can make mistakes. It never borrows or returns a bike for you." · `history` "Past chats" · `new` "New chat" · `lang_en` "EN" · `lang_hi` "हिं" · `listening` "Listening…" · `speak` "Read aloud" · `stop` "Stop".
- **Acceptance:** the seeded Hinglish thread "Flat tyre on K-004" is in history for the demo rider; asking "nearest free bike?" shows step chips, then an answer naming a stand with free bikes; asking to report a flat tyre shows a confirm card, and Confirm creates an issue visible in A11 with source `torq`.

### R18 Notifications

- **Data:** Q4; realtime inserts prepend.
- **Layout:** header (back, right: `en.r18.mark_all`) → `Headline` l `en.r18.title` → list rows: kind icon in a 36 px circle (approval/reinstated → check ok; rejection/suspension/strike → alert bad; ride_reminder/ride_overdue → clock warn; ride_closed → flag; issue_update → wrench; password_reset → key; torq → zap; admin_alert → bell), title (body semibold), body (bodyS muted, 2 lines), relative time (mono), unread dot (primary) → tap: `markNotificationsRead([id])` and navigate (§1.8).
- **Empty:** sticker `en.r18.sticker` + `Headline` m `en.r18.empty`.
- **Copy:** `title` "_inbox_." · `mark_all` "Mark all read" · `sticker` "all quiet" · `empty` "nothing _new_".
- **Acceptance:** approving a rider creates "You're in" here and a push on Android.

### R19 Profile and help

- **Layout:** header row: small `RiderPass` preview (static, 40% width) + name (display m), email (muted), college, pass label (mono) → sections as `Card`s with rows:
  1. **Details:** phone (inline edit: tap → `Field` + save → `updateMyProfile({ phone })`), roll number and name read-only with hint `en.r19.ask_admin`.
  2. **Strikes:** `{strikes} of {limit}` with explanation `en.r19.strikes_body`.
  3. **Ride rules:** the college's `rules_text` (pre-wrapped).
  4. **Notifications:** switches `en.r19.n_approval`, `en.r19.n_reminders`, `en.r19.n_issues` → `updateMyProfile({ notif_prefs })`; note `en.r19.n_always`.
  5. **Appearance:** `Segmented` System / Dark / Day → `setTheme`.
  6. **TORQ:** switch `en.r19.read_aloud` (AsyncStorage `cc-read-aloud`); row `en.r19.clear_memory` → confirm dialog → `clearMyAiMemory()` → Toast `en.r19.cleared` ("TORQ forgot {n} things").
  7. **Account:** `en.r19.change_pw` (Sheet: new password + confirm → `changePassword`; hidden for demo) · `en.r19.sign_out` · `en.r19.delete` (danger; hidden for demo) → dialog requiring the user to type `DELETE` → `deleteMyAccount()` → sign out → R01. `CC_PASS_HAS_BIKE` shows its copy.
  8. **Help:** `en.r19.how` (Sheet with the five borrow/return steps from `en.r19.how_steps`), `en.r19.privacy` (opens `{ADMIN_URL}/privacy`), app version (`Constants.expoConfig.version` + runtime) in mono.
- **Copy:** `ask_admin` "Ask your college admin to change this." · `strikes_t` "Strikes" · `strikes_body` "A late return adds a strike. At {limit} your pass is paused until an admin reinstates it." · `rules_t` "Ride rules" · `notif_t` "Notifications" · `n_approval` "Approval and account" · `n_reminders` "Ride reminders" · `n_issues` "Report updates" · `n_always` "Approvals, suspensions and overdue alerts always arrive." · `appearance` "Appearance" · `system` "System" · `dark` "Dark" · `day` "Day" · `torq_t` "TORQ" · `read_aloud` "Read TORQ replies aloud after I speak" · `clear_memory` "Clear what TORQ remembers about me" · `cleared` "TORQ forgot {n} things." · `account` "Account" · `change_pw` "Change password" · `sign_out` "Sign out" · `delete` "Delete account" · `delete_body` "This removes your login, your pass, your TORQ chats and memory. Your past rides stay in your college's records without your name. Type DELETE to confirm." · `help` "Help" · `how` "How borrowing works" · `how_steps` ["Walk to any stand and tap Borrow.", "Scan the QR sticker on a bike and slide to borrow.", "Ride. The bike stays on your pass.", "Park at any stand, tap Return and scan the same bike.", "Take one photo. Done."] · `privacy` "Privacy policy" · `version` "Version {v}".
- **Acceptance:** theme change applies instantly and persists after restart; clear memory deletes `ai_memories` rows for the user; delete account removes the auth user and returns to R01.

## 4. Web build of the rider app

- `pnpm --filter @campuscycle/mobile exec expo export --platform web` → `apps/mobile/dist/` (single-page output).
- Deployed as a second Vercel project `campuscycle-ride` with root `apps/mobile`, build command `pnpm expo export --platform web`, output `dist`, and a rewrite of all paths to `/index.html` (`apps/mobile/vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`).
- Web differences (all handled by `.web.tsx` files or `Platform.OS === 'web'` checks): map (`maplibre-gl`), Rider Pass (CSS 3D), no push, mic via the browser's speech recognition through `expo-speech-recognition` web support (hidden if unsupported), sharing via `navigator.share`/clipboard, photos via the browser camera or file picker.
- The web build is meant for the demo rider; real riders use the APK.

## 5. Acceptance for the whole app (Phase 3 exit)

1. The Maestro flows in 09 §5 pass on an Android emulator.
2. Every screen renders correctly in dark and day themes, with font scale 1.3 and with reduce motion on.
3. All copy comes from `strings/en.ts` (a grep for quoted literals in JSX finds none outside the strings file and tests).
4. The demo rider can complete borrow → ride → return on the web build at `campuscycle-ride.vercel.app` without GPS.
