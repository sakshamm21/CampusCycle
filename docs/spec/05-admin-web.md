# 05 · Admin web app (`apps/admin`)

The admin web app is a Next.js App Router site with 18 signed-in pages (A01–A18) and 3 public pages. It holds every management feature for college admins and super admins, and it doubles as the showcase web app. Riders use the rider app (Android APK, or the rider web build at `campuscycle-ride.vercel.app`, 04 §4); the admin site links to it from Sign in, `/try` and the sidebar.

Read `06-design-system.md` §7 for the web components and tokens and `03-api-and-functions.md` for every wrapper and query (`Q5`…`Q15`). Copy lives in `packages/shared/src/strings/en.ts` under `en.<page>`; `*word*` marks the italic accent word (01 §9).

## 1. App-wide behaviour

### 1.1 Supabase clients and auth

- `src/lib/supabase/browser.ts`: `createBrowserClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` as a module singleton.
- `src/lib/supabase/server.ts`: `createServerClient` with the Next.js `cookies()` adapter (`getAll`/`setAll`).
- `src/middleware.ts`: refreshes the session on every request (standard `@supabase/ssr` middleware); matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `fonts/`, and image files.
- Public paths: `/sign-in`, `/try`, `/privacy`, `/delete-account`. Every other path is inside the `(app)` route group.
- `(app)/layout.tsx` (server component): `getUser()`; none → redirect `/sign-in`. Then `rpc('get_my_context')`; if `profile.role === 'rider'` or `profile.status !== 'approved'` → sign out and redirect `/sign-in?e=CC_NOT_ADMIN`. Passes `ctx` to the client `AppShell`.
- Sign-in page shows `messageFor(searchParams.e)` when `e` is present.

### 1.2 College scope

`src/lib/scope.tsx` exposes `useCollege(): { collegeId: string; college: CollegeLite; colleges: CollegeLite[]; setCollege(id) }`.

- College admin: always `ctx.college.id`; no switcher.
- Super admin (including the owner, who has no college): list from `from('colleges').select('id,name,short_code,active').order('name')`; current choice in cookie `cc-college` (1 year); default is the college with short code `IITK`, else the first. The switcher is a `Select` at the top of the sidebar; changing it invalidates all queries.
- Every page that shows college data reads `collegeId` from this hook.

### 1.3 Providers and shell

`(app)/layout.tsx` renders `<Providers ctx>` → `QueryClientProvider` (staleTime 15 s, retry 1) → `ThemeProvider` (sets `data-theme="dark"` or `"day"` on `<html>` from `profile.theme`, System follows `prefers-color-scheme`; writes changes back with `updateMyProfile`) → `CollegeProvider` → `RealtimeBridge` → `AppShell`.

`AppShell` layout:

- **≥ 1024 px:** left sidebar 248 px (`surface`, right border): wordmark + college switcher or college name; nav groups (below); bottom: demo chip (if demo), theme toggle, account avatar menu (My account, Sign out). Main column max width 1280, padding 32.
- **< 1024 px:** top bar 56 px (wordmark, college short code, menu button opening the sidebar as a `Sheet`); bottom tab bar 64 px with Scan, Approvals, Map, TORQ, More (opens the sheet). Main padding 16.
- `TorqFab` (06 §5.10) bottom-right on every page except A13; it opens A13.
- `OfflineBanner` at the top when `navigator.onLine` is false.
- `DemoBanner` under the top bar for demo accounts: `en.common.demo_banner_admin` = "Demo mode · resets every night at 4:00 AM IST · real people and settings are read-only".

Nav groups (label → route; badge):

- **Operate:** Dashboard `/dashboard` · Approvals `/approvals` (badge `pending_approvals`) · Scan `/scan` · Live map `/map` · Issues `/issues` (badge `open_issues`)
- **Fleet:** Rides `/rides` · Bikes `/bikes` · QR labels `/bikes/labels` · Stands `/stands`
- **People:** Users and passes `/users`
- **TORQ:** Console `/torq` · Traces `/torq/traces` · AI usage `/torq/usage`
- **College:** Settings `/settings` · Audit log `/audit` · Colleges `/colleges` (super admin only)
- Link at the bottom: "Rider app ↗" → `NEXT_PUBLIC_RIDER_WEB_URL`.

Badges come from `dashboardStats` (query key `['stats', collegeId]`, refetch every 60 s and on realtime events).

### 1.4 Realtime

`RealtimeBridge` opens channel `college:<collegeId>` (03 §3.7) and on any change invalidates: bikes → `['bikes']`, `['stats']`, `['map']`; rides → `['rides']`, `['stats']`, `['map']`; issue_reports → `['issues']`, `['stats']`. A notification insert for the signed-in user of kind `admin_alert` shows a `sonner` toast with the title, body and an "Open" action that routes by `data.screen`:

| `data.screen` | Route                                            |
| ------------- | ------------------------------------------------ |
| `approvals`   | `/approvals`                                     |
| `users`       | `/users/<data.user_id>` if present else `/users` |
| `rides`       | `/rides?ride=<data.ride_id>`                     |
| `stands`      | `/stands`                                        |
| `issues`      | `/issues?id=<data.issue_id>`                     |
| other         | `/dashboard`                                     |

### 1.5 Query keys

`['ctx']`, `['stats', c]`, `['ridesPerDay', c]`, `['insights', c, kinds]`, `['users', c, filters]`, `['user', id]`, `['rides', c, filters, page]`, `['bikes', c, filters]`, `['stands', c]`, `['issues', c, filters]`, `['map', c]`, `['threads', 'admin_console']`, `['messages', threadId]`, `['runs', c, filters, page]`, `['run', id]`, `['usage', c]`, `['aiSettings', c]`, `['evals']`, `['colleges']`, `['audit', c, filters, page]`.

### 1.6 Tables, filters and URLs

- Every list page uses the shared `DataTable` (styling in 06 §7): server-side filters through the query, client-side sort, pagination 50 rows (`range`).
- Filter state lives in the URL search params (`useSearchParams` + `router.replace`), so links to filtered views can be shared and the back button works.
- Row click opens a detail `Sheet` on the right (480 px; full screen under 640 px) unless stated otherwise.
- Every destructive or person-affecting action opens a confirm `Dialog` that names the target and, where the RPC needs one, has a reason `Textarea` (min 3 chars). Buttons show a spinner while pending; success → toast (`en.common.done` = "Done.") and invalidate the related keys; error → toast with `messageFor(toAppError(e))`.
- Times show in the college time zone with `formatDateTime` / `formatRelative` (01 §11).
- Photos load through `signedPhotoUrl` (600 s) inside a `PhotoThumb` (`components/common/PhotoThumb.tsx`: 8 px radius thumbnail) that opens a lightbox.

### 1.7 Demo accounts

Demo admins see and change only demo data (the database enforces it). The UI additionally:

- disables Settings save, Stands save, Colleges create/activate and Change role with a tooltip `en.errors.CC_DEMO_READONLY`;
- hides Change password on A18;
- shows the `DemoBanner`.

### 1.8 Page frame

Every page starts with `PageHeader`: `Kicker` (group name), `Headline` l (title from the page copy, lowercase with one accent word), optional lede, and right-aligned actions. Loading: `Skeleton` blocks matching the layout. Errors: `ErrorState` with retry. Empty: `EmptyState` with a sticker and one line.

## 2. Folder layout

```
apps/admin/
  next.config.ts            transpilePackages: ['@campuscycle/shared']; images.unoptimized: true
  middleware.ts → src/middleware.ts
  public/
    fonts/                  copied by scripts/fetch-fonts.mjs (06 §3)
    icon.png  apple-icon.png  og.png
  src/
    app/
      layout.tsx            <html> with fonts, tokens.css, globals.css, Toaster
      globals.css           Tailwind v4 @import + @theme mapping to tokens (06 §2.5)
      tokens.css            generated by scripts/gen-tokens.mjs
      sign-in/page.tsx      A01
      try/page.tsx          public demo page
      privacy/page.tsx      renders docs/privacy.md (copied to src/content/privacy.md at build)
      delete-account/page.tsx
      (app)/
        layout.tsx          auth gate + Providers + AppShell
        dashboard/page.tsx  A02
        approvals/page.tsx  A03
        users/page.tsx      A04 list
        users/[id]/page.tsx A04 detail
        scan/page.tsx       A05
        map/page.tsx        A06
        rides/page.tsx      A07
        bikes/page.tsx      A08
        bikes/labels/page.tsx A09
        stands/page.tsx     A10
        issues/page.tsx     A11
        settings/page.tsx   A12
        torq/page.tsx       A13
        torq/traces/page.tsx          A14 list
        torq/traces/[runId]/page.tsx  A14 detail
        torq/usage/page.tsx A15
        colleges/page.tsx   A16
        audit/page.tsx      A17
        account/page.tsx    A18
    components/
      ui/                   shadcn components
      shell/                AppShell.tsx, Sidebar.tsx, BottomTabs.tsx, CollegeSwitcher.tsx, DemoBanner.tsx, OfflineBanner.tsx
      common/               PageHeader.tsx, DataTable.tsx, StatTile.tsx, StatusPill.tsx, PhotoThumb.tsx, EmptyState.tsx,
                            ErrorState.tsx, ConfirmDialog.tsx, ReasonDialog.tsx, Kicker.tsx, Headline.tsx, Sticker.tsx
      pass/                 RiderPassWeb.tsx (06 §6.7)
      map/                  CampusMap.tsx, StandMarker.tsx, BikeDot.tsx
      torq/                 TorqConsole.tsx, MessageBubble.tsx, StepChips.tsx, ActionCard.tsx, ChartBlock.tsx,
                            TableBlock.tsx, VoiceButton.tsx, TorqFab.tsx, TraceTimeline.tsx
      scan/                 QrScanner.tsx
    lib/
      supabase/             browser.ts, server.ts
      scope.tsx             college scope (§1.2)
      providers.tsx         QueryClient, Theme, College, Realtime
      realtime.tsx          RealtimeBridge
      csv.ts                toCsv(rows, columns) with papaparse unparse + download
      sse.ts                readSse(response, onEvent) (shared with 03 §4.3 client)
      speech.ts             Web Speech API wrapper (§3 A13)
```

## 3. Pages

---

### A01 Sign in (`/sign-in`)

- **Layout (desktop):** two columns. Left (`surface2`, 45%): wordmark, `Marquee`, `Headline` xl `en.a01.title`, lede, three stickers (`en.a01.s1..s3`), and a static `RiderPassWeb` in state `ready` tilted −6° with idle sway. Right: form card max 400 px.
- **Phone:** single column, pass hidden.
- **Form:** email, password, `Button` primary `en.a01.submit`. Below a divider: kicker `en.a01.demo_kicker`, two buttons `en.a01.demo_admin` and `en.a01.demo_super` (one click: `signInWithPassword` with `DEMO_EMAILS` and `DEMO_PASSWORD` from constants), then a link row: `en.a01.rider_link` → rider web URL, `en.a01.try_link` → `/try`. Footer links: Privacy, Delete account.
- **Behaviour:** on success, `get_my_context`; non-admin → sign out, show `CC_NOT_ADMIN`; admin → `/dashboard`. Forgot password is a line of text, not a flow: `en.a01.forgot`.
- **Copy:** `title` "run your campus _fleet_." · `lede` "Approve riders, watch every bike live and let TORQ do the busywork." · `s1` "live map" · `s2` "TORQ copilot" · `s3` "QR scan" · `email` "Email" · `password` "Password" · `submit` "Sign in" · `demo_kicker` "Try it without an account" · `demo_admin` "Demo college admin" · `demo_super` "Demo super admin" · `rider_link` "Open the rider app in your browser ↗" · `try_link` "Demo QR codes" · `forgot` "Forgot your password? Ask a super admin to reset it."
- **Acceptance:** demo rider credentials show "This site is for college admins…"; each demo button lands on the dashboard with the demo banner.

### A02 Dashboard (`/dashboard`)

- **Data:** `dashboardStats(c)`, `ridesPerDay(c, 30)`, Q9 insights kinds `digest`, `rebalancing`.
- **Layout:**
  1. `PageHeader` title `en.a02.title` ("good _morning_, {first}." with morning/afternoon/evening by college-local hour: <12, <17, else), kicker = today's date.
  2. **Digest card** (full width, `surface`, left 4 px `primary` bar): kicker `en.a02.digest_kicker` ("TORQ · morning digest"), the digest `title` as display M, then each item as a row with `n` in numericL `primary` and `text` in body. Footer: `en.a02.digest_time` ("written {relative}") and a link "View trace" → `/torq/traces/<run_id>` when `run_id` is set. Empty: `en.a02.digest_empty`.
  3. **Stat tiles** (grid 4 columns desktop, 2 phone): bikes available (ok), borrowed, maintenance (warn), missing (bad), active rides, overdue rides (bad if > 0, subtext `overdue_example` "K-007 · IITK · 0118"), pending approvals (link → A03, subtext "{pending_id_match} ID matches"), open issues (link → A11). `StatTile` shows label kicker, numericL value, optional subtext.
  4. **Rides per day**: Recharts `BarChart` 30 bars, height 220, bar fill `primary`, today's bar `fg`; x ticks every 5 days `d MMM`; tooltip "{n} rides on {date}". Next to it (desktop) a small tile "avg ride {avg_ride_minutes_7d} min (7 days)".
  5. **Rebalancing card**: kicker `en.a02.rebal_kicker`, list of moves from the latest `rebalancing` insight: "{count} bikes · {from_name} → {to_name} · by {hh}:00" and the `reason` (muted). Buttons per insight: `en.a02.rebal_apply` (opens a confirm dialog listing the bike codes and calls `moveBikes` with one `{ bike_code, stand_id: to_stand_id }` entry per bike code, max 20, then `setInsightStatus(id,'accepted')`), `en.a02.rebal_dismiss` (`setInsightStatus(id,'dismissed')`). Empty: `en.a02.rebal_empty`.
- **Copy:** `title` "good _{part}_, {first}." · `digest_kicker` "TORQ · morning digest" · `digest_time` "written {relative}" · `digest_empty` "TORQ writes a digest every morning at 6:00." · `stat_available` "Available" · `stat_borrowed` "Borrowed" · `stat_maintenance` "Maintenance" · `stat_missing` "Missing" · `stat_active` "Active rides" · `stat_overdue` "Overdue" · `stat_pending` "Pending approvals" · `stat_id` "{n} ID matches" · `stat_issues` "Open issues" · `chart_title` "Rides per day" · `avg` "avg ride {n} min (7 days)" · `rebal_kicker` "TORQ · rebalancing suggestions" · `rebal_apply` "Move these bikes" · `rebal_dismiss` "Dismiss" · `rebal_empty` "No moves needed right now."
- **Acceptance:** demo admin sees the seeded digest, non-zero tiles and 30 bars; applying a rebalancing move changes the bikes' stands in A08 and writes an audit row.

### A03 Approvals (`/approvals`)

- **Data:** Q5 with `status = pending`, ordered by `applied_at` ascending.
- **Layout:** `PageHeader` title `en.a03.title`, lede `en.a03.lede` ("{n} waiting"). Toolbar: filter chips All / ID matches / ID mismatch / No ID / Domain match; `Button` secondary `en.a03.approve_selected` (enabled with ≥ 1 selected, max 50).
- **List:** cards (not a table), one per applicant, with a checkbox:
  - left: `PhotoThumb` of `id_photo_path` (120×76) or a dashed placeholder `en.a03.no_id`;
  - middle: name (display S), email, phone, roll number (mono), applied relative time, chips: `DOMAIN MATCH` (ok) when `email_domain_match`; ID result chip: `ID MATCH` (ok), `ID MISMATCH` (warn) with `notes` under it, `ID CHECK PENDING` (subtle, consent + photo + no result), `NO CONSENT` (subtle, photo without consent);
  - right: `Button` primary `en.a03.approve`, `Button` ghost `en.a03.reject`.
- **Reject:** `ReasonDialog` with quick-pick chips (`en.a03.reasons`: "Couldn't verify you're a student here", "Details don't match your ID card", "Please use your college email", "Duplicate account") that fill the textarea → `rejectRider(id, reason)`.
- **Approve selected:** confirm dialog listing names → `approveRiders(ids)`; toast "{n} riders approved".
- **Empty:** sticker "inbox zero" + `en.a03.empty`.
- **Copy:** `title` "who's _in_?" · `lede` "{n} waiting" · `approve` "Approve" · `reject` "Reject" · `approve_selected` "Approve selected" · `no_id` "No ID card" · `reasons` (above) · `reject_title` "Reject {name}?" · `reason_label` "Reason (the rider sees this)" · `empty` "Nobody waiting. New sign-ups show up here instantly." · `approved_n` "{n} riders approved".
- **Acceptance:** approving moves the card out at once and the rider's app updates (04 R06); the seeded mismatch applicant shows the warn chip and its note.

### A04 Users and passes (`/users`, `/users/[id]`)

- **List data:** Q5 with filters: search (`or(full_name.ilike.%q%,email.ilike.%q%,roll_number.ilike.%q%)`), status (`pending|approved|rejected|suspended`), role, "Has a bike" (`bike_code not null`), "Has strikes" (`strikes > 0`), "Reset requested" (`password_reset_requested_at not null`).
- **Columns:** name + email, roll, role chip, status `StatusPill`, pass label (mono), bike on pass (mono, link to A08), strikes "{n}/{limit}", rides total, applied date. Row click → `/users/[id]`.
- **Toolbar:** search, filter selects, `Button` secondary `en.a04.export` (CSV of the filtered rows, `users-YYYY-MM-DD.csv`).
- **Detail (`/users/[id]`):** two columns.
  - Left: `RiderPassWeb` in the user's current state (static, tilt on hover) with pass label and finish; under it the ID photo (if any) and ID check result card.
  - Right: details list (email, phone, roll, college, role, status, applied, approved by and when, strikes, reset requested) → **Actions** card with buttons depending on state:

| Button           | Shown when                           | Calls                                                                                                         |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Approve / Reject | `pending`                            | `approveRider` / `rejectRider` (ReasonDialog)                                                                 |
| Suspend          | `approved` and not owner             | `suspendRider` (ReasonDialog)                                                                                 |
| Reinstate        | `suspended`                          | `reinstateRider`                                                                                              |
| Reset strikes    | `strikes > 0`                        | `resetStrikes`                                                                                                |
| Reset password   | not owner, not demo account          | `resetPassword` → dialog shows `temp_password` once in mono with Copy and the note `en.a04.temp_note`         |
| Change role      | super admin viewer, target not owner | `setUserRole(id, role, collegeId?)` dialog with role select and college select (required for `college_admin`) |
| Force return     | the user has a bike                  | opens the A07 force-return dialog for `current_ride_id`                                                       |

- Below: **Rides** (Q6 filtered by `rider_id`, last 20, same columns as A07) and **Reports** (`from('admin_issues_v').select('*').eq('reporter_id', id).limit(20)`).
- **Owner and demo accounts:** owner shows chip `OWNER` and no actions except viewing; demo accounts show chip `DEMO` and only Force return.
- **Copy:** `title` "riders and _passes_." · `search` "Search name, email or roll number" · `export` "Export CSV" · `has_bike` "Has a bike" · `has_strikes` "Has strikes" · `reset_req` "Reset requested" · `temp_note` "Shown once. Give it to the rider in person or by phone; they change it in Profile." · `copy` "Copy" · `role_title` "Change role" · `role_college` "College for this admin".
- **Acceptance:** suspending a rider with a bike shows `CC_PASS_HAS_BIKE`; reset password produces a three-word password that signs in on the app; a college admin never sees users of another college (database test 030).

### A05 Scan (`/scan`)

Built for a phone browser. Three tabs (`Tabs`): Pass, Bike, Stand check.

- **Scanner:** `QrScanner` uses `qr-scanner` (`new QrScanner(video, onDecode, { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 })`), square video max 420 px, radius 22. A decode is ignored for 2 s after the previous one. Camera denied → `ErrorState` `CC_CAMERA_DENIED` plus a manual input (pass label or bike code).
- **Pass tab:** decode → must parse as `pass` (else toast `en.a05.not_pass`) → `scanPass(payload)` → result card: `RiderPassWeb` mini, holder name, roll, status, strikes, ID photo thumb; if `bike` is set: bike code (numericM), "since {time} from {from_stand}", due time, overdue chip; buttons: Open profile (→ A04), Force return (A07 dialog). Expired QR → `CC_PASS_QR_EXPIRED` copy.
- **Bike tab:** decode bike QR (or manual code via `normalizeCode`, then payload `campuscycle://b/<CODE>?s=` with empty sig; the RPC reports `signed: false`) → `scanBike` → card: code, status pill, stand or "on a pass", last seen, AI flag chip, notes; if a holder: name, pass label, since, due; buttons: Open bike (A08 sheet), Maintenance toggle, Force return.
- **Stand check tab:** pick a stand (`Select`, defaults to nearest by browser geolocation if allowed) → `Button` `en.a05.start` → continuous scanning; each bike decode adds the code to a chip list (dedupe, haptic `navigator.vibrate(30)`); `Button` primary `en.a05.finish` → `standCheckSubmit(standId, codes)` → result: three lists "Seen ({n})", "Missing ({n})" with last seen, "Unexpected ({n})" with recorded stand. Missing bikes get a button "Mark missing" (`markBikeMissing` with note "Not found in stand check at {stand}").
- **Copy:** `title` "scan _anything_." · `tab_pass` "Pass" · `tab_bike` "Bike" · `tab_check` "Stand check" · `not_pass` "That's a bike QR. Switch to the Bike tab." · `manual` "Or type a code" · `start` "Start stand check" · `finish` "Finish check" · `seen` "Seen" · `missing` "Missing" · `unexpected` "Unexpected" · `mark_missing` "Mark missing".
- **Acceptance:** scanning the demo rider's pass QR from the app shows Aanya Sharma and the bike on her pass; a stand check at the Library flags K-017 as missing on fresh demo data.

### A06 Live map (`/map`)

- **Data:** `getStands` equivalent for admins: `rpc('get_stands_with_counts', { p_college_id: c })` (no location); Q7 bikes; Q6 with `status = active`; Q9 kind `forecast` (latest). Query key `['map', c]`, refetch 30 s plus realtime.
- **Layout:** full-height map (`CampusMap`, `react-map-gl/maplibre`, style by theme as in 04 R09) with a right panel 340 px (bottom sheet on phone):
  - Layer toggles: Stands · Available bikes · Maintenance · Active rides.
  - **Stand markers:** `StandMarker` pill with free/capacity; colour by 06 §5.23 thresholds; over capacity → bad outline. Click → panel shows stand detail (counts, bikes list with status, link to A10).
  - **Bikes:** small dots (`BikeDot`) at their stand with jitter of up to 8 m so overlapping dots are visible (deterministic jitter from the bike id hash). Borrowed bikes are not on the map.
  - **Active rides:** panel list "K-004 · Aanya Sharma · from LHC · 12 min" (elapsed updates every 30 s; overdue rows in bad).
  - **Forecast:** a time slider (hours from now to 22:00 IST, step 1 h) in the panel; when moved off "Now", markers show `expected_free` for that hour from the forecast insight and the panel shows `en.a06.forecast_note`. No forecast → slider hidden.
- **Copy:** `title` "live _map_." · `layers` "Layers" · `l_stands` "Stands" · `l_available` "Available bikes" · `l_maint` "Maintenance" · `l_rides` "Active rides" · `now` "Now" · `forecast_note` "TORQ forecast for {hour}, from the last four weeks of rides." · `rides_title` "On the road ({n})" · `over_cap` "Over capacity".
- **Acceptance:** borrowing a bike in the app removes its dot and adds a row under "On the road" within 5 s.

### A07 Rides (`/rides`)

- **Data:** Q6 with filters: status (active / returned / force_returned), date range (default last 7 days, college time zone), stand (start or end), "Late only", "Photo flagged" (`photo_check in (unclear, failed)`), search bike code or rider name; `?ride=<id>` opens that ride's sheet.
- **Columns:** started (date time), rider + pass label, bike (mono), from → to, minutes, status pill, flags chips (`LATE`, `OVERDUE`, `FORCED`, photo check chip: `PHOTO OK` ok, `PHOTO UNCLEAR` warn, `PHOTO FAILED` bad, `PHOTO PENDING` subtle).
- **Sheet:** all fields, return photo (`PhotoThumb` large) with the TORQ photo check result and `photo_check_note`, start/end coordinates and accuracy, force note; buttons: Force return (active only), Open rider, Open bike, View trace (if a photo-check run exists: `from('ai_runs').select('id').eq('trigger','photo_check').ilike('input_summary', '%'+rideId+'%')`, see 07 §9.1 for the input summary format).
- **Force return dialog:** stand `Select` (default: the start stand), note (required, min 3), checkbox `en.a07.add_strike` → `forceReturn(rideId, standId, note, addStrike)`.
- **Export:** CSV of filtered rows (`rides-YYYY-MM-DD.csv`), columns: started_at, ended_at, minutes, rider_name, pass_label, bike_code, start_stand_name, end_stand_name, status, late, photo_check.
- **Copy:** `title` "every _ride_." · `late_only` "Late only" · `photo_flagged` "Photo flagged" · `force` "Force return" · `force_title` "Force return {bike}?" · `force_stand` "Put the bike at" · `force_note` "What happened (the rider sees this)" · `add_strike` "Add a strike to the rider" · `export` "Export CSV".
- **Acceptance:** force return ends the ride, frees the pass, puts the bike at the chosen stand, notifies the rider and writes an audit row.

### A08 Bikes (`/bikes`)

- **Data:** Q7 with filters: status, stand, "AI flagged" (`ai_flag not null`), search code.
- **Columns:** code (mono bold), status pill, stand or "On {pass_label}" with holder name, since (`borrowed_at`), last seen (relative + stand), notes (truncated), flag chip.
- **Toolbar:** `Button` primary `en.a08.add` → dialog: stand select, count (1–50), notes → `createBikes` → toast with the new codes and a button "Print labels" (→ A09 with `?ids=`). Bulk select → "Move to stand" (dialog with stand select → `moveBikes`), "Print labels".
- **Sheet:** code, status, holder (if borrowed: name, pass, since, due, link Force return), notes `Textarea` with Save (`updateBikeNotes`), maintenance `Switch` (`setBikeMaintenance(id, on, note)` with a note prompt; turning off a bike without a stand shows `CC_STAND_REQUIRED`), "Move to stand" select (`moveBike`), AI flag with "Clear flag" (`clearBikeFlag`), "Mark missing" (`markBikeMissing` with note and optional strike for the last rider), "Retire" (danger; confirm; `retireBike`), recent rides (Q6 by `bike_id`, 10) and issues (Q8 by `bike_id`, 10).
- **Copy:** `title` "the _fleet_." · `add` "Add bikes" · `add_count` "How many" · `add_stand` "Start at stand" · `added` "Added {codes}" · `print` "Print labels" · `move` "Move to stand" · `maintenance` "In maintenance" · `notes` "Notes" · `clear_flag` "Clear flag" · `missing` "Mark missing" · `retire` "Retire bike" · `retire_body` "Retired bikes disappear from the app and the map. This can't be undone from the app." · `ai_flagged` "AI flagged".
- **Acceptance:** adding 3 bikes at a stand creates `K-031..K-033` style codes using the college prefix; retiring a borrowed bike shows `CC_PASS_HAS_BIKE`.

### A09 QR labels (`/bikes/labels`)

- **Data:** `?ids=` (comma list) or a picker (all non-retired bikes, select all / by stand) → `bikeQrPayloads(ids)`.
- **Sheet:** A4 portrait, 3 × 7 grid of 63.5 × 38.1 mm labels (standard 21-up label sheet, `MAX_LABELS_PER_SHEET`), margins 15.1 mm top and bottom, 7.2 mm sides, 2.5 mm column gap. Each label: QR (`qrcode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 300 })`, 26 mm square) on the left; right: wordmark small, code in Archivo Expanded Black 20 pt, and "scan to borrow" in Martian Mono 7 pt. Colours always black on white (print), independent of theme.
- **Print CSS:** `@page { size: A4; margin: 0 }`, hide the app shell with `@media print`, `break-inside: avoid` per label.
- **Toolbar (screen only):** stand filter, select all, count, `Button` primary `en.a09.print` (`window.print()`).
- **Copy:** `title` "QR _labels_." · `lede` "Print on A4 sticker sheets (21 per page) and stick one on each bike's frame." · `print` "Print" · `pick` "Pick bikes" · `scan_to_borrow` "scan to borrow".
- **Acceptance:** a printed label scanned by the rider app opens Borrow for that bike (04 R11).

### A10 Stands (`/stands`)

- **Data:** `get_stands_with_counts(p_college_id)` plus inactive stands (`from('stands').select('*').eq('college_id', c)`).
- **Layout:** map on the left (60%), list on the right. List rows: name, free/capacity with over-capacity chip, radius, active switch (display only; edit in the form).
- **Add/edit:** `Button` primary `en.a10.add` puts the map in "place" mode (cursor crosshair, hint `en.a10.place_hint`); clicking the map drops a draggable marker and opens the form; editing an existing stand makes its marker draggable. Form: name (2–60), latitude and longitude (6 decimals, editable, synced with the marker), radius m (10–300, default college `default_geofence_m`; the map draws the radius circle as a GeoJSON polygon), capacity (1–200), active switch → `upsertStand` → toast.
- **Stand placement by the owner:** IITK's seeded stands come from OpenStreetMap coordinates; the owner drags each pin to the exact spot and saves (08 P2-T12).
- **Copy:** `title` "the _stands_." · `add` "Add stand" · `place_hint` "Click the map where the stand is." · `name` "Name" · `lat` "Latitude" · `lng` "Longitude" · `radius` "Geofence radius (m)" · `capacity` "Capacity" · `active` "Active" · `save` "Save stand" · `over` "Over capacity".
- **Acceptance:** a new stand appears in the rider app's list within 30 s; demo admins cannot save (`CC_DEMO_READONLY`).

### A11 Issues (`/issues`)

- **Data:** Q8 with filters status (default open + in progress), type, urgency ≥, "Assigned to me", search bike; groups from Q9 kind `issue_group`. `?id=` opens that issue.
- **Layout:** toggle Grouped | List (URL `view`).
  - **Grouped (default):** TORQ groups first, each a card: title, urgency badge (1–5, 5 = bad, 4 = warn, else subtle), summary, count, bike code; expands to its issues. Buttons: "Resolve all" (dialog with note → `updateIssue` for each with `p_status 'resolved'`), "Put bike in maintenance" (`setBikeMaintenance`), "Dismiss group" (`setInsightStatus(id, 'dismissed')`, issues stay). Ungrouped issues follow, sorted by urgency desc then created desc.
  - **List:** table: created, type chip (with "TORQ suggested" dot when `ai_suggested_type = type`), bike, stand, reporter, urgency, status, assignee, source chip (`APP`, `TORQ`, `ADMIN`).
- **Sheet:** photo, note, type, bike (with status and link), ride link, reporter, urgency, group; actions: "Assign to me" (`updateIssue(id, { p_assign_to_me: true, p_status: 'in_progress' })`), status select, "Bike to maintenance" switch (`p_bike_maintenance`), resolve with note (required). `ride_close_request` issues show a primary button "Close the ride" that opens the A07 force-return dialog for `ride_id`.
- **Copy:** `title` "what's _broken_." · `grouped` "Grouped" · `list` "List" · `urgency` "Urgency {n}" · `resolve_all` "Resolve all" · `dismiss_group` "Dismiss group" · `assign_me` "Assign to me" · `resolve` "Resolve" · `resolution` "Resolution note (the reporter sees this)" · `close_ride` "Close the ride" · `suggested` "TORQ suggested" · `empty` "Nothing broken. Nice."
- **Acceptance:** the seeded K-021 group shows 3 reports with urgency 5; resolving notifies each reporter.

### A12 College settings (`/settings`)

- **Data:** `from('colleges').select('*').eq('id', c).single()`.
- **Form (zod `CollegeSettingsSchema`):** name (2–120), max ride minutes (15–1440; helper shows hours), strike limit (1–10), default geofence (10–300 m), email domains (tag input, lowercase, `^[a-z0-9.-]+\.[a-z]{2,}$`), map centre lat/lng (with "Use map centre" from a small map), rules text (`Textarea`, max 8000, live counter, preview as the rider sees it). Save → `updateCollegeSettings`. Saving rules re-indexes TORQ knowledge automatically (database trigger, 07 §8.3); show `en.a12.rules_note`.
- **TORQ features card:** eight switches (rider assistant, return photo check, snap to report, ID card check, admin copilot, forecast, daily digest, issue grouping) → `updateAiSettings(c, { features })`.
- **Copy:** `title` "college _settings_." · `max_ride` "Max ride time (minutes)" · `strikes` "Strikes before a pass is paused" · `geofence` "Default stand radius (m)" · `domains` "College email domains" · `domains_hint` "Sign-ups with these domains get a match badge. Others can still apply." · `center` "Map centre" · `rules` "Ride rules" · `rules_note` "TORQ re-reads the rules a few seconds after you save." · `features` "TORQ features" · `f_rider_assistant` "Rider assistant" · `f_return_photo_check` "Return photo check" · `f_snap_to_report` "Snap to report" · `f_id_card_check` "ID card check at sign-up" · `f_admin_copilot` "Admin copilot" · `f_forecast` "Demand forecast and rebalancing" · `f_daily_digest` "Morning digest" · `f_issue_grouping` "Issue grouping" · `save` "Save settings".
- **Acceptance:** changing max ride time changes the due time of the next borrow; turning off Snap to report makes R16 skip the TORQ suggestion.

### A13 TORQ console (`/torq`)

- **Layout:** left column 260 px (desktop): `Button` `en.a13.new`, list of past console threads (Q13 with `surface = admin_console`). Main: message list, then the ask bar (`Textarea` auto-grow, mic `VoiceButton`, send). Empty thread: `Headline` l `en.a13.empty` and suggestion chips `en.a13.sugg` = ["How many rides yesterday?", "Who's waiting for approval?", "Which stands run out of bikes in the morning?", "Show rides per day this week as a chart", "Put K-021 into maintenance"].
- **Sending:** `fetch(FUNCTIONS_URL + '/torq-chat', { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_id, message, surface: 'admin_console', college_id: c, input_mode }) })` and `readSse` (03 §4.3).
- **Rendering an assistant message:** text (markdown subset: bold, lists, inline code; rendered with a tiny custom renderer, no HTML), then `TableBlock` when `table_data` is set (`{ columns: string[], rows: (string|number)[][] }`, max 50 rows, with "Copy CSV"), `ChartBlock` when `chart` is set (`{ type: 'bar'|'line', title, x: string[], series: [{ name, data: number[] }] }` → Recharts, height 240, colours `primary`, then the sticker blue, coral and mint from tokens (06 §2)), and `ActionCard`s for `action` events (07 §5.3): title, preview lines, Confirm / Cancel; after confirm shows the result pill and a link to the audit entry.
- **Step chips:** while running, `StepChips` show the step labels (07 §10.2), e.g. "Routing" → "Ops analyst · find_riders" → "Writing".
- **Voice:** `VoiceButton` uses `webkitSpeechRecognition || SpeechRecognition` (`lang` from a toggle EN/हिं → `en-IN`/`hi-IN`, `interimResults: true`); hidden when unsupported. Speaker button on assistant messages uses `speechSynthesis` with the same language rule as 04 R17.
- **Copy:** `title` "ask _torq_." · `new` "New chat" · `empty` "what do you want to _know_?" · `placeholder` "Ask about riders, bikes, rides or issues" · `footer` "TORQ only sees what you can see, and asks before it changes anything." · `confirm` "Confirm" · `cancel` "Cancel" · `copy_csv` "Copy CSV".
- **Acceptance:** "How many rides yesterday?" returns a number matching A02; "Put K-021 into maintenance" shows a confirm card and Confirm changes the bike status and writes an audit row with `via 'torq'` and `confirmed_by` set.

### A14 TORQ traces (`/torq/traces`, `/torq/traces/[runId]`)

- **List data:** Q10 with filters: agent, trigger, status, date range, "Demo only" (super admin); college admins see their college (RLS). Columns: started, agent chip, trigger, user (name), status pill (`done` ok, `failed` bad, `stopped_by_guardrail` warn, `over_budget` warn, `running` subtle), steps, tokens in/out, cost (`$0.0000`), duration, models (first). Row → detail page.
- **Detail:** header with the run summary (agent, trigger, status, input summary, output summary, prompt version, totals). `TraceTimeline`: one row per step (Q11) with step number, kind icon (context, model call, tool call, guardrail, router fallback), agent, name, model, tokens, cost, duration, ok/failed; expanding a row shows `input` and `output` as pretty JSON (`<pre>`, mono 12 px, max height 360 with scroll). Linked thread messages (Q14) and actions (Q15) below.
- **Copy:** `title` "torq _traces_." · `lede` "Every TORQ run, step by step." · `demo_only` "Demo only" · `steps` "Steps" · `cost` "Cost" · `models` "Models" · `input` "Input" · `output` "Output" · `empty` "No runs yet. Ask TORQ something."
- **Acceptance:** the seeded Hinglish flat-tyre run shows 3+ steps including the orchestrator route and `get_my_status`; a live console question appears here within seconds.

### A15 AI usage and settings (`/torq/usage`)

- **Data:** `aiUsageSummary(c)` (super admin may switch to "All colleges" → `null`), `from('ai_settings').select('*')`, latest `ai_evals` per job and model.
- **Layout:**
  1. Spend card: "$ {month_cost_usd} of $ {cap_usd} this month" with a bar; super admins also see `all_month_cost_usd`.
  2. Demo pool card: "{demo_pool_today} / {demo_pool_limit} demo steps today" with bar.
  3. Steps per day (last 14 days) bar chart and cost line.
  4. Per agent table: agent, runs, cost.
  5. Evals table: job, model, prompt version, score %, cases passed/total, safety (✓/✗), cost, run time. Source: `ai_evals` (07 §12).
  6. **Settings (super admin only):** monthly cap (0–5, step 0.5) → `updateAiSettings(null, { monthly_cap_usd })`; daily step limits per role and the demo pool (number inputs) → `p_daily_steps`; "Free models only" switch → `p_free_only`; model routes JSON editor (`Textarea` mono with zod validation against `ModelRoutesSchema` from 07 §6, "Reset to defaults" sets null) → `p_model_routes`. College admins see these values read-only.
- **Copy:** `title` "ai _usage_." · `spend` "${spent} of ${cap} this month" · `demo_pool` "{used} / {limit} demo steps today" · `per_agent` "By agent" · `evals` "Eval scores" · `settings` "Limits and models" · `cap` "Monthly cap (US$)" · `free_only` "Free models only" · `routes` "Model routes" · `reset_routes` "Reset to defaults" · `read_only` "Only super admins can change these."
- **Acceptance:** cap above 5 shows `CC_CAP_TOO_HIGH`; a demo console question raises the demo pool counter.

### A16 Colleges (`/colleges`, super admin only)

- **Guard:** non-super admins get `notFound()`.
- **Data:** `collegesOverview()`.
- **Table:** name, short code, active switch (`setCollegeActive`), stands, bikes, riders, pending, admins, rides 7 d. Row click → switches the college scope to it and goes to `/dashboard`.
- **Add college dialog:** name, short code (2–6 uppercase), bike prefix (1–3 uppercase), email domains, time zone (`Select` of `Intl.supportedValuesOf('timeZone')`, default `Asia/Kolkata`), centre lat/lng (pick on a small map) → `createCollege` → toast and switch scope to the new college with a checklist card on its dashboard: "Add stands (A10) · Add bikes (A08) · Print labels (A09) · Appoint an admin (A04 → Change role)".
- **Appoint admin:** a button per row opens a search over all users by email (Q5 without college filter, super admin RLS allows it) → `setUserRole(userId, 'college_admin', collegeId)`.
- **Copy:** `title` "all _colleges_." · `add` "Add college" · `short_code` "Short code (shown on passes)" · `prefix` "Bike code prefix" · `tz` "Time zone" · `appoint` "Appoint admin" · `next_steps` "Next: add stands, add bikes, print labels and appoint an admin."
- **Acceptance:** creating a college with a new short code makes it selectable in the rider sign-up list (04 R04) immediately; duplicate codes show `CC_DUPLICATE`.

### A17 Audit log (`/audit`)

- **Data:** Q12 with `.eq('college_id', c)` (super admin may choose "All"), filters: action prefix (`rider.`, `user.`, `ride.`, `bike.`, `stand.`, `pass.`, `issue.`, `college.`, `ai.`, `account.`), via (`app`, `admin`, `torq`, `system`, `cron`), actor search, date range; 50 per page.
- **Columns:** time, actor (name or "System"), via chip (`TORQ` primary chip), action (mono), target (type + short id or human label from `details.label` when present), confirmed by (TORQ actions), details (expand to JSON).
- **Copy:** `title` "audit _log_." · `via` "Via" · `actor` "Who" · `action` "What" · `target` "On" · `confirmed_by` "Confirmed by" · `system` "System" · `export` "Export CSV".
- **Acceptance:** every admin action and every confirmed TORQ action produces exactly one row with the right actor.

### A18 My account (`/account`)

- **Layout:** profile card (name, email, role, college, `OWNER`/`DEMO` chips) → theme `Segmented` System / Dark / Day → change password (new + confirm; `auth.updateUser({ password })`; hidden for demo) → `Button` ghost `en.a18.sign_out`.
- **Copy:** `title` "your _account_." · `theme` "Theme" · `change_pw` "Change password" · `new_pw` "New password" · `confirm_pw` "Confirm password" · `saved` "Password changed." · `sign_out` "Sign out".
- **Acceptance:** theme persists across devices (stored in `profiles.theme`).

## 4. Public pages

### `/try`

The share page for anyone without an account (recruiters).

- **Layout:** hero (`Headline` xl `en.try.title`, lede) → three cards:
  1. **Ride it** · "Open the rider app" → `NEXT_PUBLIC_RIDER_WEB_URL` with the note "Tap Try the demo rider. Location checks are off in the demo." · "Download for Android" → `https://github.com/sakshamm21/CampusCycle/releases/latest`.
  2. **Run it** · buttons "Demo college admin" and "Demo super admin" (same one-click sign-in as A01).
  3. **Scan it** · grid of sample bike QRs from `rpc('demo_qr_samples')` (anon), 6 shown with "Show all"; each tile: QR (`qrcode` 160 px), code, stand. Note `en.try.scan_note`.
- Footer: "Demo data resets every night at 4:00 AM IST." and links Privacy, GitHub repo.
- **Copy:** `title` "try _campuscycle_." · `lede` "A free bike pool for any campus, with an AI ops team built in. Everything here is a live demo." · `ride` "Ride it" · `run` "Run it" · `scan` "Scan it" · `scan_note` "Open the rider app on your phone, tap Borrow and scan one of these from your screen." · `reset` "Demo data resets every night at 4:00 AM IST."
- **Acceptance:** works signed out; QR tiles scan into R12 for the demo rider.

### `/privacy`

Static page rendered from `docs/privacy.md` (written in Phase 6, 08 P6) with headings: What we collect (account details, roll number, optional ID photo, location only at borrow/return, ride history, photos, TORQ chats, push token); Why; Who sees it (your college's admins; super admins; AI providers only for TORQ features, with no training/retention for photos); How long (return photos 30 days after the ride, TORQ chat photos 30 days, issue photos 30 days after the issue is resolved, the ID photo until you delete your account, rides kept for college records with your name removed after deletion); Your choices (theme, notifications, clear TORQ memory, delete account); Contact (owner email placeholder `privacy@` replaced by the repo owner's contact in Phase 6). Retention numbers must match the cleanup job (03 §4.10).

### `/delete-account`

Store-required page. Text: how to delete in the app (Profile → Delete account) and, for people without the app, "Email the owner from your account's address and we delete it within 7 days" with the contact from `/privacy`. No form.

## 5. Acceptance for the whole site (Phase 2 exit)

1. Playwright suite in 09 §4 passes against the dev Supabase project.
2. Every page works at 1440 px and at 390 px width (A03, A05, A06 are fully usable on a phone).
3. Lighthouse accessibility ≥ 95 on A01, A02 and `/try`.
4. No page shows another college's data to a college admin (checked by database test 030 and Playwright test `scope.spec.ts`).
5. Deployed at `campuscycle.vercel.app` from `main` with the environment variables in 01 §7.
