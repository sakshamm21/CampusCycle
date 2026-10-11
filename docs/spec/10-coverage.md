# 10 · Coverage

Every product requirement in `plan.md`, with the spec sections that implement it. Use it as the final check before the Phase 6 pull request: each row must be true in the running product.

## 1. Product

| Requirement                                                                                                                               | Implemented in                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Named CampusCycle, generic for any campus, no college branding in code, copy, icons or URLs                                               | 01 §1; 06 §4; 04 R01; 05 A01                     |
| IITK is the first campus from public information (domain `iitk.ac.in`, IST, 10 stands from OpenStreetMap)                                 | 02b §20.1; 08 P2-T12                             |
| A new campus is added from the admin site without code                                                                                    | 05 A16; 02 §12 (`create_college`)                |
| Full launch quality, tested on Android emulators, publish-ready                                                                           | 08 P5; 09 §5–§6, §8                              |
| Free to ride, no payments                                                                                                                 | plan §2; no payment code anywhere                |
| Sign up, pick a college, that college's admin approves                                                                                    | 04 R04, R06; 05 A03; 02 §9–§10, §12              |
| Roll number required, college ID photo optional                                                                                           | 04 R04; 02 §5 (`profiles`)                       |
| Email domain match shown as a trust badge                                                                                                 | 02 §5 (`email_domain_match`); 05 A03             |
| Admin-only password reset                                                                                                                 | 04 R03; 05 A04; 03 §4.13                         |
| Owner account: Sak's personal email, permanent super admin, cannot be suspended, demoted or deleted; email stored in `private.app_config` | 02 §6, §9; 08 P1-T21, P1-T23; 09 §2.1 test 100   |
| The owner approves real IITK sign-ups until IITK has an admin                                                                             | 02 §6 (`notify_admins`); 05 A03                  |
| Demo rider, college admin and super admin: one-click login, always working, IITK members with `example.com` emails                        | 02b §17, §20.3; 04 R01, R02; 05 A01, `/try`      |
| Demo accounts skip the stand geofence and can ride from anywhere                                                                          | 02 §11; 04 §1.9, R12, R14                        |
| Demo data resets every night                                                                                                              | 02b §17; 01 §10                                  |
| Rider app plus an admin web app; rider features also in the browser                                                                       | 04 §4; 05 §1.3 (Rider app link), `/try`; 09 §8.5 |
| Android tested; iOS configured but untested                                                                                               | 01 §5.1.1; 09 §1, §5                             |
| Account deletion in the app and a public deletion page                                                                                    | 03 §4.12; 04 R19; 05 `/delete-account`           |

## 2. Borrowing and returning

| Requirement                                                                                                                      | Implemented in                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Each bike has a signed QR sticker; each rider a Rider Pass; scanning maps the bike to the pass until it is returned at any stand | 02 §11; 03 §5; 04 R11–R14                             |
| Borrow and return only at stands (geofence, accuracy, mock location checks)                                                      | 02 §11; 04 §1.4, R12, R14                             |
| One bike per pass and one pass per bike                                                                                          | 02 §2, §5 constraints; 09 §2.1 test 010               |
| Same bike must be scanned to return; a photo is taken                                                                            | 04 R14; 02 §11                                        |
| Ride limit, reminder, overdue, strikes, suspension (defaults 4 h, 3 strikes)                                                     | 02 §5 (`colleges`), 02b §14; 04 R13, R15; 09 test 050 |
| Can't reach a stand, lost bike, damaged sticker                                                                                  | 04 R13, R16; 05 A07, A08, A11                         |
| Pass scan and stand checks by admins                                                                                             | 05 A05; 02 §12                                        |
| Printable QR labels                                                                                                              | 05 A09                                                |
| Location read only at borrow and return                                                                                          | 04 §1.4; plan §4                                      |

## 3. Look and feel

| Requirement                                                                                                                                  | Implemented in                      |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Professional, Gen Z, clean but not boring                                                                                                    | 06 §1, §5                           |
| Inspired by Sync (lowercase heavy headlines, mono labels, stickers, pill buttons, floating dock, dark-first) without Sync's colours or fonts | 06 intro, §1–§3                     |
| Ink pass style with the Signal accent; accent is one constant                                                                                | 06 §2.1, §6.2                       |
| Dark and day themes with a switch                                                                                                            | 06 §1; 04 R19; 05 A18               |
| Rider Pass as the CRED-style hero card                                                                                                       | 06 §6; 04 R08                       |
| Pass tilt and shine                                                                                                                          | 06 §6.5; 04 R08                     |
| Flip to a live 30-second pass QR with stats                                                                                                  | 06 §6.4; 02 §10 (`get_my_pass_qr`)  |
| Mint animation on approval                                                                                                                   | 06 §6.5; 04 §1.3, R06, R08          |
| Slide to borrow, bike docks onto the pass                                                                                                    | 06 §5.11, §6.5; 04 R12, R13         |
| Returned stamp and finish level-up                                                                                                           | 06 §6.5; 04 R15                     |
| Shareable ride receipt                                                                                                                       | 04 R15; 06 §5.19                    |
| Finishes Graphite, Chrome, Holo                                                                                                              | 06 §6.1; 01 §10                     |
| Reference board is the visual source of truth                                                                                                | 06 intro; `reference/ui-board.html` |

## 4. TORQ

| Requirement                                                                        | Implemented in                                        |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Custom harness from scratch in TypeScript, no agent frameworks                     | 07 §1–§4; 01 §4.2                                     |
| Five agents: orchestrator, ride, inspector, ops, triage                            | 07 §1                                                 |
| Typed, role-scoped tools                                                           | 07 §5, §11.4                                          |
| Agent loop with limits and streaming steps                                         | 07 §4, §10; 03 §4.3                                   |
| Background agents                                                                  | 07 §9; 02b §16                                        |
| Memory and knowledge search (pgvector)                                             | 07 §8; 02b §15–§16                                    |
| Model router with fallbacks; cheapest good or free models on OpenRouter            | 07 §6                                                 |
| Guardrails (input, data wrapping, output)                                          | 07 §11                                                |
| Evals (~150 cases) gating changes                                                  | 07 §12; 09 §7                                         |
| Traces page                                                                        | 07 §10; 05 A14                                        |
| Eight AI features, each switchable per college                                     | 07 §1; 05 A12; 02b §15 (`ai_settings`)                |
| Agents act alone on low-risk work; anything affecting a person needs a confirm tap | 07 §1, §5.3–§5.4                                      |
| Never borrows or returns a bike, changes roles or deletes                          | 07 §1, §5                                             |
| US$5 monthly cap in our gateway and on the keys                                    | 07 §7; 01 §7; 08 P4-T01                               |
| Demo accounts share about 300 steps a day with a friendly limit message            | 07 §7; 03 §2.1 (`CC_AI_DEMO_POOL_EMPTY`)              |
| ID card checks only with consent and only on no-retention providers                | 04 R04; 07 §6.4, §9.2                                 |
| Replies in English, Hindi or Hinglish                                              | 07 §4, §13, §14; 07 §12.2 multilingual cases          |
| Voice input on device and spoken replies                                           | 04 R17; 05 A13; 07 §14                                |
| Every AI feature works for the demo accounts, including traces and usage           | 07 §15; 02b §17 (seeded thread and trace); 05 A14–A15 |

## 5. Platform, cost and delivery

| Requirement                                                                 | Implemented in                       |
| --------------------------------------------------------------------------- | ------------------------------------ |
| Expo rider app, Next.js admin, Supabase backend (SQL, not a document store) | 01 §2–§5; 02                         |
| Free tiers everywhere; only spend is OpenRouter credits                     | plan §3; 09 §7–§8                    |
| Fresh Supabase project created in Phase 0                                   | 08 P0-T09                            |
| Repo `github.com/sakshamm21/CampusCycle`, public at release                 | 01 §1; 08 P6-T07                     |
| Every commit authored as Sak with no Claude lines                           | 01 §1 (`commit-msg` hook); 08 P0-T02 |
| Admin site on Vercel from GitHub with Sak's account                         | 09 §8.6; 08 P0-T09                   |
| APK on GitHub Releases plus a store-ready bundle; store fees not paid       | 09 §8                                |
| Keep-alive so the free project never pauses                                 | 09 §7 (`keepalive.yml`)              |
| Build runs on Sak's PC via Remote Control in the CampusCycle folder         | 08 §1; START-HERE                    |
| Building starts only after Sak says go                                      | START-HERE; 08 §2                    |
| OpenRouter key entered by Sak, never in chat or the repo                    | 01 §7; 08 P4-T01                     |
