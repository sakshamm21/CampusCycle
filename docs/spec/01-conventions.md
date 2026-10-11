# 01 · Conventions, repository layout and tooling

This file fixes every project-wide choice: folders, package names, tool versions, scripts, environment variables, naming, error handling, copy and git rules. Every other spec file assumes these.

## 1. Repository

- GitHub: `https://github.com/sakshamm21/CampusCycle` (private during the build, made public in Phase 6).
- Default branch `main`. One branch and one pull request per phase: `phase-0-foundation`, `phase-1-database`, `phase-2-admin`, `phase-3-rider`, `phase-4-torq`, `phase-5-hardening`, `phase-6-release`.
- Every commit is authored as Sak and carries **no** co-author or session trailers:
  ```
  git config user.name "sakshamm21"
  git config user.email "95285595+sakshamm21@users.noreply.github.com"
  ```
- `.githooks/commit-msg` (committed; enabled with `git config core.hooksPath .githooks` in P0-T02) rejects any message containing a `Co-Authored-By:` line, a `Claude` trailer or a session link, so nothing but Sak's name is ever on a commit.
- Commit messages: imperative, max 72 characters in the subject, prefixed with the task id, for example `P1-T04 add core tables migration`.
- App id (Android package and iOS bundle id): `com.sakshamm21.campuscycle`. Deep-link scheme: `campuscycle`.
- Product name everywhere: **CampusCycle**. AI name: **TORQ** (always upper case). No college name, logo or colour appears in code, copy, icons or URLs. IITK exists only as seed data.

## 2. Folder layout

```
CampusCycle/
  .github/workflows/        ci.yml, evals.yml, keepalive.yml, release.yml
  apps/
    mobile/                 Expo rider app (Android, iOS config, web export)
    admin/                  Next.js admin web app (also hosts /try, /privacy, /delete-account)
  packages/
    shared/                 @campuscycle/shared: types, API wrappers, errors, copy, tokens, validation
    torq/                   @campuscycle/torq: TORQ harness (pure TypeScript, runs in Node and Deno)
  supabase/
    config.toml
    migrations/             SQL migrations 1–17 (02-database.md, 02b-database-ai-demo.md)
    functions/              Edge Functions (03 §4) + _shared/ + import_map.json
    seed/                   01_iitk.sql, 02_ai_settings.sql, assets/id-cards/*.png
    tests/database/         Vitest database client tests (09 §2)
  evals/                    TORQ eval cases, fixtures, runner, latest report (07 §12)
  e2e/
    mobile/                 Maestro flows (09 §5)
    admin/                  Playwright tests (09 §4)
  scripts/                  Node scripts (§6)
  docs/
    spec/                   this spec, copied in Phase 0 (read-only reference)
    setup.md                PC setup and running against the dev project
    demo-guide.md           demo logins and walkthrough (Phase 6)
    store/                  store listing text, screenshots, data safety answers (Phase 6)
    privacy.md              privacy policy source (rendered at /privacy)
  .env.example
  .gitignore  .gitattributes  .npmrc  .nvmrc  .prettierrc  eslint.config.mjs
  package.json  pnpm-workspace.yaml  tsconfig.base.json  README.md
```

## 3. Toolchain and versions

| Tool             | Version rule                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js          | 22 LTS (`.nvmrc` contains `22`)                                                                                                                                             |
| pnpm             | 10.x via corepack; root `package.json` has `"packageManager": "pnpm@10.18.0"` (use the newest 10.x that corepack resolves at Phase 0 and pin it)                            |
| TypeScript       | 5.x, `strict: true` everywhere                                                                                                                                              |
| Expo             | the SDK installed by `npx create-expo-app@latest` at Phase 0 (must be SDK 54 or newer). Every Expo library is added with `npx expo install <pkg>` so versions match the SDK |
| React Native     | whatever that Expo SDK pins                                                                                                                                                 |
| Next.js          | the version installed by `npx create-next-app@latest` at Phase 0 (must be 15 or newer), App Router, `src/` dir                                                              |
| Tailwind         | admin: v4 (from create-next-app). mobile: `tailwindcss@3.4.x` with `nativewind@4.x` (NativeWind 4 requires Tailwind 3)                                                      |
| shadcn/ui        | `npx shadcn@latest init` in apps/admin, style "new-york", base colour "neutral", CSS variables on                                                                           |
| Supabase CLI     | latest 2.x as a root dev dependency (`supabase`), run through `pnpm exec supabase ...` or `scripts/db.mjs`. Used against the hosted project (§3.4)                          |
| Supabase project | one hosted free-plan project `campuscycle` in region `ap-south-1` (Mumbai)                                                                                                  |
| Deno             | only what the Supabase CLI bundles; no global install needed                                                                                                                |
| zod              | `3.23.8` exactly, in shared, torq, admin and mobile (and mapped for Deno, §8)                                                                                               |
| Test runners     | vitest 3.x (shared, torq, admin units, database tests via `pnpm db:test`), jest-expo (mobile units), Playwright (admin e2e), Maestro CLI (mobile e2e)                       |

After Phase 0, record every resolved version in `docs/setup.md` §Versions. Never upgrade a major version later without a task that says so.

### 3.1 Root files (exact content)

`.npmrc`

```
node-linker=hoisted
auto-install-peers=true
```

(Hoisted linking is required for Expo/Metro in a pnpm monorepo.)

`pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
  - evals
```

`tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

`.gitignore` (in addition to what create-expo-app and create-next-app add)

```
node_modules/
.env
.env.*
!.env.example
apps/mobile/android/
apps/mobile/ios/
apps/mobile/google-services.json
dist/
.next/
.vercel/
coverage/
playwright-report/
test-results/
supabase/.temp/
supabase/.branches/
evals/.cache/
*.apk
*.local.sql
*.local.txt
```

`apps/mobile/android` and `ios` are generated by `npx expo prebuild` and never committed (Continuous Native Generation).

`.gitattributes`

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.ttf binary
```

### 3.2 Root `package.json` scripts

```json
{
  "name": "campuscycle",
  "private": true,
  "packageManager": "pnpm@10.18.0",
  "scripts": {
    "dev:admin": "pnpm --filter @campuscycle/admin dev",
    "dev:mobile": "pnpm --filter @campuscycle/mobile start",
    "db:push": "node scripts/db.mjs push",
    "db:reset": "node scripts/db.mjs reset && pnpm seed:auth",
    "db:test": "node scripts/db.mjs test",
    "db:types": "node scripts/db.mjs types",
    "seed:auth": "node scripts/seed-auth.mjs",
    "fonts": "node scripts/fetch-fonts.mjs",
    "tokens": "node scripts/gen-tokens.mjs",
    "torq:sync": "node scripts/sync-torq.mjs",
    "torq:check": "node scripts/sync-torq.mjs --check && node scripts/check-routes.mjs",
    "functions:deploy": "pnpm torq:sync && node scripts/deploy-functions.mjs",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "pnpm -r test",
    "evals": "pnpm --filter @campuscycle/evals eval",
    "e2e:admin": "pnpm --filter @campuscycle/admin e2e",
    "e2e:mobile": "maestro test e2e/mobile",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm torq:check"
  }
}
```

Each workspace package has `typecheck` (`tsc --noEmit -p .`) and `test` scripts.

### 3.3 Formatting and lint

`.prettierrc`: `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 110 }`.

`eslint.config.mjs`: typescript-eslint `recommended` + `eslint-plugin-react-hooks` `recommended`, ignores `**/database.types.ts`, `supabase/functions/_shared/vendor/**`, `.next`, `dist`, `apps/mobile/android`, `apps/mobile/ios`. Rule overrides: `@typescript-eslint/no-explicit-any: error`, `no-console: ["error", { allow: ["warn", "error"] }]` (scripts/ and evals/ are exempt).

### 3.4 Supabase project and environment

All backend work runs against a single hosted Supabase project on the free plan: `campuscycle` in region `ap-south-1` (Mumbai).

- The root `.env` holds the project credentials and keys.
- Next.js and Expo read env files from their own workspace, so `apps/admin/.env.local` holds the `NEXT_PUBLIC_*` lines and `apps/mobile/.env.local` holds the `EXPO_PUBLIC_*` lines (both copied from the root `.env`).
- Database URL is the **session pooler** connection string (Project Settings → Database → Connection string → Session pooler, port 5432).
- Edge Function secrets are set via CLI (`pnpm exec supabase secrets set`).
- Nightly demo reset runs automatically via `pg_cron` at 04:00 IST, returning bikes to home stands and clearing demo state.

## 4. Packages

### 4.1 `packages/shared` (`@campuscycle/shared`)

`package.json`: `"name": "@campuscycle/shared"`, `"main": "src/index.ts"`, `"types": "src/index.ts"`, no build step. Dependencies: `@supabase/supabase-js@^2`, `zod@3.23.8`.

```
packages/shared/src/
  index.ts                re-exports everything below
  database.types.ts       GENERATED by pnpm db:types (never edited)
  types.ts                hand-written app types (03 §3)
  errors.ts               error codes, AppError, toAppError(), messageFor() (03 §2)
  strings/en.ts           every user-facing string of both apps (§9)
  tokens.ts               design tokens (06 §2)
  constants.ts            limits shared by both apps (§10)
  validation.ts           zod schemas for forms (04/05 reference them by name)
  format.ts               time, distance and pass-label formatting (§11)
  qr.ts                   QR payload parsing (03 §5)
  api/
    client.ts             createCampusClient()
    rider.ts              rider RPC wrappers (03 §3.2)
    admin.ts              admin RPC wrappers (03 §3.3)
    torq.ts               TORQ HTTP client incl. SSE parser (03 §4.3)
    storage.ts            upload helpers (03 §3.4)
```

### 4.2 `packages/torq` (`@campuscycle/torq`)

Pure TypeScript that must run unchanged in Node (vitest, evals) and in Deno (Edge Functions). Rules:

- No Node built-ins, no `process`, no `Buffer`, no file system. Environment is passed in as arguments.
- Relative imports always include the `.ts` extension (`import { x } from './loop.ts'`).
- The only external imports allowed are `zod`, `zod-to-json-schema` and **type-only** imports from `@supabase/supabase-js`. Deno resolves them through `supabase/functions/import_map.json`.
- Layout is in 07 §2.

### 4.3 Sharing code with Edge Functions

The Supabase bundler cannot reliably import files outside `supabase/functions/`. Therefore `scripts/sync-torq.mjs` copies:

- `packages/torq/src/**` → `supabase/functions/_shared/vendor/torq/`
- `packages/torq/prompts/**` → `supabase/functions/_shared/vendor/torq/prompts/` (as `.ts` modules exporting the file text, because Deno deploy cannot read arbitrary files: `prompts/ride.v1.md` becomes `prompts/ride.v1.ts` with `export default \`...\`;`, backticks and `${` escaped)
- `packages/shared/src/errors.ts`, `strings/en.ts`, `constants.ts`, `qr.ts` → `supabase/functions/_shared/vendor/shared/`

Each copied file starts with `// GENERATED by scripts/sync-torq.mjs. Do not edit.` The vendor folder **is committed**. `--check` mode compares and exits 1 if anything differs (CI runs it). Imports inside copied shared files are rewritten from `'./x'` to `'./x.ts'`.

## 5. Apps

### 5.1 `apps/mobile` (`@campuscycle/mobile`)

Created with `npx create-expo-app@latest apps/mobile --template default`, then the example screens are deleted. Uses expo-router (file-based routes, typed routes on). Layout:

```
apps/mobile/
  app.config.ts           (§5.1.1)
  app/                    routes (04 §2)
  assets/fonts/*.ttf      fetched by pnpm fonts (06 §3)
  assets/images/          icon.png 1024, adaptive-icon.png 1024, splash.png, notification-icon.png 96 (white on transparent)
  src/
    components/           shared UI (06 §5) and RiderPass (06 §6)
    features/             auth/, pass/, ride/, stands/, report/, torq/, notifications/, profile/
    lib/                  supabase.ts, session.tsx, location.ts, camera.ts, photos.ts, push.ts, queue.ts, haptics.ts, deeplink.ts
    hooks/
    theme/                ThemeProvider, useTheme, tailwind preset import
  tailwind.config.js      uses the preset from packages/shared/tokens (06 §2.4)
  global.css              NativeWind entry
  metro.config.js         default Expo config + withNativeWind(config, { input: './global.css' })
  babel.config.js         presets: ['babel-preset-expo' with jsxImportSource 'nativewind'], 'nativewind/babel'; plugins: ['react-native-reanimated/plugin'] last
  eas.json                (09 §8)
```

#### 5.1.1 `app.config.ts` (exact keys)

```ts
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'CampusCycle',
  slug: 'campuscycle',
  scheme: 'campuscycle',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: { image: './assets/images/splash.png', resizeMode: 'contain', backgroundColor: '#0B0E13' },
  ios: {
    bundleIdentifier: 'com.sakshamm21.campuscycle',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'CampusCycle scans bike QR codes and takes a photo when you return a bike.',
      NSLocationWhenInUseUsageDescription:
        'CampusCycle checks that you are at a stand when you borrow or return a bike.',
      NSMicrophoneUsageDescription: 'Hold the mic to talk to TORQ. Speech is turned into text on your phone.',
      NSSpeechRecognitionUsageDescription:
        'Hold the mic to talk to TORQ. Speech is turned into text on your phone.',
    },
  },
  android: {
    package: 'com.sakshamm21.campuscycle',
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: '#0B0E13' },
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    permissions: [
      'CAMERA',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'RECORD_AUDIO',
      'VIBRATE',
      'POST_NOTIFICATIONS',
    ],
    blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'],
    intentFilters: [
      { action: 'VIEW', data: [{ scheme: 'campuscycle' }], category: ['BROWSABLE', 'DEFAULT'] },
    ],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/images/icon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'CampusCycle scans bike QR codes and takes a photo when you return a bike.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'CampusCycle checks that you are at a stand when you borrow or return a bike.',
      },
    ],
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#FFD23F' }],
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Hold the mic to talk to TORQ.',
        speechRecognitionPermission: 'Hold the mic to talk to TORQ.',
      },
    ],
    '@maplibre/maplibre-react-native',
    'expo-secure-store',
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
  updates: { url: process.env.EAS_UPDATE_URL },
  runtimeVersion: { policy: 'appVersion' },
};
export default config;
```

Mobile libraries (all via `npx expo install`): `expo-router`, `expo-font`, `expo-camera`, `expo-location`, `expo-notifications`, `expo-device`, `expo-haptics`, `expo-sensors`, `expo-image-manipulator`, `expo-image-picker` (fallback only), `expo-secure-store`, `expo-speech`, `expo-linking`, `expo-constants`, `expo-updates`, `expo-splash-screen`, `expo-status-bar`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, `@shopify/react-native-skia`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `react-native-qrcode-svg`, `@maplibre/maplibre-react-native`, `expo-speech-recognition`, `expo-dev-client`, `lucide-react-native`, `expo-sharing`, `react-native-view-shot`, `nativewind`, `tailwindcss@3.4.17`, `@supabase/supabase-js`, `@tanstack/react-query@5`, `maplibre-gl` (web map only), `zod@3.23.8`.

Server state uses TanStack Query everywhere (query keys in 04 §1.5). No Redux, no Zustand.

### 5.2 `apps/admin` (`@campuscycle/admin`)

Created with `npx create-next-app@latest apps/admin --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm`. Then `npx shadcn@latest init` and add components: `button card dialog dropdown-menu input label select sheet table tabs textarea badge checkbox switch tooltip popover command sonner skeleton separator scroll-area avatar alert-dialog`.

Admin libraries: `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query@5`, `maplibre-gl@5`, `react-map-gl@8` (import from `react-map-gl/maplibre`), `recharts@2`, `qrcode@1.5` (+ `@types/qrcode`), `qr-scanner@1.4.2`, `papaparse` (CSV), `date-fns@4`, `date-fns-tz@3`, `lucide-react`, `zod@3.23.8`, `@campuscycle/shared` (workspace).

`next.config.ts`: `{ transpilePackages: ['@campuscycle/shared'], reactStrictMode: true, images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] } }`.

Folder layout in 05 §2.

## 6. Scripts (`scripts/`)

| Script                   | Purpose                                                                                                     | Defined in |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------- |
| `db.mjs`                 | database helper: reset, push, types via Supabase CLI and client                                             | §6.1       |
| `seed-auth.mjs`          | creates demo/sample/applicant users and the owner, runs demo reset                                          | 02b §20.4  |
| `make-demo-id-cards.mjs` | renders the 4 sample ID cards                                                                               | 02b §20.4  |
| `fetch-fonts.mjs`        | downloads the static font files for mobile                                                                  | 06 §3.2    |
| `gen-tokens.mjs`         | writes `apps/admin/src/app/tokens.css` from `packages/shared/src/tokens.ts`                                 | 06 §2.5    |
| `sync-torq.mjs`          | copies torq + shared into Edge Functions vendor folder                                                      | §4.3       |
| `check-routes.mjs`       | checks every model id in TORQ routes exists on OpenRouter                                                   | 07 §6.3    |
| `deploy-functions.mjs`   | deploys every Edge Function in the order of 03 §4.1                                                         | 03 §4.1    |
| `embed-help.mjs`         | sends the global help text to `torq-knowledge` once after deploy                                            | 07 §8.3    |
| `fetch-eval-photos.mjs`  | downloads CC0 eval photos from Openverse                                                                    | 07 §12.4   |
| `make-icons.mjs`         | renders the app icon, adaptive icon, splash, notification icon, admin favicons from inline SVG with `sharp` | 06 §4      |

All scripts are ESM (`.mjs`), load env from the root `.env` with `process.loadEnvFile()`, print one line per step and exit non-zero on failure. They never print secrets.

### 6.1 `scripts/db.mjs` (exact behaviour)

Usage: `node scripts/db.mjs <push|reset|types>`. Requires `SUPABASE_DB_URL` and `SUPABASE_PROJECT_REF` in `.env`. Runs the Supabase CLI (`pnpm exec supabase …`):

| Command | Steps                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push`  | `supabase db push --include-all --include-seed`                                                                                                                                                                                                      |
| `reset` | 1) Calls `supabase db reset --linked --yes` (re-applies all migrations and seed). 2) Re-applies private configuration (`owner_email`, `functions_base_url`, `internal_secret`) via `@supabase/supabase-js` service client. 3) Calls `pnpm seed:auth` |
| `types` | `supabase gen types typescript --project-id <SUPABASE_PROJECT_REF> --schema public`, output written to `packages/shared/src/database.types.ts`                                                                                                       |

The Supabase CLI authenticates with `supabase login` on the PC and with env `SUPABASE_ACCESS_TOKEN` in CI.

## 7. Environment variables

`.env.example` (root, committed). Real values live in `.env` (gitignored, single free project):

```
# Supabase (from Project Settings > API and > Database on your free campuscycle project)
SUPABASE_URL=
SUPABASE_ANON_KEY=            # anon key (safe for clients)
SUPABASE_SERVICE_ROLE_KEY=    # service_role key (scripts only, NEVER in client apps)
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=         # database password
SUPABASE_DB_URL=              # session pooler connection string (port 5432)
INTERNAL_SECRET=              # 48 random hex chars; matches Edge Function secret

# Owner account (typed by Sak, seeded into private.app_config)
OWNER_EMAIL=
OWNER_PASSWORD=

# Mobile (Expo reads EXPO_PUBLIC_* at build time)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ADMIN_URL=https://campuscycle.vercel.app
EAS_PROJECT_ID=
EAS_UPDATE_URL=

# Admin (Next.js)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_RIDER_WEB_URL=https://campuscycle-ride.vercel.app
NEXT_PUBLIC_APK_URL=https://github.com/sakshamm21/CampusCycle/releases/latest

# Evals only (CI secret OPENROUTER_EVAL_KEY; never the production key)
OPENROUTER_EVAL_KEY=
```

Apps running on the PC copy `NEXT_PUBLIC_*` to `apps/admin/.env.local` and `EXPO_PUBLIC_*` to `apps/mobile/.env.local`.

Edge Function secrets (set with `pnpm exec supabase secrets set --project-ref <ref> NAME=value`):

| Secret               | Value                                                       | Who sets it                                             |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `OPENROUTER_API_KEY` | Sak's OpenRouter key (limit US$4.50/month on openrouter.ai) | **Sak enters it in the Supabase dashboard** (08 P4-T01) |
| `INTERNAL_SECRET`    | the 48-hex value from `.env`                                | build session (08 P1-T21)                               |
| `ADMIN_URL`          | `https://campuscycle.vercel.app`                            | build session                                           |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions by Supabase automatically.

The CI eval key (`OPENROUTER_EVAL_KEY`, limit US$0.50/month) is a second key Sak creates; together the two keys can never exceed US$5 a month.

## 8. Deno import map

`supabase/functions/import_map.json`:

```json
{
  "imports": {
    "zod": "npm:zod@3.23.8",
    "zod-to-json-schema": "npm:zod-to-json-schema@3.23.5",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  }
}
```

`supabase/config.toml` sets, for every function in 03 §4.1, `import_map = "./functions/import_map.json"` and the `verify_jwt` value given there.

## 9. Copy (user-facing text)

- Every string a person can see lives in `packages/shared/src/strings/en.ts` as one nested object `export const en = { common: {...}, r01: {...}, ..., a18: {...}, errors: {...}, notif: {...} } as const;` with a helper `t(path, vars?)` that replaces `{name}` placeholders.
- Keys are the screen id in lower case plus a snake_case name, for example `en.r08.borrow`. The copy tables in 04 and 05 give the exact key and text; use them verbatim.
- Headlines are lowercase on screen (the display font is set lowercase). Write them in the strings file exactly as given (already lowercase). One word of each headline is the italic accent word: the copy tables mark it as `*word*`; the `Headline` component (06 §5.2) renders text between asterisks in the accent face.
- Tone: short, friendly, second person, no exclamation marks except in TORQ replies, no emoji in UI copy.
- Numbers use the en-IN locale. Distances: `< 1000 m` as `120 m`, otherwise `1.2 km`. Durations: `23 min`, `1 h 05 min`. Times: `9:41 AM` in the college time zone.

## 10. Shared constants (`packages/shared/src/constants.ts`)

```ts
export const PASS_QR_REFRESH_MS = 30_000;
export const LOCATION_TIMEOUT_MS = 15_000;
export const MAX_GPS_ACCURACY_M = 50;
export const PHOTO_MAX_EDGE_PX = 1080;
export const PHOTO_JPEG_QUALITY = 0.6;
export const RIDE_REMINDER_MIN = 15;
export const FINISH_THRESHOLDS = { chrome: 10, holo: 50 } as const;
export const MAX_BULK_APPROVE = 50;
export const MAX_LABELS_PER_SHEET = 21; // 3 x 7 on A4
export const TORQ_MAX_MESSAGE_CHARS = 2000;
export const TORQ_ACTION_TTL_MIN = 15;
export const STORAGE_BUCKETS = {
  idCards: 'id-cards',
  returnPhotos: 'return-photos',
  issuePhotos: 'issue-photos',
  torqPhotos: 'torq-photos',
} as const;
export const DEMO_PASSWORD = 'ride-the-demo-2026';
export const DEMO_EMAILS = {
  rider: 'demo-rider@example.com',
  college_admin: 'demo-admin@example.com',
  super_admin: 'demo-super@example.com',
} as const;
export const IITK_COLLEGE_ID = '11111111-1111-4111-8111-111111111111';
```

## 11. Formatting helpers (`packages/shared/src/format.ts`)

| Function                            | Behaviour                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `formatDistance(m: number \| null)` | `null` → `''`; `< 1000` → `` `${Math.round(m)} m` ``; else one decimal km |
| `walkMinutes(m: number)`            | `Math.max(1, Math.round(m / 80))` (80 m per minute)                       |
| `formatDuration(min: number)`       | `< 60` → `23 min`; else `1 h 05 min`                                      |
| `formatClock(iso, tz)`              | `h:mm a` in `tz` (date-fns-tz `formatInTimeZone`)                         |
| `formatTimer(ms)`                   | `mm:ss` under an hour, `h:mm:ss` above; tabular digits                    |
| `timeLeft(dueIso, now)`             | `{ ms, overdue: boolean }`                                                |
| `passLabel(shortCode, number)`      | `IITK · 0421` (same rule as SQL `pass_label`)                             |
| `finishFor(rides)`                  | `'graphite' \| 'chrome' \| 'holo'` (same thresholds as SQL)               |
| `relativeTime(iso, now)`            | `just now`, `5 min ago`, `2 h ago`, `yesterday`, else `12 Oct`            |

Unit tests for every helper are listed in 09 §3.

## 12. Error handling rules

- Never show raw database, network or model errors. Every failure becomes an `AppError` with a `code` from 03 §2 and is shown with `messageFor(code, data)`.
- Rider-facing RPCs return `{ ok: false, code, data }`; admin RPCs throw (`error.message` is the code, `error.hint` is JSON data). `toAppError()` handles both, plus `TypeError: Network request failed` → `CC_NETWORK`, anything else → `CC_UNKNOWN` (log with `console.error`).
- Forms validate with the zod schemas in `validation.ts` before calling the server and show the first error under the field.
- Loading: show the screen's skeleton (04/05 give each one) after 150 ms; never a blank screen.
- Offline: `@react-native-community/netinfo` (mobile) and `navigator.onLine` (admin) drive a top banner `en.common.offline`; borrow and return buttons are disabled while offline.

## 13. Accessibility rules (both apps)

- Tap targets at least 44 × 44 px.
- Every icon-only button has `accessibilityLabel` (mobile) or `aria-label` (admin) from the strings file.
- Text contrast meets WCAG AA in both themes (tokens in 06 are chosen for this; do not introduce new colours).
- Respect reduce motion: mobile `useReducedMotion()` from Reanimated, admin `prefers-reduced-motion`. With reduce motion on, state changes happen instantly with no tilt, sway, glow, dock or stamp animation.
- Font scaling: allow system font scale up to 1.3 (`maxFontSizeMultiplier={1.3}` on Text by default through the `Text` component in 06 §5).

## 14. Definition of done for any task

1. The code matches the spec section the task cites; nothing extra.
2. `pnpm check` passes locally.
3. Tests named in the task exist and pass.
4. Every new string is in `strings/en.ts`.
5. The task's acceptance lines in 08 are true and were checked, and the phase PR description lists each task id with ✓.
