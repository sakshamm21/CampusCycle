# 03 · API, client wrappers and Edge Functions

There is no separate API server. Both apps call Supabase directly:

1. **Reads** go through PostgREST with row-level security (tables and the `admin_*_v` views).
2. **Every write** goes through a database function (RPC) defined in `02-database.md` and `02b-database-ai-demo.md`. The only direct table write a client makes is updating its own `profiles` columns `phone`, `push_token`, `notif_prefs`, `theme`.
3. **Work that needs the service key or an AI model** goes through the Edge Functions in §4.

Apps never call `supabase.rpc` or `supabase.from` directly from screens. They call the typed wrappers in `packages/shared/src/api/` (§3), which return typed data or throw an `AppError`.

## 1. Calling conventions

- Rider RPCs (`borrow_bike`, `preview_bike`, `check_return_location`, `return_bike`, `attach_return_photo`, `report_issue`, `request_ride_close`, `get_my_pass_qr`, `request_password_reset`, `admin_scan_pass`, `admin_scan_bike`) **return** `{ ok: true, ... }` or `{ ok: false, code, data }`. The wrapper throws `new AppError(code, data)` when `ok` is false.
- All other RPCs **raise** on failure. supabase-js returns `error.message = 'CC_...'` and `error.hint = '<json>'`. The wrapper throws `new AppError(error.message, JSON.parse(error.hint ?? '{}'))`.
- Every wrapper first checks `error` from supabase-js, converts through `toAppError()` and rethrows.
- Admin RPCs called from the admin web app always pass `p_source: 'admin'` (or rely on the default). TORQ passes `p_source: 'torq'` and `p_ai_action_id`.

## 2. Error codes and copy

`packages/shared/src/errors.ts` exports:

```ts
export type ErrorCode = keyof typeof en.errors;
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public data: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
export function toAppError(e: unknown): AppError; // §2.2
export function messageFor(code: string, data?: Record<string, unknown>): string; // falls back to CC_UNKNOWN
```

### 2.1 The table (copy goes into `en.errors`, verbatim)

`{x}` placeholders are filled from `data`. `{distance}` is `formatDistance(data.distance_m)`.

| Code                        | Raised by                               | Copy                                                                                               |
| --------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `CC_NOT_SIGNED_IN`          | many                                    | Please sign in again.                                                                              |
| `CC_NOT_APPROVED`           | borrow, report, pass QR, suspend        | Your pass isn't active yet. Your college admin needs to approve you first.                         |
| `CC_PASS_SUSPENDED`         | borrow                                  | Your pass is suspended. Contact your college admin.                                                |
| `CC_RATE_LIMITED`           | borrow, return, report, scans           | Too many tries. Wait a few minutes and try again.                                                  |
| `CC_BAD_CODE`               | borrow, return, scan                    | That code doesn't look right. Bike codes look like K-042.                                          |
| `CC_BAD_QR`                 | borrow, return, scans                   | This QR isn't a CampusCycle code. Type the code printed under it instead.                          |
| `CC_BIKE_NOT_FOUND`         | borrow, report, admin                   | We couldn't find bike {code} at your college.                                                      |
| `CC_PASS_HAS_BIKE`          | borrow, suspend, retire, delete account | {bike} is already on this pass. Return it first.                                                   |
| `CC_BIKE_IN_MAINTENANCE`    | borrow                                  | {code} is under maintenance. Pick another bike.                                                    |
| `CC_BIKE_NOT_AVAILABLE`     | borrow, move                            | {code} isn't available right now. Pick another bike.                                               |
| `CC_BIKE_NOT_AT_THIS_STAND` | borrow                                  | Our records put {code} at {bike_stand}, not {here}. Pick a bike parked here, or report it.         |
| `CC_MOCK_LOCATION`          | borrow, return                          | Your phone is using a fake location. Turn it off to borrow or return.                              |
| `CC_NO_LOCATION`            | borrow, return                          | We need your location to check you're at a stand.                                                  |
| `CC_POOR_ACCURACY`          | borrow, return                          | Your GPS is too rough right now ({accuracy_m} m). Step into open sky and try again.                |
| `CC_NOT_AT_STAND`           | borrow, return                          | You're not inside a stand. Nearest is {nearest_stand}, {distance} away.                            |
| `CC_NO_BIKE_ON_PASS`        | return, ride close                      | There's no bike on your pass.                                                                      |
| `CC_WRONG_BIKE`             | return                                  | That's {scanned}. Your pass holds {pass_bike}, so scan that bike.                                  |
| `CC_BAD_PHOTO_PATH`         | photo RPCs                              | The photo didn't upload properly. Take it again.                                                   |
| `CC_RIDE_NOT_FOUND`         | report, admin                           | We couldn't find that ride.                                                                        |
| `CC_RIDE_NOT_ACTIVE`        | force return                            | That ride has already ended.                                                                       |
| `CC_INVALID_INPUT`          | forms                                   | Some details are missing or too short.                                                             |
| `CC_COLLEGE_NOT_FOUND`      | sign-up edit, approve                   | That college isn't available.                                                                      |
| `CC_NOT_EDITABLE`           | application edit                        | Your details can't be changed now. Ask your college admin.                                         |
| `CC_FORBIDDEN`              | admin                                   | You don't have access to this.                                                                     |
| `CC_STAND_NOT_FOUND`        | admin                                   | That stand doesn't exist.                                                                          |
| `CC_USER_NOT_FOUND`         | admin                                   | That person doesn't exist.                                                                         |
| `CC_NOT_PENDING`            | approve, reject                         | This application was already handled.                                                              |
| `CC_REASON_REQUIRED`        | reject, suspend, force return, resolve  | Add a short reason (at least 3 characters).                                                        |
| `CC_TOO_MANY`               | bulk actions                            | Too many at once. Select fewer and try again.                                                      |
| `CC_OWNER_PROTECTED`        | users                                   | The owner account can't be changed.                                                                |
| `CC_DEMO_PROTECTED`         | users, password                         | Demo logins are protected so they always work.                                                     |
| `CC_DEMO_FORBIDDEN`         | admin (demo caller)                     | Demo accounts can only change demo data.                                                           |
| `CC_DEMO_READONLY`          | settings, stands, colleges, roles       | This is read-only in the demo.                                                                     |
| `CC_NOT_SUSPENDED`          | reinstate                               | This rider isn't suspended.                                                                        |
| `CC_COLLEGE_REQUIRED`       | set role                                | Pick a college for this admin.                                                                     |
| `CC_STAND_REQUIRED`         | maintenance off                         | Move the bike to a stand first.                                                                    |
| `CC_ISSUE_NOT_FOUND`        | issues                                  | That report doesn't exist.                                                                         |
| `CC_NOT_FOUND`              | insights                                | Not found.                                                                                         |
| `CC_PASS_QR_EXPIRED`        | pass scan                               | This pass QR has expired. Ask the rider to show it again.                                          |
| `CC_DUPLICATE`              | create college                          | That short code or bike prefix is already used.                                                    |
| `CC_CAP_TOO_HIGH`           | AI settings                             | The monthly cap can't be more than US$5.                                                           |
| `CC_INTEGRITY_BIKE_PASS`    | constraint trigger                      | Something went wrong and nothing was changed. Try again.                                           |
| `CC_NETWORK`                | client                                  | You're offline. Check your connection and try again.                                               |
| `CC_UNKNOWN`                | client                                  | Something went wrong. Try again.                                                                   |
| `CC_AUTH_INVALID`           | sign in                                 | Wrong email or password.                                                                           |
| `CC_EMAIL_TAKEN`            | sign up                                 | An account with this email already exists. Sign in instead.                                        |
| `CC_WEAK_PASSWORD`          | sign up, change password                | Use at least 8 characters.                                                                         |
| `CC_NOT_ADMIN`              | admin sign in                           | This site is for college admins. Riders use the CampusCycle app.                                   |
| `CC_CAMERA_DENIED`          | scanner, photo                          | Camera access is off. Turn it on in Settings, or type the code.                                    |
| `CC_LOCATION_DENIED`        | borrow, return                          | Location access is off. Turn it on in Settings to borrow or return.                                |
| `CC_LOCATION_TIMEOUT`       | borrow, return                          | We couldn't get your location. Step outside and try again.                                         |
| `CC_UPLOAD_FAILED`          | photos                                  | The photo will upload when you're back online.                                                     |
| `CC_AI_UNAVAILABLE`         | TORQ                                    | TORQ isn't available right now. Everything else still works.                                       |
| `CC_AI_DAILY_LIMIT`         | TORQ                                    | You've used today's TORQ steps. Come back tomorrow.                                                |
| `CC_AI_DEMO_POOL_EMPTY`     | TORQ                                    | The demo's TORQ pool is used up for today. It refills at 4:00 AM IST. Everything else still works. |
| `CC_AI_GUARDRAIL`           | TORQ                                    | TORQ can't help with that.                                                                         |
| `CC_AI_MESSAGE_TOO_LONG`    | TORQ                                    | Keep it under 2,000 characters.                                                                    |
| `CC_AI_FEATURE_OFF`         | TORQ                                    | Your college has switched this TORQ feature off.                                                   |
| `CC_ACTION_EXPIRED`         | TORQ confirm                            | This confirm card expired. Ask TORQ again.                                                         |
| `CC_ACTION_NOT_FOUND`       | TORQ confirm                            | This action is no longer available.                                                                |

### 2.2 `toAppError(e)` rules (in order)

1. `e instanceof AppError` → return it.
2. Object with `message` matching `/^CC_[A-Z0-9_]+$/` → `new AppError(message, safeJson(hint))`.
3. supabase-js `AuthError`: message contains `Invalid login credentials` → `CC_AUTH_INVALID`; `already registered` → `CC_EMAIL_TAKEN`; `Password should be` or `weak` → `CC_WEAK_PASSWORD`; message contains `CC_DEMO_PROTECTED` or status 500 for a demo user's password change → `CC_DEMO_PROTECTED`.
4. `TypeError` with `Network request failed` or `Failed to fetch`, or NetInfo offline → `CC_NETWORK`.
5. Anything else → `CC_UNKNOWN` (and `console.error(e)`).

## 3. Client wrappers (`packages/shared/src/api/`)

### 3.1 `client.ts`

```ts
export type CampusClient = SupabaseClient<Database>;
export function createCampusClient(url: string, anonKey: string, storage?: SupportedStorage): CampusClient;
// auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage }
```

- Mobile passes a storage adapter: `expo-secure-store` for the refresh token on native (chunk values over 2048 bytes into `key.0..n`), `localStorage` on web.
- Admin uses `@supabase/ssr` (`createBrowserClient` in client components, `createServerClient` with Next cookies in server components and `middleware.ts`).

### 3.2 Hand-written types (`types.ts`)

```ts
export type Role = 'rider' | 'college_admin' | 'super_admin';
export type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type PassStatus = 'pending' | 'ready' | 'riding' | 'overdue' | 'suspended';
export type Finish = 'graphite' | 'chrome' | 'holo';
export type IssueType =
  | 'flat_tyre'
  | 'brakes'
  | 'chain'
  | 'damaged_qr'
  | 'bike_missing'
  | 'accident'
  | 'ride_close_request'
  | 'other';

export interface MyContext {
  // get_my_context()
  profile: {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    roll_number: string;
    role: Role;
    status: ProfileStatus;
    strikes: number;
    is_demo: boolean;
    demo_role: Role | null;
    is_owner: boolean;
    theme: 'system' | 'dark' | 'day';
    notif_prefs: { approval: boolean; reminders: boolean; issues: boolean };
    applied_at: string;
    approved_at: string | null;
    rejection_reason: string | null;
    suspended_reason: string | null;
    id_photo_path: string | null;
    id_check_consent: boolean;
    email_domain_match: boolean;
    college_id: string | null;
  };
  college: {
    id: string;
    name: string;
    short_code: string;
    time_zone: string;
    max_ride_minutes: number;
    strike_limit: number;
    default_geofence_m: number;
    rules_text: string;
    center_lat: number | null;
    center_lng: number | null;
  } | null;
  pass: {
    id: string;
    status: PassStatus;
    pass_number: number | null;
    label: string | null;
    total_rides: number;
    total_minutes: number;
    finish: Finish;
    issued_at: string | null;
    minted_seen_at: string | null;
    borrowed_at: string | null;
  };
  ride: {
    id: string;
    bike_code: string;
    bike_id: string;
    start_stand_id: string;
    start_stand_name: string;
    started_at: string;
    due_at: string;
    is_overdue: boolean;
  } | null;
}
export interface StandWithCounts {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  capacity: number;
  active: boolean;
  free_bikes: number;
  maintenance_bikes: number;
  total_bikes: number;
  distance_m: number | null;
}
export interface GeoFix {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  isMock: boolean;
}
export interface BorrowPreview {
  bike: { id: string; code: string; last_seen_at: string | null; notes: string };
  stand: { id: string; name: string };
  max_ride_minutes: number;
  due_at: string;
  manual: boolean;
}
export interface BorrowResult {
  ride_id: string;
  bike_code: string;
  stand_id: string;
  stand_name: string;
  started_at: string;
  due_at: string;
}
export interface ReturnCheck {
  stand_id: string;
  stand_name: string;
  distance_m?: number;
  demo?: boolean;
  stand_full: boolean;
  bike_code: string;
}
export interface ReturnResult {
  ride_id: string;
  bike_code: string;
  start_stand_name: string;
  end_stand_name: string;
  started_at: string;
  ended_at: string;
  minutes: number;
  late: boolean;
  stand_full: boolean;
  strikes: number | null;
  suspended: boolean;
  total_rides: number;
  finish_before: Finish;
  finish_after: Finish;
  photo_pending: boolean;
}
export interface PassStats {
  rides: number;
  minutes: number;
  fave_stand: string | null;
  strikes: number;
  finish: Finish;
  next_finish: Finish | null;
  rides_to_next: number;
}
export interface IdCheckResult {
  match: 'yes' | 'no' | 'unsure';
  name_ok: boolean;
  roll_ok: boolean;
  college_ok: boolean;
  notes: string;
  model: string;
  checked_at: string;
}
export interface ScanPassResult {
  holder: {
    user_id: string;
    name: string;
    roll_number: string;
    status: ProfileStatus;
    strikes: number;
    id_photo_path: string | null;
    pass_label: string;
    pass_status: PassStatus;
  };
  bike: {
    code: string;
    since: string;
    from_stand: string | null;
    ride_id: string;
    due_at: string;
    is_overdue: boolean;
  } | null;
}
export interface ScanBikeResult {
  signed: boolean;
  bike: {
    id: string;
    code: string;
    status: string;
    stand_id: string | null;
    stand_name: string | null;
    last_seen_at: string | null;
    ai_flag: string | null;
    notes: string;
  };
  holder: {
    user_id: string;
    name: string;
    pass_label: string;
    since: string;
    ride_id: string;
    from_stand: string | null;
    due_at: string;
    is_overdue: boolean;
  } | null;
}
export interface StandCheckResult {
  stand: string;
  seen: string[];
  missing: { code: string; last_seen_at: string | null }[];
  unexpected: { code: string; status: string; recorded_stand: string | null }[];
}
```

### 3.3 Rider wrappers (`api/rider.ts`)

Each takes `db: CampusClient` as first argument.

| Wrapper                                                   | Calls                                                                                                                                          | Returns                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `getMyContext(db)`                                        | `rpc('get_my_context')`                                                                                                                        | `MyContext \| null`                                         |
| `listColleges(db)`                                        | `rpc('list_colleges_public')`                                                                                                                  | `{ id, name, short_code, email_domains }[]`                 |
| `signUp(db, input: SignUpInput)`                          | `auth.signUp({ email, password, options: { data: { full_name, phone, roll_number, college_id, id_check_consent, rules_accepted: 'true' } } })` | session                                                     |
| `signIn(db, email, password)`                             | `auth.signInWithPassword`                                                                                                                      | session                                                     |
| `signOut(db)`                                             | clears `push_token` (update own profile) then `auth.signOut()`                                                                                 | void                                                        |
| `requestPasswordReset(db, email)`                         | `rpc('request_password_reset', { p_email })`                                                                                                   | void (always ok)                                            |
| `updateApplication(db, i)`                                | `rpc('update_application', { p_full_name, p_phone, p_roll_number, p_college_id })`                                                             | void                                                        |
| `setIdPhoto(db, path, consent)`                           | `rpc('set_id_photo', { p_path, p_consent })`                                                                                                   | void                                                        |
| `getStands(db, fix?)`                                     | `rpc('get_stands_with_counts', { p_lat, p_lng })`                                                                                              | `StandWithCounts[]` (sorted by distance, then name)         |
| `getStandDetail(db, id)`                                  | `rpc('get_stand_detail', { p_stand_id })`                                                                                                      | `{ ...stand, bikes: { id, code, status, last_seen_at }[] }` |
| `listPickableBikes(db)`                                   | `rpc('list_pickable_bikes')` (demo only)                                                                                                       | `{ bike_id, code, stand_id, stand_name, payload }[]`        |
| `previewBike(db, code, sig, fix, demoStandId?)`           | `rpc('preview_bike', {...})`                                                                                                                   | `BorrowPreview`                                             |
| `borrowBike(db, code, sig, fix, demoStandId?)`            | `rpc('borrow_bike', {...})`                                                                                                                    | `BorrowResult`                                              |
| `checkReturnLocation(db, fix, demoStandId?)`              | `rpc('check_return_location', {...})`                                                                                                          | `ReturnCheck`                                               |
| `returnBike(db, code, sig, fix, photoPath, demoStandId?)` | `rpc('return_bike', {...})`                                                                                                                    | `ReturnResult`                                              |
| `attachReturnPhoto(db, rideId, path)`                     | `rpc('attach_return_photo', {...})`                                                                                                            | void                                                        |
| `getMyPassQr(db)`                                         | `rpc('get_my_pass_qr')`                                                                                                                        | `{ payload, window, expires_at }`                           |
| `markPassMintedSeen(db)`                                  | `rpc('mark_pass_minted_seen')`                                                                                                                 | void                                                        |
| `getPassStats(db)`                                        | `rpc('get_pass_stats')`                                                                                                                        | `PassStats`                                                 |
| `reportIssue(db, i)`                                      | `rpc('report_issue', { p_type, p_note, p_bike_code, p_ride_id, p_stand_id, p_photo_path, p_ai_suggested_type })`                               | `{ issue_id }`                                              |
| `requestRideClose(db, note)`                              | `rpc('request_ride_close', { p_note })`                                                                                                        | `{ issue_id }`                                              |
| `listMyRides(db, page)`                                   | §3.6 Q1                                                                                                                                        | rides                                                       |
| `getRide(db, id)`                                         | §3.6 Q2                                                                                                                                        | one ride                                                    |
| `listMyReports(db)`                                       | §3.6 Q3                                                                                                                                        | reports                                                     |
| `listNotifications(db)`                                   | §3.6 Q4                                                                                                                                        | notifications                                               |
| `markNotificationsRead(db, ids?)`                         | `rpc('mark_notifications_read', { p_ids })`                                                                                                    | void                                                        |
| `updateMyProfile(db, patch)`                              | `from('profiles').update(patch).eq('id', uid)` where patch ⊆ `{ phone, push_token, notif_prefs, theme }`                                       | void                                                        |
| `changePassword(db, pw)`                                  | `auth.updateUser({ password })`                                                                                                                | void                                                        |
| `clearMyAiMemory(db)`                                     | `rpc('clear_my_ai_memory')`                                                                                                                    | `{ deleted }`                                               |
| `deleteMyAccount(db)`                                     | Edge Function `delete-account` (§4.12)                                                                                                         | void                                                        |

`fix` is a `GeoFix`. Demo accounts send `fix = { lat: null, lng: null, accuracy: null, isMock: false }`; the wrapper maps it to `p_lat`, `p_lng`, `p_accuracy`, `p_is_mock`.

### 3.4 Admin wrappers (`api/admin.ts`)

| Wrapper                                                                                        | Calls                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `dashboardStats(db, collegeId)`                                                                | `rpc('dashboard_stats')`                                                        |
| `ridesPerDay(db, collegeId, days = 30)`                                                        | `rpc('rides_per_day')`                                                          |
| `approveRider(db, userId)` / `approveRiders(db, ids)`                                          | `rpc('approve_rider')` / `rpc('approve_riders')`                                |
| `rejectRider(db, userId, reason)`                                                              | `rpc('reject_rider')`                                                           |
| `suspendRider(db, userId, reason)` / `reinstateRider(db, userId)` / `resetStrikes(db, userId)` | matching RPCs                                                                   |
| `setUserRole(db, userId, role, collegeId?)`                                                    | `rpc('set_user_role')` (super admin UI only)                                    |
| `resetPassword(db, userId)`                                                                    | Edge Function `admin-reset-password` (§4.13) → `{ temp_password }`              |
| `forceReturn(db, rideId, standId, note, addStrike)`                                            | `rpc('force_return')`                                                           |
| `markBikeMissing(db, bikeId, note, addStrike)`                                                 | `rpc('mark_bike_missing')`                                                      |
| `setBikeMaintenance(db, bikeId, on, note)`                                                     | `rpc('set_bike_maintenance')` → `{ result }`                                    |
| `moveBike(db, bikeId, standId)` / `moveBikes(db, moves)`                                       | `rpc('move_bike')` / `rpc('move_bikes')`                                        |
| `createBikes(db, collegeId, standId, count, notes)`                                            | `rpc('create_bikes')` → `{ codes }`                                             |
| `updateBikeNotes`, `retireBike`, `clearBikeFlag`                                               | matching RPCs                                                                   |
| `bikeQrPayloads(db, bikeIds)`                                                                  | `rpc('admin_bike_qr_payloads')`                                                 |
| `upsertStand(db, s)`                                                                           | `rpc('upsert_stand')` → `{ id }`                                                |
| `scanPass(db, payload)` / `scanBike(db, payload)`                                              | `rpc('admin_scan_pass')` / `rpc('admin_scan_bike')`                             |
| `standCheckSubmit(db, standId, codes)`                                                         | `rpc('stand_check_submit')`                                                     |
| `updateIssue(db, issueId, patch)`                                                              | `rpc('update_issue', { p_status, p_note, p_assign_to_me, p_bike_maintenance })` |
| `updateCollegeSettings(db, s)`                                                                 | `rpc('update_college_settings')`                                                |
| `createCollege(db, c)` / `setCollegeActive(db, id, active)`                                    | matching RPCs                                                                   |
| `collegesOverview(db)`                                                                         | `rpc('colleges_overview')` (02b §19)                                            |
| `aiUsageSummary(db, collegeId \| null)`                                                        | `rpc('ai_usage_summary')`                                                       |
| `updateAiSettings(db, collegeId \| null, patch)`                                               | `rpc('update_ai_settings')`                                                     |
| `setInsightStatus(db, id, status)`                                                             | `rpc('set_insight_status')`                                                     |
| `signedPhotoUrl(db, bucket, path)`                                                             | `storage.from(bucket).createSignedUrl(path, 600)`                               |

### 3.5 Storage helpers (`api/storage.ts`)

```ts
export async function uploadPhoto(
  db,
  bucket: 'id-cards' | 'return-photos' | 'issue-photos' | 'torq-photos',
  userId: string,
  body: Blob | ArrayBuffer,
  contentType = 'image/jpeg',
): Promise<string>;
```

Path: `${userId}/${crypto.randomUUID()}.jpg` (`.png` for PNG). Uploads with `upsert: false`. Returns the path **without** the bucket. Mobile converts a local file URI to an `ArrayBuffer` with `await (await fetch(uri)).arrayBuffer()` before calling. Photos are compressed first (04 §1.7).

### 3.6 Direct reads (named queries)

| Id               | Query                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 my rides      | `from('rides').select('id, started_at, ended_at, status, late, flags, bike:bikes(short_code), start:stands!rides_start_stand_id_fkey(name), end:stands!rides_end_stand_id_fkey(name)').eq('rider_id', uid).neq('status','active').order('started_at', { ascending: false }).range(p*20, p*20+19)` |
| Q2 one ride      | same select plus `photo_check, return_photo_path, force_note` with `.eq('id', id).single()`                                                                                                                                                                                                       |
| Q3 my reports    | `from('issue_reports').select('id, type, note, status, created_at, resolution_note, bike:bikes(short_code)').eq('reporter_id', uid).order('created_at', { ascending: false }).limit(50)`                                                                                                          |
| Q4 notifications | `from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100)`                                                                                                                                                                                       |
| Q5 admin users   | `from('admin_users_v').select('*').eq('college_id', c)` + filters (05 A04)                                                                                                                                                                                                                        |
| Q6 admin rides   | `from('admin_rides_v').select('*').eq('college_id', c)` + filters (05 A07)                                                                                                                                                                                                                        |
| Q7 admin bikes   | `from('admin_bikes_v').select('*').eq('college_id', c)` (05 A08)                                                                                                                                                                                                                                  |
| Q8 admin issues  | `from('admin_issues_v').select('*').eq('college_id', c)` (05 A11)                                                                                                                                                                                                                                 |
| Q9 insights      | `from('ai_insights').select('*').eq('college_id', c).eq('status','active').in('kind', [...]).order('created_at', { ascending: false })`                                                                                                                                                           |
| Q10 runs         | `from('ai_runs').select('*').order('started_at', { ascending: false })` + filters (05 A14)                                                                                                                                                                                                        |
| Q11 steps        | `from('ai_steps').select('*').eq('run_id', id).order('step_no')`                                                                                                                                                                                                                                  |
| Q12 audit        | `from('audit_log').select('*, actor:profiles!audit_log_actor_id_fkey(full_name, email), confirmer:profiles!audit_log_confirmed_by_fkey(full_name)').order('created_at', { ascending: false })`                                                                                                    |
| Q13 threads      | `from('ai_threads').select('id, title, updated_at, surface').eq('user_id', uid).order('updated_at', { ascending: false }).limit(30)`                                                                                                                                                              |
| Q14 messages     | `from('ai_messages').select('*').eq('thread_id', id).order('created_at')`                                                                                                                                                                                                                         |
| Q15 actions      | `from('ai_actions').select('*').in('id', ids)`                                                                                                                                                                                                                                                    |

The PostgREST foreign-key names above are Postgres defaults (`<table>_<column>_fkey`); `pnpm db:types` confirms them.

### 3.7 Realtime channels

| Channel name    | Subscription                                                                                                                                                           | Used by                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `me:<uid>`      | `postgres_changes` UPDATE on `profiles` filter `id=eq.<uid>`; UPDATE on `rider_passes` filter `rider_id=eq.<uid>`; INSERT on `notifications` filter `user_id=eq.<uid>` | mobile root (refetch `getMyContext`, show in-app toast for notifications) |
| `actions:<uid>` | UPDATE on `ai_actions` filter `user_id=eq.<uid>`                                                                                                                       | TORQ chat/console (card status)                                           |
| `college:<id>`  | `*` on `bikes`, `rides`, `issue_reports` filter `college_id=eq.<id>`; INSERT on `notifications` filter `user_id=eq.<uid>`                                              | admin layout (invalidate queries, toast on `admin_alert`)                 |

Every change only invalidates TanStack Query keys; screens refetch. Channels are removed on sign-out.

## 4. Edge Functions (`supabase/functions/`)

### 4.1 Inventory

| Function               | `verify_jwt`            | Caller                            | Purpose                                           |
| ---------------------- | ----------------------- | --------------------------------- | ------------------------------------------------- |
| `torq-chat`            | true                    | rider app, admin console          | run TORQ on a message, stream steps (SSE)         |
| `torq-action`          | true                    | rider app, admin console          | confirm or cancel a proposed action               |
| `torq-suggest`         | true                    | rider app (Report issue)          | Inspector suggests issue type + note from a photo |
| `torq-worker`          | false (internal secret) | DB triggers, sweep                | `photo_check`, `id_check`, `issue_triage` jobs    |
| `torq-cron`            | false (internal secret) | pg_cron 06:00 IST                 | morning digest, forecast, rebalancing             |
| `torq-knowledge`       | false (internal secret) | DB trigger, `embed-help.mjs`      | re-embed rules/help text                          |
| `push-send`            | false (internal secret) | notifications trigger             | send one Expo push                                |
| `cleanup-photos`       | false (internal secret) | pg_cron 03:30 IST                 | delete return photos older than 30 days           |
| `delete-account`       | true                    | rider app, `/delete-account` page | delete the caller's account                       |
| `admin-reset-password` | true                    | admin web (A04)                   | set a temporary password for a rider              |

`scripts/deploy-functions.mjs --target dev|prod` loads the target's env file (01 §3.4) and runs `pnpm exec supabase functions deploy <name> --project-ref <SUPABASE_PROJECT_REF> --use-api` for each function in this order, adding `--no-verify-jwt` for the internal ones (the flag must match the table). `--use-api` bundles on Supabase's servers, so nothing but the CLI is needed on the PC.

### 4.2 Shared helpers (`supabase/functions/_shared/`)

```
_shared/
  http.ts        json(status, body), sse(), cors headers, handleOptions(req)
  auth.ts        requireUser(req) -> { user, userDb }, requireInternal(req)
  clients.ts     serviceDb() (service role, no session), userDb(authHeader)
  openrouter.ts  the ModelClient implementation for Deno (07 §6.4)
  embed.ts       embed(text): number[] using Supabase.ai.Session('gte-small')
  vendor/        GENERATED copy of packages/torq and parts of packages/shared (01 §4.3)
```

- CORS: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`, `Access-Control-Allow-Methods: POST, OPTIONS`. Every function answers `OPTIONS` with 204.
- `requireUser`: reads `Authorization: Bearer <jwt>`, builds `userDb` with the anon key and that header, calls `userDb.auth.getUser()`; on failure returns 401 `{ code: 'CC_NOT_SIGNED_IN' }`.
- `requireInternal`: compares header `x-internal-secret` with `Deno.env.get('INTERNAL_SECRET')` in constant time; mismatch → 401.
- Errors are returned as JSON `{ code, message }` with status 400 (business), 401, 403, 429 (limits) or 500.

### 4.3 `torq-chat` (POST, SSE)

Request body (zod `ChatRequest`):

```ts
{ thread_id?: string;                         // omit to start a new thread
  surface: 'rider_chat' | 'admin_console';
  message: string;                            // 1..2000 chars
  input_mode: 'typed' | 'voice';
  photo_path?: string;                        // torq-photos/<uid>/... (path without bucket)
  college_id?: string;                        // admin console: the college in view (super admin may switch)
  location?: { lat: number; lng: number } }   // rider app sends it when permission is granted
```

Response: `Content-Type: text/event-stream`. Each event is `event: <name>\ndata: <json>\n\n`. Events in order:

| Event     | Data                                                                        | Meaning                                                           |
| --------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `run`     | `{ run_id, thread_id, agent }`                                              | run started (agent is set again in later `step` events)           |
| `step`    | `{ step_no, kind, agent, name, status: 'start' \| 'end', label, ok?, ms? }` | a step started/ended. `label` is short display text from 07 §10.2 |
| `action`  | `ActionCard` (07 §5.3)                                                      | an action awaits confirmation                                     |
| `message` | `{ message_id, content, chart?, table?, action_ids: string[] }`             | the final assistant message (already saved)                       |
| `done`    | `{ run_id, status, steps, cost_usd }`                                       | stream ends                                                       |
| `error`   | `{ code, message }`                                                         | run failed; stream ends after it                                  |

The client shows `step` events as ticking chips while the run is live (07 §10.2), then renders the `message`. Keep-alive: the server sends `: ping\n\n` every 10 s. Max run time 60 s, then the run is stopped with `error` `CC_AI_UNAVAILABLE`.

Client parser: `api/torq.ts` exports `streamChat(url, jwt, body, onEvent): Promise<void>` which uses `fetch` with `ReadableStream` reading (`expo/fetch` on native because React Native's default fetch does not stream; global `fetch` on web and admin), splits on blank lines and dispatches parsed events.

### 4.4 `torq-action` (POST, JSON)

Request `{ action_id: string, decision: 'confirm' | 'cancel' }`. Behaviour in 07 §5.4. Response `{ status: 'done' | 'cancelled' | 'failed', result?, message?: { message_id, content } }`. Errors: `CC_ACTION_NOT_FOUND` (not the caller's or unknown), `CC_ACTION_EXPIRED`, plus any RPC error code the tool raised.

### 4.5 `torq-suggest` (POST, JSON)

Request `{ photo_path: string }` (bucket `issue-photos`, caller's folder). Runs the Inspector `issue_suggest` job (07 §9.3) and returns `{ type: IssueType, note: string, confidence: number }`. If the feature `snap_to_report` is off for the college, or AI is unavailable, returns 200 `{ type: null, note: '', confidence: 0 }` so the form simply stays empty.

### 4.6 `torq-worker` (POST, internal)

Body is one of `{ job: 'photo_check', ride_id }`, `{ job: 'id_check', user_id }`, `{ job: 'issue_triage', issue_id }`. Returns 202 immediately after starting the job with `EdgeRuntime.waitUntil(promise)`. Jobs in 07 §9.

### 4.7 `torq-cron` (POST, internal)

Body `{ job: 'morning' }`. For every active college, for `demo` in `[false, true]` (demo only for colleges that have demo users): forecast, rebalancing, digest (07 §9.5). Returns 202 and runs with `waitUntil`.

### 4.8 `torq-knowledge` (POST, internal)

Body `{ college_id: string }` or `{ global_help: true }`. Chunking and embedding in 07 §8.3.

### 4.9 `push-send` (POST, internal)

Body `{ notification_id }`.

1. Load the notification and the user's `push_token` with the service client. No token → mark `push_error = 'no_token'` and return 200.
2. POST `https://exp.host/--/api/v2/push/send` with
   ```json
   {
     "to": "<token>",
     "title": "<title>",
     "body": "<body>",
     "sound": "default",
     "priority": "high",
     "channelId": "default",
     "data": {
       "notification_id": "<id>",
       "screen": "<data.screen>",
       "ride_id": "...",
       "issue_id": "...",
       "user_id": "..."
     }
   }
   ```
3. On HTTP 200 with `data.status == 'ok'` set `pushed_at = now()`. On `DeviceNotRegistered` clear the user's `push_token`. Any other error → `push_error = <message>` (truncated to 200 chars).

### 4.10 `cleanup-photos` (POST, internal)

1. Select rides with `return_photo_path is not null and ended_at < now() - interval '30 days'` (limit 500 per run).
2. `storage.from('return-photos').remove(paths)` in batches of 100, then set `return_photo_path = null` on those rides.
3. Same for `torq-photos` objects older than 30 days (list by folder with the storage API) and `issue-photos` of issues resolved more than 30 days ago (`photo_path` set to null).
4. Return `{ removed: n }`.

### 4.11 Push token registration (client side, no function)

On app start, after sign-in, when notification permission is granted: `Notifications.getExpoPushTokenAsync({ projectId })` and `updateMyProfile({ push_token })` if it changed. Android channel `default` is created with importance HIGH before requesting the token.

### 4.12 `delete-account` (POST, JSON, user JWT)

1. Load the caller's profile and pass with the service client.
2. Refuse: owner → 400 `CC_OWNER_PROTECTED`; `demo_role` not null → 400 `CC_DEMO_PROTECTED`; pass holds a bike → 400 `CC_PASS_HAS_BIKE` with `{ bike }`.
3. Delete storage objects in the caller's folder of all four buckets (list then remove).
4. Delete `ai_threads` (cascades messages and actions), `ai_memories`, `ai_usage` rows of pool `user:<uid>`.
5. Insert `audit_log` (`actor_id` = caller, `via 'app'`, `action 'account.delete'`, `target_id` uid, `college_id`).
6. `auth.admin.deleteUser(uid)`. The profile cascade deletes pass and notifications; rides, issues and audit rows keep their data with `rider_id`/`reporter_id`/`actor_id` set to null (anonymised by the foreign keys).
7. Return `{ ok: true }`. The client signs out locally and goes to R01.

### 4.13 `admin-reset-password` (POST, JSON, user JWT)

Request `{ user_id }`.

1. With `userDb`, call `rpc('get_my_context')`; the caller must be an approved `college_admin` or `super_admin`, else 403 `CC_FORBIDDEN`.
2. Load the target profile with the service client. Refuse: target is owner → `CC_OWNER_PROTECTED`; `demo_role` set → `CC_DEMO_PROTECTED`; caller is demo and target is not demo → `CC_DEMO_FORBIDDEN`; caller is a college admin of a different college → `CC_FORBIDDEN`.
3. Temporary password: three words from the fixed list in `_shared/words.ts` (200 short lowercase English words, committed) joined with `-` plus two digits, for example `river-lamp-oak-42`.
4. `auth.admin.updateUserById(user_id, { password })`, then update `profiles.password_reset_requested_at = null`.
5. Insert `audit_log` (`actor_id` caller, `via 'admin'`, `action 'user.reset_password'`, `target_type 'profile'`, `target_id` user id). Never log the password.
6. Insert a notification for the target: kind `password_reset`, title `Password reset`, body `Your college admin set a temporary password. Change it in Profile after you sign in.`
7. Return `{ temp_password }`. The admin UI shows it once (05 A04).

## 5. QR payloads and deep links

| Payload     | Format                                           | Produced by                                                                             | Parsed by                                                                                    |
| ----------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Bike QR     | `campuscycle://b/<CODE>?s=<22-char sig>`         | `private.bike_payload` (labels A09, `list_pickable_bikes`, `demo_qr_samples` (02b §19)) | `parseQr()` → `{ kind: 'bike', code, sig }`                                                  |
| Pass QR     | `campuscycle://p/<pass uuid>?t=<window>&s=<sig>` | `get_my_pass_qr`                                                                        | `parseQr()` → `{ kind: 'pass', payload }` (admins send the full string to `admin_scan_pass`) |
| Manual code | `K-042` (also `k042`, `K 042`)                   | typed                                                                                   | `normalizeCode()` → `K-042`                                                                  |

`packages/shared/src/qr.ts`:

```ts
export function parseQr(
  raw: string,
): { kind: 'bike'; code: string; sig: string } | { kind: 'pass'; payload: string } | { kind: 'unknown' };
export function normalizeCode(input: string): string | null; // /^([A-Za-z]{1,3})[\s-]?(\d{3,4})$/ → 'K-042'
```

Bike regex: `^campuscycle://b/([A-Z]{1,3}-[0-9]{3,4})\?s=([A-Za-z0-9_-]{22})$`. Pass regex: `^campuscycle://p/[0-9a-f-]{36}\?t=[0-9]{1,12}&s=[A-Za-z0-9_-]{22}$`.

Deep link: opening `campuscycle://b/K-042?s=...` (phone camera scanning a sticker) opens route `app/b/[code].tsx`, which redirects to Borrow (R12) with `code` and `sig` when the rider is approved and the pass is ready; otherwise to Home with a toast `en.r12.deeplink_not_ready`.
