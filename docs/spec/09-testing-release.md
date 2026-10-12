# 09 · Testing, CI, operations and release

This file lists every automated test, the GitHub Actions workflows, the keep-alive and backup jobs, and the exact release steps for the Android APK, the store-ready bundle, the rider web build and the admin site.

## 1. Test layers and commands

| Layer                 | Tool                                | Location                                       | Command           | Runs in CI                              |
| --------------------- | ----------------------------------- | ---------------------------------------------- | ----------------- | --------------------------------------- |
| Database              | Vitest with `@supabase/supabase-js` | `supabase/tests/database/`                     | `pnpm db:test`    | `ci.yml`                                |
| Shared and TORQ units | vitest                              | `packages/shared/test/`, `packages/torq/test/` | `pnpm test`       | `ci.yml`                                |
| Admin units           | vitest + Testing Library            | `apps/admin/src/**/*.test.tsx`                 | `pnpm test`       | `ci.yml`                                |
| Mobile units          | jest-expo                           | `apps/mobile/src/**/*.test.ts(x)`              | `pnpm test`       | `ci.yml`                                |
| Admin end to end      | Playwright                          | `e2e/admin/`                                   | `pnpm e2e:admin`  | `ci.yml`                                |
| Mobile end to end     | Maestro                             | `e2e/mobile/`                                  | `pnpm e2e:mobile` | `mobile-e2e.yml` (manual) and on the PC |
| TORQ evals            | own runner                          | `evals/`                                       | `pnpm evals`      | `evals.yml`                             |
| Everything fast       | —                                   | —                                              | `pnpm check`      | `ci.yml`                                |

## 2. Database tests

Helpers, rules and pattern: `02b-database-ai-demo.md` §21. Every test runs with Vitest against the hosted Supabase project as a signed-in person (a real rider or admin of a throwaway test college, or a demo account where demo behaviour is the subject), asserts the exact error code and the resulting database state, and cleans up after itself. The service-role client only sets up, reads state back and calls service-only functions. Zero `psql` or local PostgreSQL binaries are required.

### 2.1 Files and cases

| File                               | Cases (tested via Vitest + `@supabase/supabase-js`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000_helpers.test.ts`              | helpers and connection verification (in 02b §21.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `010_borrow_return.test.ts`        | in 02b §21.2: borrow happy path; bike and pass linked; second borrow refused `CC_PASS_HAS_BIKE`; same bike refused for another rider; not at stand `CC_NOT_AT_STAND`; poor accuracy; mock location; return at another stand; wrong bike `CC_WRONG_BIKE`; counts update; constraint blocks borrowed-without-pass                                                                                                                                                                                                                                                                                                                  |
| `020_signup_approval.test.ts`      | new auth user creates profile + pending pass with college from metadata; `email_domain_match` true for a listed domain; `update_application` works while pending and resets a rejected profile to pending; `approve_rider` issues the next pass number and status `ready`; approving twice → `CC_NOT_PENDING`; `reject_rider` without reason → `CC_REASON_REQUIRED`; `approve_riders` over 50 → `CC_TOO_MANY`; `request_password_reset` sets `password_reset_requested_at` and notifies admins; unknown email returns ok without changes; approval creates an `approval` notification                                            |
| `030_rls_isolation.test.ts`        | admin of college A sees 0 profiles, bikes, rides, issues, stands of college B through tables and the four admin views; rider sees only own profile, pass, rides, reports, notifications; rider cannot `insert/update` bikes, rides, passes (permission denied); anon can call only `list_colleges_public`, `health`, `demo_qr_samples`; super admin sees both colleges; demo admin sees only `is_demo` rows                                                                                                                                                                                                                      |
| `040_admin_functions.test.ts`      | `suspend_rider` with a bike → `CC_PASS_HAS_BIKE`; suspend then `reinstate_rider`; `reset_strikes`; `force_return` frees pass and bike, puts bike at the stand, notifies the rider, adds strike when asked; `mark_bike_missing`; `set_bike_maintenance` on/off and `CC_STAND_REQUIRED`; `move_bike(s)`; `create_bikes` codes use the college prefix and continue the sequence; `retire_bike` refuses a borrowed bike; `upsert_stand` insert and update; `stand_check_submit` returns seen/missing/unexpected; `update_issue` resolve requires a note; every function writes one `audit_log` row with the right `action` and `via` |
| `050_timers_strikes.test.ts`       | reminder sent once when 15 min remain; overdue marking sets `is_overdue`, pass `overdue`, notification; late return adds a strike and sets `late`; reaching the limit suspends the pass and notifies; finish thresholds graphite → chrome at 10 → holo at 50                                                                                                                                                                                                                                                                                                                                                                     |
| `060_issues_notifications.test.ts` | `report_issue` with bike code during a ride links the ride; `bike_missing` during a ride frees nothing until an admin acts; `request_ride_close` creates `ride_close_request` and admin alert; resolving notifies the reporter; notification prefs off suppress `reminders` kinds but never `approval`/`suspension`/`ride_overdue` (an `it.todo`: the push decision leaves the database through `pg_net` and cannot be observed through the API; checked by hand in P5-T02); `mark_notifications_read`                                                                                                                           |
| `070_demo.test.ts`                 | demo rider borrow and return without coordinates succeed; non-demo rider without coordinates → `CC_NO_LOCATION`; demo account cannot touch real rows (`CC_DEMO_FORBIDDEN`); demo admin settings/stand/college changes → `CC_DEMO_READONLY`; demo passwords guard trigger blocks password change; `admin_run_demo_reset` restores bikes K-001..K-030 to their home stands, ends demo rides, recreates seeded issues and digest, keeps real rows untouched                                                                                                                                                                         |
| `080_ai_tables.test.ts`            | users read only their own threads, messages, actions; admins read runs/steps/insights of their college only; nobody can insert into any `ai_*` table directly; `ai_usage_summary(null)` refused for college admins; `update_ai_settings` cap above 5 → `CC_CAP_TOO_HIGH`; `clear_my_ai_memory` removes only the caller's rows; service-only functions are not executable by `authenticated`                                                                                                                                                                                                                                      |
| `090_storage.test.ts`              | storage policies: a rider can insert into `return-photos/<own uid>/…` but not another uid folder; admins of the rider's college can read it; admins of another college cannot; anon cannot read any bucket                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `100_owner_protection.test.ts`     | the profile whose email equals `owner_email` becomes `super_admin`, `approved`, `is_owner`; nobody (including another super admin) can suspend, demote, reject or change the owner (`CC_OWNER_PROTECTED`); only one owner can exist                                                                                                                                                                                                                                                                                                                                                                                              |
| `110_qr.test.ts`                   | `bike_payload` round-trips through `borrow_bike` signature check; tampered signature → `CC_BAD_QR`; manual code (empty sig) works and records `manual`; pass QR from `get_my_pass_qr` scans with `admin_scan_pass` inside its window and fails with `CC_PASS_QR_EXPIRED` two windows later                                                                                                                                                                                                                                                                                                                                       |
| `120_extras.test.ts`               | `demo_qr_samples` (anon) returns only available demo bikes with valid payloads; `colleges_overview` refused for college admins and returns one row per college for super admins                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 3. Unit tests

`packages/shared/test/`:

- `format.test.ts`: every helper in 01 §11 with edge cases (0 m, 999 m, 1000 m, 59 min, 60 min, overdue, en-IN digits, IST clock).
- `qr.test.ts`: valid bike and pass payloads, wrong scheme, lowercase code, `k042`, `K 042`, `K-0042`, garbage.
- `errors.test.ts`: `toAppError` for rider `{ ok:false }`, PostgREST error with `CC_*` message and JSON hint, network `TypeError`, unknown; `messageFor` fills placeholders and falls back to `CC_UNKNOWN` copy.
- `validation.test.ts`: each zod schema accepts the sample valid input and rejects each documented invalid case.
- `api.test.ts`: with a fake client, a rider wrapper throws `AppError` (code and data) for `{ ok:false }` and for a raised error and returns the result when ok; a direct read without a session throws `CC_NOT_SIGNED_IN`; an Edge Function error body and a network failure become `AppError`; `upsertStand`, `createCollege` and `updateAiSettings(null)` send their explicit nulls and `moveBikes` sends bike codes.
- `strings.test.ts`: every `{placeholder}` in `en` has a matching key in its call sites list (`STRING_VARS` map) and every error code in 03 §2.1 has copy.

`packages/torq/test/`: listed in 07 §12.5.

`apps/mobile/src/` (jest-expo): `passState.test.ts` (every branch of `passDisplayState`), `gate.test.ts` (routing table in 04 §1.2), `queue.test.ts` (enqueue, flush success, drop after 24 h), `push.test.ts` (route mapping 04 §1.8).

`apps/admin/src/` (vitest): `csv.test.ts`, `scope.test.tsx` (college admin fixed, super admin cookie), `routeForNotification.test.ts` (05 §1.4 table).

## 4. Admin end-to-end (Playwright)

`e2e/admin/playwright.config.ts`: `baseURL` `http://localhost:3000`, `webServer` runs `pnpm --filter @campuscycle/admin build && pnpm --filter @campuscycle/admin start` with env from the root `.env`, which points at the dev Supabase project (run `pnpm db:reset` and `pnpm functions:deploy` before the suite), projects `desktop` (1440×900, Chromium) and `phone` (Pixel 7 device profile) for files ending `.phone.spec.ts`, `retries: 1` in CI, traces on first retry. TORQ calls are stubbed: the dev project has the Edge Function secret `TORQ_FAKE=1` (01 §7), which makes `torq-chat` use `FakeModelClient` with the scripts in `supabase/functions/_shared/fake-scripts.ts` (a route reply, a `set_bike_maintenance` tool call for "Put K-021 into maintenance", and a final message).

| File                 | Steps and checks                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.spec.ts`       | rider credentials refused with `CC_NOT_ADMIN` copy; demo admin button lands on Dashboard with the demo banner; sign out                                |
| `approvals.spec.ts`  | demo admin sees 4 applicants; mismatch chip on Rohan Verma; reject with a quick reason; approve one; bulk approve the rest; queue empty state          |
| `fleet.spec.ts`      | add 2 bikes at Library; codes shown; open labels page with them (2 labels rendered); put one into maintenance; move one to Hall 5                      |
| `stands.spec.ts`     | super admin (the dev owner `owner-dev@example.com` from `.env`) adds a stand by clicking the map and saving; demo admin save shows read-only copy      |
| `rides.spec.ts`      | filter active rides; force-return the seeded active ride with a note; ride shows `FORCED`; audit log has `ride.force_return`                           |
| `issues.spec.ts`     | grouped view shows the K-021 group with 3 reports; resolve all with a note                                                                             |
| `torq.spec.ts`       | console: ask "Put K-021 into maintenance" (fake model) → confirm card → Confirm → result pill; bike shows maintenance in A08; trace page lists the run |
| `scope.spec.ts`      | college admin of a second test college (created by the test via the service key) sees none of IITK's riders, bikes or rides                            |
| `try.spec.ts`        | `/try` signed out shows 6 QR tiles and working links                                                                                                   |
| `scan.phone.spec.ts` | Scan page manual bike code K-004 shows the bike card (camera not used)                                                                                 |

## 5. Mobile end-to-end (Maestro)

Maestro flows run against a release-like build installed on an Android emulator (API 34, Pixel 7 image). Build for tests: `pnpm --filter @campuscycle/mobile exec expo run:android --variant release`, which reads `apps/mobile/.env.local` and therefore uses the dev Supabase project (01 §3.4); P6-T05 runs flows 01–04 on the released APK, which uses the production project. App id `com.sakshamm21.campuscycle`. Flows use the demo rider (no GPS needed) and `testID`s defined in the components (`testID` = the copy key, e.g. `r01.demo`).

| Flow (`e2e/mobile/`)     | Steps                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `01_demo_login.yaml`     | launch (clearState) → tap `r01.demo` → Permissions continue → see "hey aanya" and the pass label `IITK · 0421`                                                                                                                                                                             |
| `02_borrow_return.yaml`  | Home → dock Borrow → `r11.demo_pick` → pick the first bike → slide `r12.slide` → Riding shows the bike code → `r13.return` → choose a stand in the demo picker → scan step `r11.demo_use` → take photo (emulator virtual scene) → `r14.finish` → see the Returned stamp and receipt → done |
| `03_report_issue.yaml`   | Map tab → List → first stand → report icon → pick Flat tyre → note → send → toast                                                                                                                                                                                                          |
| `04_torq_chat.yaml`      | open TORQ → tap suggestion "Explain the ride rules" → an assistant bubble appears (on the dev project the reply comes from `TORQ_FAKE=1`; on production from the real model)                                                                                                               |
| `05_signup_pending.yaml` | Welcome → Sign up → 4 steps with a random email → Pending screen with the pending pass                                                                                                                                                                                                     |
| `06_theme.yaml`          | Profile → Day → Home background changes (assert by screenshot comparison off; assert the Segmented selection)                                                                                                                                                                              |

Real GPS check (manual, Phase 5): with the emulator's Extended Controls → Location set to a stand's coordinates (not a mock-location app), a non-demo approved rider borrows and returns; with the location 300 m away the app shows the "not inside a stand" message.

## 6. Accessibility and quality checks (Phase 5)

- Android: Accessibility Scanner on R01, R08, R12, R13, R14, R17; fix every contrast and touch-target warning.
- TalkBack pass over borrow and return: every control is announced with its copy.
- Font scale 1.3 and reduce motion on: no clipped text, no animations.
- Admin: Lighthouse accessibility ≥ 95 on `/sign-in`, `/dashboard`, `/try`; keyboard-only approve and force-return.

## 7. GitHub Actions workflows (`.github/workflows/`)

All workflows use `actions/checkout@v4`, `pnpm/action-setup@v4` (version from `packageManager`), `actions/setup-node@v4` (`node-version-file: .nvmrc`, `cache: pnpm`) and `pnpm install --frozen-lockfile`.

### `ci.yml` (on pull_request and push to `main`)

Workflow-level `concurrency: { group: hosted-project, cancel-in-progress: false }`, because the `db` and `e2e-admin` jobs share the dev Supabase project (01 §3.4). No workflow except `keepalive.yml`, `backup.yml` and `release.yml` ever holds a production value. Those jobs start with a step that writes the root `.env` from secret `DEV_ENV_FILE`, copies its `NEXT_PUBLIC_*` lines to `apps/admin/.env.local`, and sets env `SUPABASE_ACCESS_TOKEN` (secret) for the Supabase CLI (the root dev dependency).
Jobs:

1. `check`: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `node scripts/sync-torq.mjs --check`.
2. `db` (needs `check`): `pnpm db:reset`, `pnpm db:test`.
3. `e2e-admin` (needs `db`): `pnpm db:reset`, `pnpm functions:deploy`, `npx playwright install --with-deps chromium`, `pnpm e2e:admin`; upload `playwright-report` on failure.

### `evals.yml` (manual `workflow_dispatch` and weekly, Sunday 03:00 UTC)

`node scripts/check-routes.mjs`, then `pnpm evals --write` with secrets `OPENROUTER_EVAL_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; fails when a threshold (07 §12.3) is missed; uploads `evals/report/`.

### `keepalive.yml` (daily 05:00 UTC and manual)

`curl -fsS -X POST "$SUPABASE_URL/rest/v1/rpc/health" -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{}'`. Keeps the free Supabase projects from pausing after a week without traffic: the step runs twice, once for production (secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`) and once for dev (`DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`). A scheduled workflow in a public repo is disabled by GitHub after 60 days without commits; `docs/setup.md` tells the owner to re-enable it from the Actions tab if that happens.

### `backup.yml` (weekly, Sunday 20:00 UTC, and manual)

The free Supabase plan keeps no backups, so this workflow is the only copy of production data outside Supabase. Steps on `ubuntu-latest`: install the PostgreSQL 17 client from the PGDG apt repository; `pg_dump "$PROD_DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=private --schema=auth --file=backup.dump`; `gpg --batch --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" backup.dump`; delete the plain file; upload `backup.dump.gpg` with `actions/upload-artifact@v4` (`retention-days: 90`, name `campuscycle-backup-<date>`). The dump holds personal data and the repository becomes public, so the plain file is never uploaded and never printed. Photos in Storage are not backed up (they are deleted after 30 days anyway). Secrets: `PROD_DB_URL` (session pooler string of production), `BACKUP_PASSPHRASE`. Restore steps are in `docs/setup.md` (§9 item 8).

### `mobile-e2e.yml` (manual)

`reactivecircus/android-emulator-runner@v2` (API 34, `x86_64`, `google_apis`), the same `concurrency` group and `DEV_ENV_FILE` / `SUPABASE_ACCESS_TOKEN` setup as `ci.yml` (also copying the `EXPO_PUBLIC_*` lines to `apps/mobile/.env.local`), `pnpm db:reset`, `pnpm functions:deploy`, build the release variant, install Maestro (`curl -Ls "https://get.maestro.mobile.dev" | bash`), `maestro test e2e/mobile`. Uploads `~/.maestro/tests` on failure.

### `release.yml` (on tag `v*` and manual)

See §8.4.

## 8. Release

### 8.1 Versions

`apps/mobile/app.config.ts` `version` (semantic, e.g. `1.0.0`) and `android.versionCode` (integer, +1 every release). Git tag `v1.0.0` matches. The admin site and rider web deploy continuously from `main`.

### 8.2 `apps/mobile/eas.json`

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "local" },
  "build": {
    "preview": { "distribution": "internal", "channel": "preview", "android": { "buildType": "apk" } }
  }
}
```

### 8.3 Build Configuration

The preview profile builds a standalone `.apk` without a Google Play developer account or store credentials. It does need `google-services.json` from Sak's free Firebase project (08 P5-T01), because Android delivers push through FCM: without the file the app still builds and runs, but notifications only show while it is open. iOS push needs a paid Apple developer account and stays unconfigured.

### 8.4 `release.yml`

Runs on `ubuntu-latest` (EAS local builds need Linux or macOS; GitHub's runner is free for public repositories):

1. Checkout, pnpm, Node, `actions/setup-java@v4` (temurin 17), `pnpm install --frozen-lockfile`.
2. `npm i -g eas-cli`; env `EXPO_TOKEN` (secret, from the owner's free Expo account), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EAS_PROJECT_ID`, `EAS_UPDATE_URL`, `EXPO_PUBLIC_SENTRY_DSN`, all with production values; a step before the build decodes secret `GOOGLE_SERVICES_JSON_B64` to a temp file and sets `GOOGLE_SERVICES_JSON` to its path.
3. `cd apps/mobile && eas build --platform android --profile preview --local --non-interactive --output ../../campuscycle-<version>.apk`.
4. `softprops/action-gh-release@v2` creates the release for the tag with `campuscycle-<version>.apk` and the notes from `docs/release-notes/<version>.md`.

The README's download link is `https://github.com/sakshamm21/CampusCycle/releases/latest`.

### 8.5 Rider web build

Vercel project `campuscycle-ride` (Hobby): root directory `apps/mobile`, install command `cd ../.. && pnpm install --frozen-lockfile`, build command `pnpm expo export --platform web`, output directory `dist`, env `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_ADMIN_URL`. `apps/mobile/vercel.json` rewrites everything to `/index.html` (04 §4). Production domain `campuscycle-ride.vercel.app`.

### 8.6 Admin site

Vercel project `campuscycle` (Hobby): root directory `apps/admin`, framework Next.js, install command `cd ../.. && pnpm install --frozen-lockfile`, env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_RIDER_WEB_URL`, `NEXT_PUBLIC_APK_URL`. Production domain `campuscycle.vercel.app` (if taken, the closest free name; update `ADMIN_URL` everywhere it appears in 01 §7). Both Vercel projects deploy on every push to `main` through Vercel's GitHub integration.

### 8.7 Demo assets and showcase (`docs/demo-guide.md`)

- `docs/demo-guide.md`: a complete five-minute demo walkthrough for recruiters and portfolio evaluators.
- `screenshots/`: 8 phone screenshots 1080×2400 captured from the emulator with the demo rider (R01, R08 pass front, R08 pass back, R09 map, R12 borrow, R13 riding, R15 receipt, R17 TORQ) and a 1024×500 feature graphic made by `scripts/make-icons.mjs --feature` for the project README.

## 9. Operations runbook (`docs/setup.md` sections)

1. PC setup (Node 22+, pnpm, git, GitHub CLI, Java 17, Supabase CLI login, Android Studio + emulator, Maestro) and the single env file `.env` (01 §3.4, §7).
2. Development against the hosted project: `pnpm db:push` (new migrations), `pnpm db:reset` (clean rebuild with seed and demo users), `pnpm db:test`, `pnpm functions:deploy`, `pnpm dev:admin`, `pnpm dev:mobile`.
3. Demo reset: automatic at 04:00 IST; manual `select public.admin_run_demo_reset();` in the SQL editor or admin dashboard.
4. AI spend: A15; OpenRouter key limits; switching to free-only models.
5. Keep-alive job (§7) to prevent free-tier project pause.
6. Releasing a new APK (§8).
7. Two projects (01 §3.4): which env file is which, how a migration reaches production (`pnpm db:push:prod` after merge), and that production is never reset.
8. Backups (§7): where the weekly artifact is, and restoring one: download, `gpg --decrypt`, `pg_restore --clean --if-exists --no-owner -d <target db url> backup.dump` into the dev project first.
9. Crash reports: the two Sentry projects and what is never sent (08 P5-T05b).
