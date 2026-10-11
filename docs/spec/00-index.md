# 00 · Spec index

The spec turns `plan.md` into exact instructions. It decides every name, file, table, function, screen, string and test, so the builder never makes a product or design decision.

## 1. Reading order

| File                | Read                                                  |
| ------------------- | ----------------------------------------------------- |
| `01-conventions.md` | Fully, before the first task                          |
| `08-phases.md`      | Fully, then follow it task by task                    |
| Everything else     | The sections each task cites, when you reach the task |

## 2. Ids used across the spec

| Id                                | Meaning                                | Defined in                 |
| --------------------------------- | -------------------------------------- | -------------------------- |
| `P0-T01` … `P6-T09`               | Build tasks                            | 08                         |
| `R01` … `R19`                     | Rider app screens                      | 04 §3                      |
| `A01` … `A18`                     | Admin web pages                        | 05 §3                      |
| `Q1` … `Q15`                      | Named direct database queries          | 03 §3.6                    |
| `CC_*`                            | Error codes, each with exact user copy | 03 §2.1                    |
| `en.<screen>.<key>`               | User-facing strings                    | 01 §9; tables in 04 and 05 |
| Migrations 1–17                   | SQL files in `supabase/migrations/`    | 02 §1                      |
| Database test files `000`–`120`   | Database client tests (Vitest)         | 09 §2.1                    |
| Section references like `03 §4.3` | File number and section                | —                          |

## 3. Glossary

| Term                      | Meaning                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| College                   | One campus using CampusCycle (table `colleges`). IITK is the first                                                                                          |
| Stand                     | A marked parking spot with a GPS point, geofence radius and capacity. Bikes are borrowed and returned only at stands                                        |
| Bike code                 | A bike's short code, college prefix + number, like `K-042`                                                                                                  |
| Bike QR                   | The signed sticker payload `campuscycle://b/K-042?s=<sig>`                                                                                                  |
| Rider Pass                | A rider's digital card. Holds at most one bike, from borrow until return. Label like `IITK · 0421`                                                          |
| Pass QR                   | The signed, 30-second QR on the back of the pass that admins scan                                                                                           |
| Finish                    | The pass's look by ride count: Graphite, Chrome (10 rides), Holo (50)                                                                                       |
| Ride                      | One borrow-to-return period; `active`, `returned` or `force_returned`                                                                                       |
| Force return              | An admin ends a ride and places the bike at a stand, with a note                                                                                            |
| Strike                    | Added for a late return; reaching the college limit suspends the pass                                                                                       |
| Stand check               | An admin scans all bikes at a stand; the system lists seen, missing and unexpected bikes                                                                    |
| Owner                     | Sak's permanent super admin account, identified by the email in `private.app_config`                                                                        |
| Demo accounts             | `demo-rider`, `demo-admin`, `demo-super` at `example.com`, password `ride-the-demo-2026`; see only demo data; skip the geofence; reset nightly at 04:00 IST |
| TORQ                      | CampusCycle's AI agent system                                                                                                                               |
| Agent                     | One of orchestrator, ride, inspector, ops, triage                                                                                                           |
| Tool                      | A typed function an agent may call; `read` runs at once, `confirm` creates a confirm card                                                                   |
| Confirm card (ActionCard) | What a confirm tool shows; nothing changes until the person taps Confirm                                                                                    |
| Run / step                | One TORQ execution and each model call, tool call or check inside it; stored as a trace                                                                     |
| Step (budget)             | One model call, the unit of daily AI limits                                                                                                                 |
| Pool                      | Whose budget a run uses: `user:<id>`, `demo`, or `system:<college>`                                                                                         |
| Insight                   | A background TORQ result: digest, forecast, rebalancing or issue group                                                                                      |
| Route (model)             | An ordered list of models for one job: router, chat, vision, summary                                                                                        |
| Build session             | The coding agent building CampusCycle on Sak's PC                                                                                                           |
