# CampusCycle Setup and Operations Runbook

This guide covers developer machine setup, repository configuration, the hosted Supabase environment, and the daily development runbook.

---

## 1. Toolchain & Environment Versions

Verified on Windows 11:

| Tool                  | Version / Details                            | Purpose                                   |
| --------------------- | -------------------------------------------- | ----------------------------------------- |
| **OS**                | Windows 11 Pro 64-bit                        | Primary development workstation           |
| **Node.js**           | `v26.7.0` (LTS or newer)                     | JavaScript / TypeScript runtime           |
| **pnpm**              | `v10.18.0`                                   | Monorepo package manager (hoisted linker) |
| **Java**              | Eclipse Adoptium Temurin 17.0.18             | Android SDK Gradle builds                 |
| **Android SDK**       | API 33 / 34 build-tools, platform-tools      | Native Android runtime                    |
| **Android Emulator**  | `Pixel_3a_API_33_x86_64` (or Pixel 7 API 34) | Native mobile app emulation               |
| **Maestro CLI**       | `v2.11.0`                                    | End-to-end mobile flow testing            |
| **GitHub CLI (`gh`)** | `v2.78.0`                                    | GitHub repository and PR automation       |
| **Supabase CLI**      | `v2.1.1` (via `pnpm exec supabase`)          | Schema, migrations, edge functions        |
| **Vercel CLI**        | `v63.1.2` (via `pnpm dlx vercel`)            | Next.js admin & Expo web deployment       |
| **Expo EAS CLI**      | `v16.x` (via `pnpm dlx eas-cli`)             | Native Android preview APK builds         |

---

## 2. Monorepo Structure

```
CampusCycle/
  apps/
    admin/                Next.js 15 App Router admin portal (@campuscycle/admin)
    mobile/               Expo SDK 57 React Native rider app (@campuscycle/mobile)
  packages/
    shared/               Shared types, tokens, strings, formatters (@campuscycle/shared)
    torq/                 TORQ AI agent engine (@campuscycle/torq)
  scripts/                Automation helpers (db.mjs, fetch-fonts.mjs, gen-tokens.mjs, etc.)
  supabase/               Database migrations, config, and Edge Functions
  docs/                   Architecture, setup, and specification copies
    spec/                 Master specification documents
```

---

## 3. Hosted Infrastructure

CampusCycle currently uses a single free-tier Supabase project hosting both development and production. Task P3-T00 (`docs/spec/08-phases.md`) adds a second project, `campuscycle-dev`, for development, CI and tests, and from then on this one is production only:

- **Project Name:** `campuscycle`
- **Region:** `ap-south-1` (Mumbai)
- **Database Engine:** PostgreSQL 17 with PostGIS, pgvector, and pg_cron
- **Connection Mode:** Session pooler (`aws-0-ap-south-1.pooler.supabase.com:5432`)
- **Hosting Platforms:**
  - **Admin Web:** Vercel project `campuscycle` (`https://campuscycle.vercel.app`)
  - **Rider Web:** Vercel project `campuscycle-ride` (`https://campuscycle-ride.vercel.app`)
  - **Android APK:** GitHub Releases via Expo EAS preview profile

---

## 4. Local Development Runbook

### Environment Variables

Local secrets reside in gitignored `.env` (monorepo root) and app-specific `.env.local` files:

- `app/.env` — Master database URLs, service keys, owner credentials.
- `apps/admin/.env.local` — Admin client public variables (`NEXT_PUBLIC_*`).
- `apps/mobile/.env.local` — Mobile client public variables (`EXPO_PUBLIC_*`).

### Daily Commands

| Command                 | Action                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm check`            | Runs full formatting check, ESLint, TypeScript check, unit tests, and sync check.          |
| `pnpm format`           | Formats all files across the monorepo with Prettier.                                       |
| `pnpm dev:admin`        | Starts the Next.js admin development server at `http://localhost:3000`.                    |
| `pnpm dev:mobile`       | Starts the Expo Metro development bundler for the mobile rider app.                        |
| `pnpm db:push`          | Pushes pending database migrations to the hosted Supabase project.                         |
| `pnpm db:reset`         | Resets the database, re-applies migrations and seed data, and reseeds demo state.          |
| `pnpm db:types`         | Generates TypeScript definitions from the live Supabase schema into `@campuscycle/shared`. |
| `pnpm torq:sync`        | Syncs TORQ and shared modules into Supabase Edge Functions vendor directory.               |
| `pnpm functions:deploy` | Deploys all Edge Functions to the hosted project.                                          |

---

### Rider app (`apps/mobile`)

| Command                                                             | Action                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm --filter @campuscycle/mobile exec expo run:android`           | Builds the debug app, installs it on the running emulator and starts Metro.                |
| `pnpm --filter @campuscycle/mobile web`                             | Runs the rider app in a browser.                                                           |
| `pnpm --filter @campuscycle/mobile exec expo export --platform web` | Writes the static web build to `apps/mobile/dist` (what Vercel `campuscycle-ride` serves). |
| `pnpm --filter @campuscycle/mobile test`                            | Runs the jest-expo unit tests (gate, pass state, photo queue, push routes).                |
| `pnpm e2e:mobile`                                                   | Runs the Maestro flows in `e2e/mobile` against the app installed on the emulator.          |
| `pnpm fonts`                                                        | Downloads the eleven static TrueType fonts again. The script refuses any other format.     |

In a development build the route `/dev` (`campuscycle://dev`) shows every component and every Rider Pass state in the current theme. It redirects away in release builds.

The Maestro flows sign in as the demo rider and one of them creates an account, so they must only ever run against the dev project (`apps/mobile/.env.local` copied from the dev `.env`).

---

## 5. Continuous Deployment & Releases

Both web projects are connected directly to the GitHub repository:

- Any pull request or commit merged into `main` automatically triggers deployments on Vercel for both `campuscycle` and `campuscycle-ride`.
- Mobile release APKs are generated via the preview EAS workflow and attached to GitHub Releases for tag `v*`.
