# 02 · Database (Supabase Postgres)

This file and `02b-database-ai-demo.md` are the complete database (split only for size; read both). This file holds migrations 1 to 10; `02b` holds migrations 11 to 17, the seed and the database tests. Every migration below is copied **verbatim** into `supabase/migrations/` with the exact file name shown. Do not rename, reorder, merge or "improve" them. If a migration fails, fix only the line that fails and note it in the PR description.

Rules that apply to every SQL object in this file:

- All app tables live in `public`. Secrets, config and rate-limit counters live in `private`, which is never exposed through the API (Supabase exposes only `public` and `graphql_public`).
- Every function sets `set search_path = ''` and fully qualifies every name (`public.bikes`, `extensions.st_dwithin`, `auth.uid()`).
- Extensions live in schema `extensions` (Supabase default). PostGIS, pgcrypto and pgvector objects are therefore written `extensions.xxx`.
- Functions that riders call for borrowing and returning never raise for business errors. They return `jsonb` shaped `{ "ok": true, ... }` or `{ "ok": false, "code": "CC_...", "data": { ... } }` so that rate-limit counters are committed even on failure. Admin functions raise errors with `private.raise('CC_...')`; supabase-js returns them as `error.message = 'CC_...'` and `error.hint = '<json>'`.
- Error codes are listed in `03-api-and-functions.md` §2 with their user-facing copy.
- Times are `timestamptz`. Display times are converted to the college's `time_zone` in the client. Daily AI usage is bucketed by the **IST date** (`Asia/Kolkata`), because IITK is the only campus at launch; this is a deliberate simplification.

## 1. Migration order

| #   | File                                 | Contents                                                                                        |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | `20261012000001_extensions.sql`      | extensions, `private` schema, privileges                                                        |
| 2   | `20261012000002_enums.sql`           | all enum types                                                                                  |
| 3   | `20261012000003_core_tables.sql`     | colleges, profiles, stands, bikes, rider_passes, rides, issue_reports, notifications, audit_log |
| 4   | `20261012000004_private.sql`         | app_secrets, app_config, rate_limits, demo_bike_home, private helper functions                  |
| 5   | `20261012000005_auth_helpers.sql`    | role/college helper functions used by RLS and RPCs                                              |
| 6   | `20261012000006_rls.sql`             | RLS enable + every policy, column grants, views                                                 |
| 7   | `20261012000007_auth_triggers.sql`   | new-user trigger, owner/demo guards                                                             |
| 8   | `20261012000008_rider_functions.sql` | context, colleges list, applications, stands, pass QR, issues, notifications                    |
| 9   | `20261012000009_ride_functions.sql`  | preview_bike, borrow_bike, check_return_location, return_bike, attach_return_photo              |
| 10  | `20261012000010_admin_functions.sql` | approvals, users, rides, bikes, stands, scans, issues, settings, colleges, stats                |
| 11  | `20261012000011_storage.sql`         | buckets and storage policies                                                                    |
| 12  | `20261012000012_notify_and_cron.sql` | `private.call_function`, push trigger, ride timers, cron jobs                                   |
| 13  | `20261012000013_ai_tables.sql`       | the 11 `ai_*` tables, indexes, RLS                                                              |
| 14  | `20261012000014_ai_functions.sql`    | vector search, usage, settings, insights, forecast, AI queue triggers, sweep, AI cron           |
| 15  | `20261012000015_demo.sql`            | demo account setup, history generator, demo reset, demo cron                                    |
| 16  | `20261012000016_realtime.sql`        | realtime publication                                                                            |
| 17  | `20261012000017_extras.sql`          | `demo_qr_samples` (public demo page), `colleges_overview` (super admin)                         |

Seed files (`02b-database-ai-demo.md` §20) live in `supabase/seed/` and are applied on the dev project by `pnpm db:reset` and on the production project by `pnpm db:push:prod` (`supabase db push --include-seed`), see 01 §6.1. Tests (`02b` §21) live in `supabase/tests/database/`.

## 2. Entity overview

```
colleges 1─* profiles 1─1 rider_passes 1─0..1 bikes (current_bike_id / current_pass_id, both UNIQUE)
colleges 1─* stands 1─* bikes (current_stand_id)
rider_passes 1─* rides *─1 bikes ; rides *─1 stands (start/end)
profiles 1─* issue_reports *─0..1 bikes/rides/stands ; issue_reports *─0..1 ai_insights (group_id)
profiles 1─* notifications ; audit_log (actor_id, confirmed_by → profiles)
profiles 1─* ai_threads 1─* ai_messages ; ai_runs 1─* ai_steps ; ai_runs 1─* ai_actions
profiles 1─* ai_memories ; colleges 1─* ai_knowledge, ai_insights, ai_settings ; ai_usage ; ai_evals
```

"One bike per pass, one pass per bike" is enforced four times: (1) `rider_passes.current_bike_id UNIQUE`, (2) `bikes.current_pass_id UNIQUE`, (3) check constraints tying status to those columns, (4) a deferred constraint trigger that checks both sides point at each other, plus partial unique indexes on active rides per bike and per pass. The RPCs lock rows with `FOR UPDATE` so two people can never take the same bike.

## 3. Migration 1: `20261012000001_extensions.sql`

```sql
-- Extensions (Supabase installs these into schema "extensions")
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Private schema: never exposed through PostgREST
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- New functions in private are not executable by anyone unless granted explicitly
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon, authenticated;
```

## 4. Migration 2: `20261012000002_enums.sql`

```sql
create type public.user_role as enum ('rider', 'college_admin', 'super_admin');
create type public.profile_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.pass_status as enum ('pending', 'ready', 'riding', 'overdue', 'suspended');
create type public.bike_status as enum ('available', 'borrowed', 'maintenance', 'missing', 'retired');
create type public.ride_status as enum ('active', 'returned', 'force_returned');
create type public.issue_status as enum ('open', 'in_progress', 'resolved');
create type public.issue_type as enum (
  'flat_tyre', 'brakes', 'chain', 'damaged_qr', 'bike_missing', 'accident', 'ride_close_request', 'other'
);
create type public.photo_check as enum ('pending', 'ok', 'unclear', 'failed', 'skipped');
create type public.notification_kind as enum (
  'approval', 'rejection', 'ride_reminder', 'ride_overdue', 'ride_closed', 'strike', 'suspension',
  'reinstated', 'issue_update', 'password_reset', 'admin_alert', 'torq'
);
create type public.ai_agent as enum ('orchestrator', 'ride', 'inspector', 'ops', 'triage');
create type public.ai_run_status as enum ('running', 'done', 'failed', 'stopped_by_guardrail', 'over_budget');
create type public.ai_action_status as enum ('proposed', 'confirmed', 'done', 'cancelled', 'expired', 'failed');
create type public.ai_step_kind as enum ('context', 'model_call', 'tool_call', 'guardrail', 'router_fallback');
create type public.ai_insight_kind as enum ('digest', 'forecast', 'rebalancing', 'issue_group');
create type public.ai_insight_status as enum ('active', 'accepted', 'dismissed', 'expired');
create type public.ai_trigger as enum (
  'chat', 'console', 'photo_check', 'id_check', 'issue_suggest', 'issue_triage', 'morning', 'eval'
);
```

## 5. Migration 3: `20261012000003_core_tables.sql`

```sql
-- ---------- colleges ----------
create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  short_code text not null unique check (short_code ~ '^[A-Z]{2,6}$'),
  bike_prefix text not null unique check (bike_prefix ~ '^[A-Z]{1,3}$'),
  email_domains text[] not null default '{}',
  time_zone text not null default 'Asia/Kolkata',
  max_ride_minutes int not null default 240 check (max_ride_minutes between 15 and 1440),
  strike_limit int not null default 3 check (strike_limit between 1 and 10),
  default_geofence_m int not null default 40 check (default_geofence_m between 10 and 300),
  rules_text text not null default '' check (char_length(rules_text) <= 8000),
  center_lat double precision check (center_lat between -90 and 90),
  center_lng double precision check (center_lng between -180 and 180),
  next_pass_no int not null default 1001 check (next_pass_no between 1 and 9999),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  college_id uuid references public.colleges (id) on delete set null,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text not null default '' check (char_length(phone) <= 20),
  roll_number text not null default '' check (char_length(roll_number) <= 40),
  role public.user_role not null default 'rider',
  status public.profile_status not null default 'pending',
  email_domain_match boolean not null default false,
  id_photo_path text,
  id_check_consent boolean not null default false,
  id_check_result jsonb,
  id_check_attempts smallint not null default 0,
  strikes int not null default 0 check (strikes >= 0),
  push_token text,
  notif_prefs jsonb not null default '{"approval": true, "reminders": true, "issues": true}'::jsonb,
  theme text not null default 'system' check (theme in ('system', 'dark', 'day')),
  rules_accepted_at timestamptz,
  applied_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  suspended_reason text,
  password_reset_requested_at timestamptz,
  is_demo boolean not null default false,
  demo_role text check (demo_role in ('rider', 'college_admin', 'super_admin')),
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_one_owner on public.profiles (is_owner) where is_owner;
create unique index profiles_one_demo_per_role on public.profiles (demo_role) where demo_role is not null;
create index profiles_college_status on public.profiles (college_id, status);
create index profiles_email on public.profiles (email);

-- ---------- stands ----------
create table public.stands (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(Point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  radius_m int not null default 40 check (radius_m between 10 and 300),
  capacity int not null default 8 check (capacity between 1 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (college_id, name)
);
create index stands_location_gix on public.stands using gist (location);
create index stands_college on public.stands (college_id);

-- ---------- bikes ----------
create table public.bikes (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  short_code text not null unique check (short_code ~ '^[A-Z]{1,3}-[0-9]{3,4}$'),
  status public.bike_status not null default 'available',
  current_stand_id uuid references public.stands (id) on delete set null,
  current_pass_id uuid unique,
  last_seen_at timestamptz,
  last_seen_stand_id uuid references public.stands (id) on delete set null,
  maintenance_after_return boolean not null default false,
  ai_flag text,
  notes text not null default '' check (char_length(notes) <= 500),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bikes_borrowed_iff_pass check ((status = 'borrowed') = (current_pass_id is not null)),
  constraint bikes_borrowed_has_no_stand check (status <> 'borrowed' or current_stand_id is null)
);
create index bikes_college_status on public.bikes (college_id, status);
create index bikes_stand on public.bikes (current_stand_id);

-- ---------- rider_passes ----------
create table public.rider_passes (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null unique references public.profiles (id) on delete cascade,
  college_id uuid references public.colleges (id) on delete set null,
  pass_number int check (pass_number between 1 and 9999),
  status public.pass_status not null default 'pending',
  current_bike_id uuid unique references public.bikes (id) on delete restrict,
  current_ride_id uuid unique,
  borrowed_at timestamptz,
  total_rides int not null default 0 check (total_rides >= 0),
  total_minutes int not null default 0 check (total_minutes >= 0),
  issued_at timestamptz,
  minted_seen_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (college_id, pass_number),
  constraint passes_bike_iff_riding check ((status in ('riding', 'overdue')) = (current_bike_id is not null)),
  constraint passes_ride_iff_bike check ((current_bike_id is null) = (current_ride_id is null))
);

alter table public.bikes
  add constraint bikes_current_pass_fk foreign key (current_pass_id)
  references public.rider_passes (id) on delete restrict;

-- ---------- rides ----------
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  rider_id uuid references public.profiles (id) on delete set null,
  pass_id uuid references public.rider_passes (id) on delete set null,
  bike_id uuid not null references public.bikes (id) on delete cascade,
  start_stand_id uuid references public.stands (id) on delete set null,
  end_stand_id uuid references public.stands (id) on delete set null,
  started_at timestamptz not null default now(),
  due_at timestamptz not null,
  ended_at timestamptz,
  start_lat double precision, start_lng double precision, start_accuracy_m double precision,
  end_lat double precision, end_lng double precision, end_accuracy_m double precision,
  status public.ride_status not null default 'active',
  is_overdue boolean not null default false,
  overdue_at timestamptz,
  reminder_sent_at timestamptz,
  late boolean not null default false,
  return_photo_path text,
  photo_check public.photo_check not null default 'pending',
  photo_check_note text,
  photo_check_attempts smallint not null default 0,
  flags text[] not null default '{}',
  force_note text,
  forced_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint rides_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint rides_active_has_no_end check ((status = 'active') = (ended_at is null))
);
create unique index rides_one_active_per_bike on public.rides (bike_id) where status = 'active';
create unique index rides_one_active_per_pass on public.rides (pass_id) where status = 'active';
create index rides_college_started on public.rides (college_id, started_at desc);
create index rides_rider_started on public.rides (rider_id, started_at desc);
create index rides_active_due on public.rides (due_at) where status = 'active';

alter table public.rider_passes
  add constraint passes_current_ride_fk foreign key (current_ride_id)
  references public.rides (id) on delete set null;

-- ---------- issue_reports ----------
create table public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  bike_id uuid references public.bikes (id) on delete set null,
  ride_id uuid references public.rides (id) on delete set null,
  stand_id uuid references public.stands (id) on delete set null,
  type public.issue_type not null,
  note text not null default '' check (char_length(note) <= 1000),
  photo_path text,
  status public.issue_status not null default 'open',
  ai_suggested_type public.issue_type,
  group_id uuid,
  urgency smallint check (urgency between 1 and 5),
  triaged_at timestamptz,
  triage_attempts smallint not null default 0,
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  source text not null default 'app' check (source in ('app', 'admin', 'torq')),
  is_demo boolean not null default false,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index issues_college_status on public.issue_reports (college_id, status, created_at desc);
create index issues_bike on public.issue_reports (bike_id);

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  college_id uuid references public.colleges (id) on delete set null,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  pushed_at timestamptz,
  push_error text,
  created_at timestamptz not null default now()
);
create index notifications_user_created on public.notifications (user_id, created_at desc);

-- ---------- audit_log ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  college_id uuid references public.colleges (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  via text not null default 'app' check (via in ('app', 'admin', 'torq', 'system', 'cron')),
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index audit_college_created on public.audit_log (college_id, created_at desc);

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger colleges_touch before update on public.colleges for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger stands_touch before update on public.stands for each row execute function public.touch_updated_at();
create trigger bikes_touch before update on public.bikes for each row execute function public.touch_updated_at();
create trigger passes_touch before update on public.rider_passes for each row execute function public.touch_updated_at();
create trigger issues_touch before update on public.issue_reports for each row execute function public.touch_updated_at();
```

## 6. Migration 4: `20261012000004_private.sql`

```sql
-- ---------- private tables (no grants to anon/authenticated, ever) ----------
create table private.app_secrets (
  key text primary key,
  value text not null
);

create table private.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table private.rate_limits (
  key text not null,
  action text not null,
  count int not null default 0,
  window_start timestamptz not null default now(),
  primary key (key, action)
);

-- Home stand of each seeded demo bike (used by the nightly demo reset)
create table private.demo_bike_home (
  short_code text primary key,
  stand_name text not null
);

revoke all on all tables in schema private from public, anon, authenticated;

-- QR signing secrets are generated inside the database and never leave it.
insert into private.app_secrets (key, value) values
  ('bike_qr_secret', encode(extensions.gen_random_bytes(32), 'hex')),
  ('pass_qr_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Placeholder defaults. Real values are written after migrations: on the dev project by
-- `scripts/db.mjs reset` (01 §6.1); on the production project by Sak in the SQL editor
-- (08-phases.md P1-T21). Never commit real values.
insert into private.app_config (key, value) values
  ('owner_email', ''),
  ('functions_base_url', 'https://example.supabase.co/functions/v1'),
  ('internal_secret', 'placeholder-internal-secret'),
  ('last_demo_reset_at', '')
on conflict (key) do nothing;

-- ---------- helpers ----------
create or replace function private.config(p_key text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select value from private.app_config where key = p_key), '')
$$;

create or replace function private.set_config_value(p_key text, p_value text) returns void
language sql security definer set search_path = '' as $$
  insert into private.app_config (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now()
$$;

create or replace function private.raise(p_code text, p_data jsonb default '{}'::jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using message = p_code, hint = p_data::text, errcode = 'P0001';
end $$;

create or replace function private.err(p_code text, p_data jsonb default '{}'::jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false, 'code', p_code, 'data', p_data)
$$;

create or replace function private.b64url(p_bytes bytea) returns text
language sql immutable set search_path = '' as $$
  select rtrim(translate(encode(p_bytes, 'base64'), E'+/\n', '-_'), '=')
$$;

-- Bike QR signature: first 16 bytes of HMAC-SHA256(bike_qr_secret, 'b|' || CODE), base64url (22 chars)
create or replace function private.sign_bike(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select private.b64url(substring(
    extensions.hmac(
      convert_to('b|' || upper(p_code), 'UTF8'),
      convert_to((select value from private.app_secrets where key = 'bike_qr_secret'), 'UTF8'),
      'sha256')
    from 1 for 16))
$$;

-- Pass QR signature: first 16 bytes of HMAC-SHA256(pass_qr_secret, 'p|' || pass_id || '|' || window)
create or replace function private.sign_pass(p_pass_id uuid, p_window bigint) returns text
language sql stable security definer set search_path = '' as $$
  select private.b64url(substring(
    extensions.hmac(
      convert_to('p|' || p_pass_id::text || '|' || p_window::text, 'UTF8'),
      convert_to((select value from private.app_secrets where key = 'pass_qr_secret'), 'UTF8'),
      'sha256')
    from 1 for 16))
$$;

create or replace function private.bike_payload(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select 'campuscycle://b/' || upper(p_code) || '?s=' || private.sign_bike(p_code)
$$;

-- Counts one attempt and returns false when the limit is exceeded. Never raises,
-- so callers that return error jsonb still commit the counter.
create or replace function private.rate_ok(p_key text, p_action text, p_max int, p_window interval)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  insert into private.rate_limits as r (key, action, count, window_start)
  values (p_key, p_action, 1, now())
  on conflict (key, action) do update set
    count = case when r.window_start < now() - p_window then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;

create or replace function private.pass_label(p_short_code text, p_number int) returns text
language sql immutable set search_path = '' as $$
  select case when p_number is null or p_short_code is null then null
              else p_short_code || ' · ' || lpad(p_number::text, 4, '0') end
$$;

create or replace function private.finish_for(p_rides int) returns text
language sql immutable set search_path = '' as $$
  select case when p_rides >= 50 then 'holo' when p_rides >= 10 then 'chrome' else 'graphite' end
$$;

create or replace function private.ist_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- Constraint trigger: a bike and a pass must point at each other (checked at commit)
create or replace function private.check_bike_pass_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pass uuid; v_bike uuid;
begin
  if tg_table_name = 'bikes' then
    select current_pass_id into v_pass from public.bikes where id = new.id;
    if v_pass is not null and not exists (
      select 1 from public.rider_passes p where p.id = v_pass and p.current_bike_id = new.id) then
      raise exception using message = 'CC_INTEGRITY_BIKE_PASS', errcode = 'P0001';
    end if;
  else
    select current_bike_id into v_bike from public.rider_passes where id = new.id;
    if v_bike is not null and not exists (
      select 1 from public.bikes b where b.id = v_bike and b.current_pass_id = new.id) then
      raise exception using message = 'CC_INTEGRITY_BIKE_PASS', errcode = 'P0001';
    end if;
  end if;
  return null;
end $$;

create constraint trigger bikes_pass_link after insert or update on public.bikes
  deferrable initially deferred for each row execute function private.check_bike_pass_link();
create constraint trigger passes_bike_link after insert or update on public.rider_passes
  deferrable initially deferred for each row execute function private.check_bike_pass_link();
```

## 7. Migration 5: `20261012000005_auth_helpers.sql`

These functions are `security definer` so RLS policies can call them without recursion. They are the only `private` functions granted to `authenticated`.

```sql
create or replace function private.me_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.me_college() returns uuid
language sql stable security definer set search_path = '' as $$
  select college_id from public.profiles where id = auth.uid()
$$;

create or replace function private.me_is_demo() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_demo from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
$$;

create or replace function private.is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and status = 'approved' and role = 'super_admin')
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and status = 'approved' and role in ('college_admin', 'super_admin'))
$$;

create or replace function private.is_admin_of(p_college uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
      and (role = 'super_admin' or (role = 'college_admin' and college_id = p_college)))
$$;

-- Demo users see only demo rows; real users see everything they are otherwise allowed to see.
create or replace function private.demo_ok(p_row_is_demo boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select (not private.me_is_demo()) or coalesce(p_row_is_demo, false)
$$;

-- Raises CC_FORBIDDEN unless the caller administers the college
create or replace function private.require_admin_of(p_college uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_of(p_college) then perform private.raise('CC_FORBIDDEN'); end if;
end $$;

-- Raises CC_DEMO_FORBIDDEN when a demo caller targets a real (non-demo) row
create or replace function private.require_demo_scope(p_target_is_demo boolean) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.me_is_demo() and not coalesce(p_target_is_demo, false) then
    perform private.raise('CC_DEMO_FORBIDDEN');
  end if;
end $$;

-- Raises CC_DEMO_READONLY for demo callers (college settings, stands, colleges, roles, AI routes)
create or replace function private.require_not_demo() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.me_is_demo() then perform private.raise('CC_DEMO_READONLY'); end if;
end $$;

-- ---------- audit + notifications ----------
create or replace function private.audit(
  p_college uuid, p_action text, p_target_type text, p_target_id text,
  p_details jsonb default '{}'::jsonb, p_via text default 'admin', p_confirmed_by uuid default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (college_id, actor_id, confirmed_by, via, action, target_type, target_id, details, is_demo)
  values (p_college, auth.uid(), p_confirmed_by, p_via, p_action, p_target_type, p_target_id,
          coalesce(p_details, '{}'::jsonb), private.me_is_demo())
$$;

create or replace function private.notify(
  p_user uuid, p_kind public.notification_kind, p_title text, p_body text, p_data jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, college_id, kind, title, body, data)
  select p_user, p.college_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.profiles p where p.id = p_user
$$;

-- Notifies approved college admins of the college with matching demo flag.
-- Real events with no real college admin go to the owner (who approves IITK until it has an admin).
create or replace function private.notify_admins(
  p_college uuid, p_kind public.notification_kind, p_title text, p_body text,
  p_data jsonb default '{}'::jsonb, p_is_demo boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  insert into public.notifications (user_id, college_id, kind, title, body, data)
  select p.id, p_college, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.profiles p
  where p.role = 'college_admin' and p.status = 'approved' and p.college_id = p_college
    and p.is_demo = coalesce(p_is_demo, false);
  get diagnostics v_count = row_count;
  if v_count = 0 and not coalesce(p_is_demo, false) then
    insert into public.notifications (user_id, college_id, kind, title, body, data)
    select p.id, p_college, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb)
    from public.profiles p where p.is_owner;
  end if;
end $$;

grant execute on function
  private.me_role(), private.me_college(), private.me_is_demo(), private.is_approved(),
  private.is_super(), private.is_admin(), private.is_admin_of(uuid), private.demo_ok(boolean)
to anon, authenticated;
```

## 8. Migration 6: `20261012000006_rls.sql`

Clients may **read** through RLS. They may **write** only: their own `profiles` columns listed in the column grant, nothing else. Every other write goes through a `security definer` RPC.

```sql
alter table public.colleges enable row level security;
alter table public.profiles enable row level security;
alter table public.stands enable row level security;
alter table public.bikes enable row level security;
alter table public.rider_passes enable row level security;
alter table public.rides enable row level security;
alter table public.issue_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Default deny for writes from clients
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

-- profiles: a user may update only these columns on their own row
grant update (phone, push_token, notif_prefs, theme) on public.profiles to authenticated;

-- ---------- colleges ----------
create policy colleges_read on public.colleges for select to anon, authenticated
  using (active or private.is_super());

-- ---------- profiles ----------
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_read_admin on public.profiles for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));
create policy profiles_read_super_no_college on public.profiles for select to authenticated
  using (college_id is null and private.is_super());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- stands ----------
create policy stands_read on public.stands for select to authenticated
  using (college_id = private.me_college() or private.is_admin_of(college_id));

-- ---------- bikes ----------
create policy bikes_read_rider on public.bikes for select to authenticated
  using (college_id = private.me_college() and private.is_approved() and is_demo = private.me_is_demo());
create policy bikes_read_admin on public.bikes for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- rider_passes ----------
create policy passes_read_own on public.rider_passes for select to authenticated
  using (rider_id = (select auth.uid()));
create policy passes_read_admin on public.rider_passes for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- rides ----------
create policy rides_read_own on public.rides for select to authenticated
  using (rider_id = (select auth.uid()));
create policy rides_read_admin on public.rides for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- issue_reports ----------
create policy issues_read_own on public.issue_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy issues_read_admin on public.issue_reports for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- notifications ----------
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- audit_log ----------
create policy audit_read_admin on public.audit_log for select to authenticated
  using ((private.is_admin_of(college_id) or (college_id is null and private.is_super()))
         and private.demo_ok(is_demo));

-- ---------- admin views (security_invoker: RLS of the caller applies) ----------
create or replace view public.admin_users_v with (security_invoker = true) as
select p.id, p.college_id, c.short_code as college_code, c.name as college_name,
       p.email, p.full_name, p.phone, p.roll_number, p.role, p.status, p.strikes,
       p.email_domain_match, p.id_photo_path, p.id_check_consent, p.id_check_result,
       p.applied_at, p.approved_at, p.rejection_reason, p.suspended_reason,
       p.password_reset_requested_at, p.is_demo, p.demo_role, p.is_owner, p.created_at,
       rp.id as pass_id, rp.status as pass_status, rp.pass_number,
       public.pass_label_of(c.short_code, rp.pass_number) as pass_label,
       rp.total_rides, rp.total_minutes, rp.borrowed_at,
       b.short_code as bike_code, rp.current_ride_id
from public.profiles p
left join public.colleges c on c.id = p.college_id
left join public.rider_passes rp on rp.rider_id = p.id
left join public.bikes b on b.id = rp.current_bike_id;

create or replace view public.admin_rides_v with (security_invoker = true) as
select r.id, r.college_id, r.rider_id, p.full_name as rider_name,
       public.pass_label_of(c.short_code, rp.pass_number) as pass_label,
       b.short_code as bike_code, r.bike_id,
       r.start_stand_id, ss.name as start_stand_name, r.end_stand_id, es.name as end_stand_name,
       r.started_at, r.due_at, r.ended_at, r.status, r.is_overdue, r.late,
       r.return_photo_path, r.photo_check, r.photo_check_note, r.flags, r.force_note, r.is_demo,
       case when r.ended_at is null then null
            else greatest(1, ceil(extract(epoch from (r.ended_at - r.started_at)) / 60))::int end as minutes
from public.rides r
join public.colleges c on c.id = r.college_id
join public.bikes b on b.id = r.bike_id
left join public.profiles p on p.id = r.rider_id
left join public.rider_passes rp on rp.id = r.pass_id
left join public.stands ss on ss.id = r.start_stand_id
left join public.stands es on es.id = r.end_stand_id;

create or replace view public.admin_bikes_v with (security_invoker = true) as
select b.id, b.college_id, b.short_code, b.status, b.current_stand_id, s.name as stand_name,
       b.last_seen_at, b.last_seen_stand_id, ls.name as last_seen_stand_name,
       b.maintenance_after_return, b.ai_flag, b.notes, b.is_demo, b.created_at,
       rp.id as pass_id, public.pass_label_of(c.short_code, rp.pass_number) as pass_label,
       p.full_name as holder_name, rp.borrowed_at
from public.bikes b
join public.colleges c on c.id = b.college_id
left join public.stands s on s.id = b.current_stand_id
left join public.stands ls on ls.id = b.last_seen_stand_id
left join public.rider_passes rp on rp.id = b.current_pass_id
left join public.profiles p on p.id = rp.rider_id;

create or replace view public.admin_issues_v with (security_invoker = true) as
select i.id, i.college_id, i.type, i.note, i.photo_path, i.status, i.ai_suggested_type,
       i.group_id, i.urgency, i.triaged_at, i.source, i.is_demo, i.created_at, i.updated_at,
       i.resolved_at, i.resolution_note,
       i.reporter_id, rp.full_name as reporter_name,
       i.bike_id, b.short_code as bike_code, b.status as bike_status,
       i.stand_id, s.name as stand_name, i.ride_id,
       i.assigned_to, ap.full_name as assignee_name
from public.issue_reports i
left join public.profiles rp on rp.id = i.reporter_id
left join public.bikes b on b.id = i.bike_id
left join public.stands s on s.id = i.stand_id
left join public.profiles ap on ap.id = i.assigned_to;

grant select on public.admin_users_v, public.admin_rides_v, public.admin_bikes_v, public.admin_issues_v
  to authenticated;
```

The views call `public.pass_label_of`, a public immutable wrapper (views run with the caller's privileges, and `private` functions are not granted to clients). Put this function **at the top of migration 6**, before the views:

```sql
create or replace function public.pass_label_of(p_short_code text, p_number int) returns text
language sql immutable set search_path = '' as $$
  select case when p_number is null or p_short_code is null then null
              else p_short_code || ' · ' || lpad(p_number::text, 4, '0') end
$$;
```

## 9. Migration 7: `20261012000007_auth_triggers.sql`

```sql
-- New auth user → profile + pending pass. Role is NEVER taken from client metadata.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_owner_email text := private.config('owner_email');
  v_is_owner boolean := v_owner_email <> '' and lower(new.email) = lower(v_owner_email);
  v_college uuid;
  v_domains text[];
  v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if not v_is_owner then
    begin
      v_college := nullif(v_meta ->> 'college_id', '')::uuid;
    exception when others then
      v_college := null;
    end;
    if v_college is not null and not exists (select 1 from public.colleges where id = v_college and active) then
      v_college := null;
    end if;
  end if;

  select email_domains into v_domains from public.colleges where id = v_college;

  insert into public.profiles (
    id, college_id, email, full_name, phone, roll_number, role, status,
    email_domain_match, id_check_consent, rules_accepted_at, is_owner, approved_at)
  values (
    new.id, v_college, lower(coalesce(new.email, '')),
    left(coalesce(v_meta ->> 'full_name', ''), 120),
    left(coalesce(v_meta ->> 'phone', ''), 20),
    left(coalesce(v_meta ->> 'roll_number', ''), 40),
    case when v_is_owner then 'super_admin'::public.user_role else 'rider'::public.user_role end,
    case when v_is_owner then 'approved'::public.profile_status else 'pending'::public.profile_status end,
    coalesce(v_domain = any (v_domains), false),
    coalesce((v_meta ->> 'id_check_consent')::boolean, false),
    case when (v_meta ->> 'rules_accepted') = 'true' then now() end,
    v_is_owner,
    case when v_is_owner then now() end);

  insert into public.rider_passes (rider_id, college_id, status)
  values (new.id, v_college, 'pending');

  if not v_is_owner and v_college is not null then
    perform private.notify_admins(
      v_college, 'admin_alert', 'New rider waiting',
      coalesce(nullif(v_meta ->> 'full_name', ''), 'Someone') || ' asked to join.',
      jsonb_build_object('user_id', new.id, 'screen', 'approvals'), false);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Owner can never be demoted, suspended or deleted. Protected demo logins can never be
-- suspended, rejected or demoted.
create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_owner then perform private.raise('CC_OWNER_PROTECTED'); end if;
    return old;
  end if;
  if old.is_owner and (new.role <> 'super_admin' or new.status <> 'approved' or not new.is_owner) then
    perform private.raise('CC_OWNER_PROTECTED');
  end if;
  if old.demo_role is not null and (new.status in ('suspended', 'rejected') or new.role::text <> old.demo_role) then
    perform private.raise('CC_DEMO_PROTECTED');
  end if;
  return new;
end $$;

create trigger profiles_guard before update or delete on public.profiles
  for each row execute function private.guard_profile();

-- Protected demo logins keep their password and email forever: any change is refused.
create or replace function private.guard_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = old.id and p.demo_role is not null) then
    if new.encrypted_password is distinct from old.encrypted_password
       or new.email is distinct from old.email then
      raise exception using message = 'CC_DEMO_PROTECTED', errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger auth_user_guard before update on auth.users
  for each row execute function private.guard_auth_user();
```

Note: the demo guard is installed **after** `scripts/seed-auth.mjs` sets demo passwords at creation time (insert, not update), so seeding is unaffected. The script never updates demo passwords; if a demo password must change, drop and recreate the user.

## 10. Migration 8: `20261012000008_rider_functions.sql`

```sql
-- ---------- boot context for both apps ----------
create or replace function public.get_my_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles%rowtype;
  v_c public.colleges%rowtype;
  v_pass public.rider_passes%rowtype;
  v_ride jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_p from public.profiles where id = v_uid;
  if not found then return null; end if;
  select * into v_c from public.colleges where id = v_p.college_id;
  select * into v_pass from public.rider_passes where rider_id = v_uid;

  if v_pass.current_ride_id is not null then
    select jsonb_build_object(
      'id', r.id, 'bike_code', b.short_code, 'bike_id', b.id,
      'start_stand_id', r.start_stand_id, 'start_stand_name', s.name,
      'started_at', r.started_at, 'due_at', r.due_at, 'is_overdue', r.is_overdue)
    into v_ride
    from public.rides r
    join public.bikes b on b.id = r.bike_id
    left join public.stands s on s.id = r.start_stand_id
    where r.id = v_pass.current_ride_id;
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_p.id, 'email', v_p.email, 'full_name', v_p.full_name, 'phone', v_p.phone,
      'roll_number', v_p.roll_number, 'role', v_p.role, 'status', v_p.status,
      'strikes', v_p.strikes, 'is_demo', v_p.is_demo, 'demo_role', v_p.demo_role,
      'is_owner', v_p.is_owner, 'theme', v_p.theme, 'notif_prefs', v_p.notif_prefs,
      'applied_at', v_p.applied_at, 'approved_at', v_p.approved_at,
      'rejection_reason', v_p.rejection_reason, 'suspended_reason', v_p.suspended_reason,
      'id_photo_path', v_p.id_photo_path, 'id_check_consent', v_p.id_check_consent,
      'email_domain_match', v_p.email_domain_match, 'college_id', v_p.college_id),
    'college', case when v_c.id is null then null else jsonb_build_object(
      'id', v_c.id, 'name', v_c.name, 'short_code', v_c.short_code, 'time_zone', v_c.time_zone,
      'max_ride_minutes', v_c.max_ride_minutes, 'strike_limit', v_c.strike_limit,
      'default_geofence_m', v_c.default_geofence_m, 'rules_text', v_c.rules_text,
      'center_lat', v_c.center_lat, 'center_lng', v_c.center_lng) end,
    'pass', jsonb_build_object(
      'id', v_pass.id, 'status', v_pass.status, 'pass_number', v_pass.pass_number,
      'label', private.pass_label(v_c.short_code, v_pass.pass_number),
      'total_rides', v_pass.total_rides, 'total_minutes', v_pass.total_minutes,
      'finish', private.finish_for(v_pass.total_rides), 'issued_at', v_pass.issued_at,
      'minted_seen_at', v_pass.minted_seen_at, 'borrowed_at', v_pass.borrowed_at),
    'ride', v_ride);
end $$;

-- ---------- public college list for sign-up (anon) ----------
create or replace function public.list_colleges_public()
returns table (id uuid, name text, short_code text, email_domains text[])
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.short_code, c.email_domains
  from public.colleges c where c.active order by c.name
$$;

-- ---------- health (anon; used by the keep-alive ping) ----------
create or replace function public.health() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', true, 'time', now(),
                            'last_demo_reset_at', nullif(private.config('last_demo_reset_at'), ''))
$$;

-- ---------- password reset request (anon). Always returns ok to avoid account enumeration ----------
create or replace function public.request_password_reset(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.profiles%rowtype;
begin
  if not private.rate_ok('email:' || lower(trim(coalesce(p_email, ''))), 'password_reset', 3, interval '1 day') then
    return jsonb_build_object('ok', true);
  end if;
  select * into v_p from public.profiles where email = lower(trim(p_email));
  if found and not v_p.is_owner and v_p.demo_role is null and v_p.college_id is not null then
    update public.profiles set password_reset_requested_at = now() where id = v_p.id;
    perform private.notify_admins(v_p.college_id, 'admin_alert', 'Password reset requested',
      coalesce(nullif(v_p.full_name, ''), v_p.email) || ' asked for a new password.',
      jsonb_build_object('user_id', v_p.id, 'screen', 'users'), v_p.is_demo);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- edit or re-submit an application (pending or rejected only) ----------
create or replace function public.update_application(
  p_full_name text, p_phone text, p_roll_number text, p_college_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.profiles%rowtype; v_domains text[]; v_was text;
begin
  select * into v_p from public.profiles where id = auth.uid() for update;
  if not found then perform private.raise('CC_NOT_SIGNED_IN'); end if;
  if v_p.status not in ('pending', 'rejected') then perform private.raise('CC_NOT_EDITABLE'); end if;
  if char_length(trim(p_full_name)) < 2 or char_length(trim(p_roll_number)) < 2 or char_length(trim(p_phone)) < 8 then
    perform private.raise('CC_INVALID_INPUT');
  end if;
  select email_domains into v_domains from public.colleges where id = p_college_id and active;
  if not found then perform private.raise('CC_COLLEGE_NOT_FOUND'); end if;
  v_was := v_p.status::text;
  update public.profiles set
    full_name = trim(p_full_name), phone = trim(p_phone), roll_number = trim(p_roll_number),
    college_id = p_college_id, status = 'pending', rejection_reason = null,
    applied_at = case when v_was = 'rejected' then now() else applied_at end,
    email_domain_match = coalesce(lower(split_part(email, '@', 2)) = any (v_domains), false)
  where id = v_p.id;
  update public.rider_passes set college_id = p_college_id where rider_id = v_p.id;
  if v_was = 'rejected' then
    perform private.notify_admins(p_college_id, 'admin_alert', 'Rider re-applied',
      trim(p_full_name) || ' sent their application again.',
      jsonb_build_object('user_id', v_p.id, 'screen', 'approvals'), v_p.is_demo);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- ID card photo + consent ----------
create or replace function public.set_id_photo(p_path text, p_consent boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.raise('CC_NOT_SIGNED_IN'); end if;
  if p_path is not null and p_path not like v_uid::text || '/%' then perform private.raise('CC_BAD_PHOTO_PATH'); end if;
  update public.profiles set id_photo_path = p_path, id_check_consent = coalesce(p_consent, false),
         id_check_result = null, id_check_attempts = 0
  where id = v_uid and status in ('pending', 'rejected');
  if not found then perform private.raise('CC_NOT_EDITABLE'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- stands with live counts ----------
-- Riders: own college, bikes with the same demo flag as the caller.
-- Admins may pass p_college_id; counts include all bikes the admin may see.
create or replace function public.get_stands_with_counts(
  p_college_id uuid default null, p_lat double precision default null, p_lng double precision default null
) returns table (
  id uuid, name text, lat double precision, lng double precision, radius_m int, capacity int,
  active boolean, free_bikes int, maintenance_bikes int, total_bikes int, distance_m int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_college uuid := coalesce(p_college_id, private.me_college());
  v_admin boolean := private.is_admin_of(coalesce(p_college_id, private.me_college()));
  v_demo boolean := private.me_is_demo();
begin
  if v_college is null then return; end if;
  if not v_admin and (v_college is distinct from private.me_college() or not private.is_approved()) then
    perform private.raise('CC_FORBIDDEN');
  end if;
  return query
  select s.id, s.name, s.lat, s.lng, s.radius_m, s.capacity, s.active,
    (select count(*)::int from public.bikes b where b.current_stand_id = s.id and b.status = 'available'
       and (case when v_admin and not v_demo then true else b.is_demo = v_demo end)),
    (select count(*)::int from public.bikes b where b.current_stand_id = s.id and b.status = 'maintenance'
       and (case when v_admin and not v_demo then true else b.is_demo = v_demo end)),
    (select count(*)::int from public.bikes b where b.current_stand_id = s.id and b.status in ('available', 'maintenance', 'missing')
       and (case when v_admin and not v_demo then true else b.is_demo = v_demo end)),
    case when p_lat is null or p_lng is null then null
         else round(extensions.st_distance(s.location,
                extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography))::int end
  from public.stands s
  where s.college_id = v_college and (s.active or v_admin)
  order by 11 nulls last, s.name;
end $$;

-- ---------- stand detail with free bike codes ----------
create or replace function public.get_stand_detail(p_stand_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_s public.stands%rowtype; v_demo boolean := private.me_is_demo();
begin
  select * into v_s from public.stands where id = p_stand_id;
  if not found then perform private.raise('CC_STAND_NOT_FOUND'); end if;
  if not (v_s.college_id = private.me_college() or private.is_admin_of(v_s.college_id)) then
    perform private.raise('CC_FORBIDDEN');
  end if;
  return jsonb_build_object(
    'id', v_s.id, 'name', v_s.name, 'lat', v_s.lat, 'lng', v_s.lng, 'radius_m', v_s.radius_m,
    'capacity', v_s.capacity, 'active', v_s.active,
    'bikes', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.short_code, 'status', b.status,
                                                            'last_seen_at', b.last_seen_at) order by b.short_code)
                       from public.bikes b
                       where b.current_stand_id = v_s.id and b.status in ('available', 'maintenance')
                         and b.is_demo = v_demo), '[]'::jsonb));
end $$;

-- ---------- bikes a demo rider may pick instead of scanning (demo accounts only) ----------
create or replace function public.list_pickable_bikes()
returns table (bike_id uuid, code text, stand_id uuid, stand_name text, payload text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.me_is_demo() then perform private.raise('CC_FORBIDDEN'); end if;
  return query
  select b.id, b.short_code, s.id, s.name, private.bike_payload(b.short_code)
  from public.bikes b join public.stands s on s.id = b.current_stand_id
  where b.college_id = private.me_college() and b.is_demo and b.status = 'available'
  order by s.name, b.short_code;
end $$;

-- ---------- live pass QR (rotates every 30 s) ----------
create or replace function public.get_my_pass_qr() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pass public.rider_passes%rowtype;
  v_win bigint := floor(extract(epoch from now()) / 30)::bigint;
begin
  select * into v_pass from public.rider_passes where rider_id = auth.uid();
  if not found or v_pass.status = 'pending' or v_pass.pass_number is null then
    return private.err('CC_NOT_APPROVED');
  end if;
  return jsonb_build_object(
    'ok', true,
    'payload', 'campuscycle://p/' || v_pass.id::text || '?t=' || v_win::text || '&s=' || private.sign_pass(v_pass.id, v_win),
    'window', v_win,
    'expires_at', to_timestamp((v_win + 1) * 30));
end $$;

create or replace function public.mark_pass_minted_seen() returns void
language sql security definer set search_path = '' as $$
  update public.rider_passes set minted_seen_at = now()
  where rider_id = auth.uid() and minted_seen_at is null and status <> 'pending'
$$;

-- ---------- pass back-side stats ----------
create or replace function public.get_pass_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pass public.rider_passes%rowtype; v_fave text; v_strikes int;
begin
  select * into v_pass from public.rider_passes where rider_id = auth.uid();
  if not found then perform private.raise('CC_NOT_SIGNED_IN'); end if;
  select s.name into v_fave from public.rides r join public.stands s on s.id = r.start_stand_id
   where r.rider_id = auth.uid() and r.status <> 'active'
   group by s.name order by count(*) desc, s.name limit 1;
  select strikes into v_strikes from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'rides', v_pass.total_rides, 'minutes', v_pass.total_minutes, 'fave_stand', v_fave,
    'strikes', v_strikes, 'finish', private.finish_for(v_pass.total_rides),
    'next_finish', case when v_pass.total_rides >= 50 then null when v_pass.total_rides >= 10 then 'holo' else 'chrome' end,
    'rides_to_next', case when v_pass.total_rides >= 50 then 0 when v_pass.total_rides >= 10 then 50 - v_pass.total_rides
                          else 10 - v_pass.total_rides end);
end $$;

-- ---------- notifications ----------
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;

-- ---------- report an issue ----------
create or replace function public.report_issue(
  p_type public.issue_type, p_note text default '', p_bike_code text default null,
  p_ride_id uuid default null, p_stand_id uuid default null, p_photo_path text default null,
  p_source text default 'app', p_ai_suggested_type public.issue_type default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_bike public.bikes%rowtype;
  v_ride public.rides%rowtype;
  v_id uuid;
  v_urgency smallint;
begin
  select * into v_me from public.profiles where id = v_uid;
  if not found then return private.err('CC_NOT_SIGNED_IN'); end if;
  if v_me.status <> 'approved' or v_me.college_id is null then return private.err('CC_NOT_APPROVED'); end if;
  if not private.rate_ok(v_uid::text, 'report_issue', 10, interval '1 hour') then return private.err('CC_RATE_LIMITED'); end if;
  if p_photo_path is not null and p_photo_path not like v_uid::text || '/%' then return private.err('CC_BAD_PHOTO_PATH'); end if;
  if p_source not in ('app', 'torq') then return private.err('CC_INVALID_INPUT'); end if;

  if p_bike_code is not null and p_bike_code <> '' then
    select * into v_bike from public.bikes where short_code = upper(trim(p_bike_code))
      and college_id = v_me.college_id and is_demo = v_me.is_demo;
    if not found then return private.err('CC_BIKE_NOT_FOUND', jsonb_build_object('code', upper(trim(p_bike_code)))); end if;
  end if;

  if p_ride_id is not null then
    select * into v_ride from public.rides where id = p_ride_id and rider_id = v_uid;
    if not found then return private.err('CC_RIDE_NOT_FOUND'); end if;
    if v_bike.id is null then select * into v_bike from public.bikes where id = v_ride.bike_id; end if;
  end if;

  if p_type = 'ride_close_request' then
    select r.* into v_ride from public.rides r join public.rider_passes p on p.current_ride_id = r.id
      where p.rider_id = v_uid;
    if not found then return private.err('CC_NO_BIKE_ON_PASS'); end if;
    select * into v_bike from public.bikes where id = v_ride.bike_id;
  end if;

  v_urgency := case
    when p_type in ('bike_missing', 'accident') then 5
    when p_type = 'ride_close_request' then 4
    when p_type = 'brakes' then 4
    else null end;

  insert into public.issue_reports (college_id, reporter_id, bike_id, ride_id, stand_id, type, note, photo_path,
                                    ai_suggested_type, urgency, source, is_demo)
  values (v_me.college_id, v_uid, v_bike.id, coalesce(v_ride.id, p_ride_id), p_stand_id, p_type,
          left(coalesce(p_note, ''), 1000), p_photo_path, p_ai_suggested_type, v_urgency, p_source, v_me.is_demo)
  returning id into v_id;

  if p_type in ('bike_missing', 'accident', 'ride_close_request') then
    perform private.notify_admins(v_me.college_id, 'admin_alert',
      case p_type when 'bike_missing' then 'Bike reported missing'
                  when 'accident' then 'Accident reported'
                  else 'Rider asks to close a ride' end,
      coalesce(v_me.full_name, 'A rider') || coalesce(' · ' || v_bike.short_code, '') ||
        case when coalesce(p_note, '') = '' then '' else ': ' || left(p_note, 120) end,
      jsonb_build_object('issue_id', v_id, 'screen', 'issues'), v_me.is_demo);
  end if;
  return jsonb_build_object('ok', true, 'issue_id', v_id);
end $$;

create or replace function public.request_ride_close(p_note text, p_source text default 'app') returns jsonb
language sql security definer set search_path = '' as $$
  select public.report_issue('ride_close_request'::public.issue_type, p_note, null, null, null, null, p_source, null)
$$;

revoke execute on function public.request_password_reset(text) from public;
grant execute on function public.request_password_reset(text) to anon, authenticated;
grant execute on function public.list_colleges_public(), public.health() to anon, authenticated;
```

## 11. Migration 9: `20261012000009_ride_functions.sql`

```sql
-- Decides which stand the caller is standing at.
-- Demo accounts skip GPS: they are placed at p_demo_stand (or the first active stand).
create or replace function private.resolve_location(
  p_college uuid, p_is_demo boolean, p_lat double precision, p_lng double precision,
  p_accuracy double precision, p_is_mock boolean, p_demo_stand uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid; v_name text; v_d double precision;
  v_pt extensions.geography;
begin
  if p_is_demo then
    select s.id, s.name into v_id, v_name from public.stands s where s.id = p_demo_stand and s.college_id = p_college;
    if v_id is null then
      select s.id, s.name into v_id, v_name from public.stands s
       where s.college_id = p_college and s.active order by s.name limit 1;
    end if;
    return jsonb_build_object('ok', true, 'stand_id', v_id, 'stand_name', v_name, 'demo', true);
  end if;

  if coalesce(p_is_mock, false) then return private.err('CC_MOCK_LOCATION'); end if;
  if p_lat is null or p_lng is null then return private.err('CC_NO_LOCATION'); end if;
  if p_accuracy is null or p_accuracy > 50 then
    return private.err('CC_POOR_ACCURACY', jsonb_build_object('accuracy_m', round(coalesce(p_accuracy, -1))));
  end if;

  v_pt := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  select s.id, s.name, extensions.st_distance(s.location, v_pt)
    into v_id, v_name, v_d
  from public.stands s
  where s.college_id = p_college and s.active and extensions.st_dwithin(s.location, v_pt, s.radius_m)
  order by extensions.st_distance(s.location, v_pt)
  limit 1;

  if v_id is null then
    select s.name, extensions.st_distance(s.location, v_pt) into v_name, v_d
    from public.stands s where s.college_id = p_college and s.active
    order by extensions.st_distance(s.location, v_pt) limit 1;
    return private.err('CC_NOT_AT_STAND', jsonb_build_object('nearest_stand', v_name, 'distance_m', round(coalesce(v_d, 0))));
  end if;
  return jsonb_build_object('ok', true, 'stand_id', v_id, 'stand_name', v_name, 'distance_m', round(v_d));
end $$;

-- Adds a strike, suspends at the college limit (never the owner or demo accounts).
create or replace function private.add_strike(p_user uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.profiles%rowtype; v_limit int; v_suspended boolean := false;
begin
  select * into v_p from public.profiles where id = p_user for update;
  if v_p.is_owner then return jsonb_build_object('strikes', v_p.strikes, 'suspended', false); end if;
  select strike_limit into v_limit from public.colleges where id = v_p.college_id;
  update public.profiles set strikes = strikes + 1 where id = p_user returning * into v_p;
  perform private.notify(p_user, 'strike', 'Strike added',
    p_reason || ' You have ' || v_p.strikes || ' of ' || coalesce(v_limit, 3) || ' strikes.',
    jsonb_build_object('screen', 'profile'));
  if not v_p.is_demo and v_p.strikes >= coalesce(v_limit, 3) and v_p.status = 'approved'
     and not exists (select 1 from public.rider_passes where rider_id = p_user and current_bike_id is not null) then
    update public.profiles set status = 'suspended',
      suspended_reason = 'Reached the strike limit (' || coalesce(v_limit, 3) || ').'
    where id = p_user;
    update public.rider_passes set status = 'suspended' where rider_id = p_user;
    perform private.notify(p_user, 'suspension', 'Pass suspended',
      'You reached ' || coalesce(v_limit, 3) || ' strikes. Ask your college admin to reinstate your pass.',
      jsonb_build_object('screen', 'blocked'));
    perform private.notify_admins(v_p.college_id, 'admin_alert', 'Rider suspended',
      v_p.full_name || ' reached the strike limit.', jsonb_build_object('user_id', p_user, 'screen', 'users'), v_p.is_demo);
    v_suspended := true;
  end if;
  return jsonb_build_object('strikes', v_p.strikes, 'suspended', v_suspended);
end $$;

-- ---------- borrow (also used for preview) ----------
create or replace function public.borrow_bike(
  p_code text, p_sig text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_is_mock boolean default false,
  p_demo_stand_id uuid default null, p_preview_only boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_col public.colleges%rowtype;
  v_pass public.rider_passes%rowtype;
  v_bike public.bikes%rowtype;
  v_loc jsonb;
  v_stand_id uuid;
  v_stand_name text;
  v_ride_id uuid;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_manual boolean := p_sig is null or p_sig = '';
  v_due timestamptz;
  v_bike_stand_name text;
begin
  if v_uid is null then return private.err('CC_NOT_SIGNED_IN'); end if;
  select * into v_me from public.profiles where id = v_uid;
  if v_me.status = 'suspended' then return private.err('CC_PASS_SUSPENDED'); end if;
  if v_me.status <> 'approved' or v_me.college_id is null then return private.err('CC_NOT_APPROVED'); end if;

  if not private.rate_ok(v_uid::text, 'borrow', 20, interval '10 minutes') then return private.err('CC_RATE_LIMITED'); end if;
  if v_manual and not private.rate_ok(v_uid::text, 'manual_code', 8, interval '10 minutes') then
    return private.err('CC_RATE_LIMITED');
  end if;

  if v_code !~ '^[A-Z]{1,3}-[0-9]{3,4}$' then return private.err('CC_BAD_CODE'); end if;
  if not v_manual and p_sig <> private.sign_bike(v_code) then return private.err('CC_BAD_QR'); end if;

  select * into v_bike from public.bikes where short_code = v_code for update;
  if not found or v_bike.college_id <> v_me.college_id or v_bike.is_demo <> v_me.is_demo then
    return private.err('CC_BIKE_NOT_FOUND', jsonb_build_object('code', v_code));
  end if;

  select * into v_col from public.colleges where id = v_me.college_id;
  select * into v_pass from public.rider_passes where rider_id = v_uid for update;

  if v_pass.status in ('riding', 'overdue') then
    return private.err('CC_PASS_HAS_BIKE',
      jsonb_build_object('bike', (select short_code from public.bikes where id = v_pass.current_bike_id)));
  end if;
  if v_pass.status = 'suspended' then return private.err('CC_PASS_SUSPENDED'); end if;
  if v_pass.status <> 'ready' then return private.err('CC_NOT_APPROVED'); end if;

  if v_bike.status = 'maintenance' then return private.err('CC_BIKE_IN_MAINTENANCE', jsonb_build_object('code', v_code)); end if;
  if v_bike.status <> 'available' then return private.err('CC_BIKE_NOT_AVAILABLE', jsonb_build_object('code', v_code)); end if;

  v_loc := private.resolve_location(v_me.college_id, v_me.is_demo, p_lat, p_lng, p_accuracy, p_is_mock,
                                    coalesce(v_bike.current_stand_id, p_demo_stand_id));
  if not (v_loc ->> 'ok')::boolean then return v_loc; end if;
  v_stand_id := (v_loc ->> 'stand_id')::uuid;
  v_stand_name := v_loc ->> 'stand_name';

  if not v_me.is_demo and v_bike.current_stand_id is distinct from v_stand_id then
    select name into v_bike_stand_name from public.stands where id = v_bike.current_stand_id;
    return private.err('CC_BIKE_NOT_AT_THIS_STAND',
      jsonb_build_object('code', v_code, 'bike_stand', v_bike_stand_name, 'here', v_stand_name));
  end if;

  v_due := now() + make_interval(mins => v_col.max_ride_minutes);

  if p_preview_only then
    return jsonb_build_object(
      'ok', true, 'preview', true,
      'bike', jsonb_build_object('id', v_bike.id, 'code', v_code, 'last_seen_at', v_bike.last_seen_at,
                                 'notes', v_bike.notes),
      'stand', jsonb_build_object('id', v_stand_id, 'name', v_stand_name),
      'max_ride_minutes', v_col.max_ride_minutes, 'due_at', v_due, 'manual', v_manual);
  end if;

  insert into public.rides (college_id, rider_id, pass_id, bike_id, start_stand_id, started_at, due_at,
                            start_lat, start_lng, start_accuracy_m, status, flags, is_demo)
  values (v_me.college_id, v_uid, v_pass.id, v_bike.id, v_stand_id, now(), v_due,
          p_lat, p_lng, p_accuracy, 'active',
          case when v_manual then array['manual_code'] else '{}'::text[] end, v_me.is_demo)
  returning id into v_ride_id;

  update public.bikes set status = 'borrowed', current_pass_id = v_pass.id, current_stand_id = null,
         last_seen_at = now(), last_seen_stand_id = v_stand_id
  where id = v_bike.id;

  update public.rider_passes set status = 'riding', current_bike_id = v_bike.id,
         current_ride_id = v_ride_id, borrowed_at = now()
  where id = v_pass.id;

  return jsonb_build_object('ok', true, 'ride_id', v_ride_id, 'bike_code', v_code,
                            'stand_id', v_stand_id, 'stand_name', v_stand_name,
                            'started_at', now(), 'due_at', v_due);
end $$;

create or replace function public.preview_bike(
  p_code text, p_sig text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_is_mock boolean default false,
  p_demo_stand_id uuid default null
) returns jsonb
language sql security definer set search_path = '' as $$
  select public.borrow_bike(p_code, p_sig, p_lat, p_lng, p_accuracy, p_is_mock, p_demo_stand_id, true)
$$;

-- ---------- return step 1: am I at a stand? ----------
create or replace function public.check_return_location(
  p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_is_mock boolean default false,
  p_demo_stand_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me public.profiles%rowtype; v_pass public.rider_passes%rowtype; v_loc jsonb; v_free int; v_cap int;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if not found then return private.err('CC_NOT_SIGNED_IN'); end if;
  select * into v_pass from public.rider_passes where rider_id = v_me.id;
  if v_pass.status not in ('riding', 'overdue') then return private.err('CC_NO_BIKE_ON_PASS'); end if;
  if not private.rate_ok(v_me.id::text, 'return_check', 30, interval '10 minutes') then return private.err('CC_RATE_LIMITED'); end if;
  v_loc := private.resolve_location(v_me.college_id, v_me.is_demo, p_lat, p_lng, p_accuracy, p_is_mock,
    coalesce(p_demo_stand_id, (select start_stand_id from public.rides where id = v_pass.current_ride_id)));
  if not (v_loc ->> 'ok')::boolean then return v_loc; end if;
  select count(*)::int into v_free from public.bikes
   where current_stand_id = (v_loc ->> 'stand_id')::uuid and status in ('available', 'maintenance');
  select capacity into v_cap from public.stands where id = (v_loc ->> 'stand_id')::uuid;
  return v_loc || jsonb_build_object('stand_full', v_free >= v_cap,
    'bike_code', (select short_code from public.bikes where id = v_pass.current_bike_id));
end $$;

-- ---------- return ----------
create or replace function public.return_bike(
  p_code text, p_sig text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_is_mock boolean default false,
  p_photo_path text default null, p_demo_stand_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_pass public.rider_passes%rowtype;
  v_bike public.bikes%rowtype;
  v_ride public.rides%rowtype;
  v_stand public.stands%rowtype;
  v_loc jsonb;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_manual boolean := p_sig is null or p_sig = '';
  v_late boolean;
  v_full boolean;
  v_minutes int;
  v_finish_before text;
  v_strike jsonb := jsonb_build_object('strikes', null, 'suspended', false);
  v_pass_bike text;
  v_new_status public.bike_status;
begin
  if v_uid is null then return private.err('CC_NOT_SIGNED_IN'); end if;
  select * into v_me from public.profiles where id = v_uid;
  if not private.rate_ok(v_uid::text, 'return', 20, interval '10 minutes') then return private.err('CC_RATE_LIMITED'); end if;

  select * into v_pass from public.rider_passes where rider_id = v_uid for update;
  if not found or v_pass.status not in ('riding', 'overdue') then return private.err('CC_NO_BIKE_ON_PASS'); end if;
  select short_code into v_pass_bike from public.bikes where id = v_pass.current_bike_id;

  if v_code !~ '^[A-Z]{1,3}-[0-9]{3,4}$' then return private.err('CC_BAD_CODE'); end if;
  if not v_manual and p_sig <> private.sign_bike(v_code) then return private.err('CC_BAD_QR'); end if;
  if v_code <> v_pass_bike then return private.err('CC_WRONG_BIKE', jsonb_build_object('pass_bike', v_pass_bike, 'scanned', v_code)); end if;

  select * into v_bike from public.bikes where id = v_pass.current_bike_id for update;
  select * into v_ride from public.rides where id = v_pass.current_ride_id for update;

  v_loc := private.resolve_location(v_me.college_id, v_me.is_demo, p_lat, p_lng, p_accuracy, p_is_mock,
                                    coalesce(p_demo_stand_id, v_ride.start_stand_id));
  if not (v_loc ->> 'ok')::boolean then return v_loc; end if;
  select * into v_stand from public.stands where id = (v_loc ->> 'stand_id')::uuid;

  if p_photo_path is not null and p_photo_path not like v_uid::text || '/%' then return private.err('CC_BAD_PHOTO_PATH'); end if;

  v_late := now() > v_ride.due_at;
  v_full := (select count(*) from public.bikes where current_stand_id = v_stand.id
             and status in ('available', 'maintenance')) >= v_stand.capacity;
  v_minutes := greatest(1, ceil(extract(epoch from (now() - v_ride.started_at)) / 60))::int;
  v_finish_before := private.finish_for(v_pass.total_rides);
  v_new_status := case when v_bike.maintenance_after_return then 'maintenance' else 'available' end;

  update public.rides set
    ended_at = now(), end_stand_id = v_stand.id, end_lat = p_lat, end_lng = p_lng, end_accuracy_m = p_accuracy,
    status = 'returned', late = v_late, return_photo_path = p_photo_path,
    flags = flags
      || case when v_full then array['stand_over_capacity'] else '{}'::text[] end
      || case when v_manual then array['manual_code_return'] else '{}'::text[] end
      || case when v_late then array['late'] else '{}'::text[] end
  where id = v_ride.id;

  update public.rider_passes set status = 'ready', current_bike_id = null, current_ride_id = null,
    borrowed_at = null, total_rides = total_rides + 1, total_minutes = total_minutes + v_minutes
  where id = v_pass.id;

  update public.bikes set status = v_new_status, current_pass_id = null, current_stand_id = v_stand.id,
    last_seen_at = now(), last_seen_stand_id = v_stand.id, maintenance_after_return = false
  where id = v_bike.id;

  if v_late then
    v_strike := private.add_strike(v_uid, 'Late return of ' || v_pass_bike || '.');
  end if;

  if v_full then
    perform private.notify_admins(v_me.college_id, 'admin_alert', 'Stand over capacity',
      v_stand.name || ' took ' || v_pass_bike || ' while full.', jsonb_build_object('stand_id', v_stand.id, 'screen', 'stands'),
      v_me.is_demo);
  end if;

  return jsonb_build_object(
    'ok', true, 'ride_id', v_ride.id, 'bike_code', v_pass_bike,
    'start_stand_name', (select name from public.stands where id = v_ride.start_stand_id),
    'end_stand_name', v_stand.name, 'started_at', v_ride.started_at, 'ended_at', now(),
    'minutes', v_minutes, 'late', v_late, 'stand_full', v_full,
    'strikes', (v_strike ->> 'strikes')::int, 'suspended', (v_strike ->> 'suspended')::boolean,
    'total_rides', v_pass.total_rides + 1,
    'finish_before', v_finish_before, 'finish_after', private.finish_for(v_pass.total_rides + 1),
    'photo_pending', p_photo_path is null);
end $$;

-- ---------- photo uploaded after the ride ended (background retry) ----------
create or replace function public.attach_return_photo(p_ride_id uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if p_path is null or p_path not like v_uid::text || '/%' then return private.err('CC_BAD_PHOTO_PATH'); end if;
  update public.rides set return_photo_path = p_path, photo_check = 'pending', photo_check_attempts = 0
  where id = p_ride_id and rider_id = v_uid and status = 'returned'
    and return_photo_path is null and ended_at > now() - interval '24 hours';
  if not found then return private.err('CC_RIDE_NOT_FOUND'); end if;
  return jsonb_build_object('ok', true);
end $$;
```

## 12. Migration 10: `20261012000010_admin_functions.sql`

All functions here are called by college admins (own college) and super admins (any college). Every one checks `private.require_admin_of`, demo scope, and writes `audit_log`. `p_source` is `'admin'` from the admin web app or `'torq'` when TORQ executes a confirmed action, in which case `p_ai_action_id` is set and recorded.

```sql
-- ---------- mint a pass (internal) ----------
create or replace function private.mint_pass(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_college uuid; v_no int; v_code text; v_demo boolean;
begin
  select college_id, is_demo into v_college, v_demo from public.profiles where id = p_user;
  if v_demo then
    -- Demo passes use 9001+ so demo approvals never consume real pass numbers
    select coalesce(max(pass_number), 9000) + 1 into v_no from public.rider_passes
     where college_id = v_college and pass_number > 9000;
    select short_code into v_code from public.colleges where id = v_college;
  else
    update public.colleges set next_pass_no = next_pass_no + 1 where id = v_college
      returning next_pass_no - 1, short_code into v_no, v_code;
  end if;
  update public.rider_passes set college_id = v_college,
    pass_number = coalesce(pass_number, v_no),
    status = 'ready', issued_at = now(), minted_seen_at = null
  where rider_id = p_user;
  return private.pass_label(v_code, (select pass_number from public.rider_passes where rider_id = p_user));
end $$;

-- ---------- approvals ----------
create or replace function public.approve_rider(
  p_user_id uuid, p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_t public.profiles%rowtype; v_label text;
begin
  select * into v_t from public.profiles where id = p_user_id for update;
  if not found then perform private.raise('CC_USER_NOT_FOUND'); end if;
  perform private.require_admin_of(v_t.college_id);
  perform private.require_demo_scope(v_t.is_demo);
  if v_t.status <> 'pending' then perform private.raise('CC_NOT_PENDING'); end if;
  if v_t.college_id is null then perform private.raise('CC_COLLEGE_NOT_FOUND'); end if;

  update public.profiles set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    rejection_reason = null where id = p_user_id;
  v_label := private.mint_pass(p_user_id);
  perform private.notify(p_user_id, 'approval', 'You''re in',
    'Your Rider Pass ' || v_label || ' is live. Go ride.', jsonb_build_object('screen', 'home'));
  perform private.audit(v_t.college_id, 'rider.approve', 'profile', p_user_id::text,
    jsonb_build_object('pass', v_label, 'ai_action_id', p_ai_action_id), p_source,
    case when p_source = 'torq' then auth.uid() end);
  return jsonb_build_object('ok', true, 'pass_label', v_label);
end $$;

create or replace function public.approve_riders(
  p_user_ids uuid[], p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ok int := 0; v_failed jsonb := '[]'::jsonb;
begin
  if coalesce(array_length(p_user_ids, 1), 0) > 50 then perform private.raise('CC_TOO_MANY'); end if;
  foreach v_id in array coalesce(p_user_ids, '{}') loop
    begin
      perform public.approve_rider(v_id, p_source, p_ai_action_id);
      v_ok := v_ok + 1;
    exception when others then
      v_failed := v_failed || jsonb_build_object('user_id', v_id, 'code', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('ok', true, 'approved', v_ok, 'failed', v_failed);
end $$;

create or replace function public.reject_rider(
  p_user_id uuid, p_reason text, p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_t public.profiles%rowtype;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then perform private.raise('CC_REASON_REQUIRED'); end if;
  select * into v_t from public.profiles where id = p_user_id for update;
  if not found then perform private.raise('CC_USER_NOT_FOUND'); end if;
  perform private.require_admin_of(v_t.college_id);
  perform private.require_demo_scope(v_t.is_demo);
  if v_t.status <> 'pending' then perform private.raise('CC_NOT_PENDING'); end if;
  update public.profiles set status = 'rejected', rejection_reason = left(trim(p_reason), 300) where id = p_user_id;
  perform private.notify(p_user_id, 'rejection', 'Application not approved', left(trim(p_reason), 300),
    jsonb_build_object('screen', 'blocked'));
  perform private.audit(v_t.college_id, 'rider.reject', 'profile', p_user_id::text,
    jsonb_build_object('reason', left(trim(p_reason), 300), 'ai_action_id', p_ai_action_id), p_source,
    case when p_source = 'torq' then auth.uid() end);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- users ----------
create or replace function public.suspend_rider(
  p_user_id uuid, p_reason text, p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_t public.profiles%rowtype;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then perform private.raise('CC_REASON_REQUIRED'); end if;
  select * into v_t from public.profiles where id = p_user_id for update;
  if not found then perform private.raise('CC_USER_NOT_FOUND'); end if;
  perform private.require_admin_of(v_t.college_id);
  perform private.require_demo_scope(v_t.is_demo);
  if v_t.is_owner then perform private.raise('CC_OWNER_PROTECTED'); end if;
  if v_t.demo_role is not null then perform private.raise('CC_DEMO_PROTECTED'); end if;
  if v_t.status <> 'approved' then perform private.raise('CC_NOT_APPROVED'); end if;
  if exists (select 1 from public.rider_passes where rider_id = p_user_id and current_bike_id is not null) then
    perform private.raise('CC_PASS_HAS_BIKE');
  end if;
  update public.profiles set status = 'suspended', suspended_reason = left(trim(p_reason), 300) where id = p_user_id;
  update public.rider_passes set status = 'suspended' where rider_id = p_user_id;
  perform private.notify(p_user_id, 'suspension', 'Pass suspended', left(trim(p_reason), 300), jsonb_build_object('screen', 'blocked'));
  perform private.audit(v_t.college_id, 'rider.suspend', 'profile', p_user_id::text,
    jsonb_build_object('reason', left(trim(p_reason), 300), 'ai_action_id', p_ai_action_id), p_source,
    case when p_source = 'torq' then auth.uid() end);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reinstate_rider(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_t public.profiles%rowtype;
begin
  select * into v_t from public.profiles where id = p_user_id for update;
  if not found then perform private.raise('CC_USER_NOT_FOUND'); end if;
  perform private.require_admin_of(v_t.college_id);
  perform private.require_demo_scope(v_t.is_demo);
  if v_t.status <> 'suspended' then perform private.raise('CC_NOT_SUSPENDED'); end if;
  update public.profiles set status = 'approved', suspended_reason = null, strikes = 0 where id = p_user_id;
  update public.rider_passes set status = 'ready' where rider_id = p_user_id and current_bike_id is null;
  perform private.notify(p_user_id, 'reinstated', 'Pass reinstated', 'Your Rider Pass works again. Strikes reset to 0.',
    jsonb_build_object('screen', 'home'));
  perform private.audit(v_t.college_id, 'rider.reinstate', 'profile', p_user_id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reset_strikes(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_t public.profiles%rowtype;
begin
  select * into v_t from public.profiles where id = p_user_id for update;
  if not found then perform private.raise('CC_USER_NOT_FOUND'); end if;
  perform private.require_admin_of(v_t.college_id);
  perform private.require_demo_scope(v_t.is_demo);
  update public.profiles set strikes = 0 where id = p_user_id;
  perform private.audit(v_t.college_id, 'rider.reset_strikes', 'profile', p_user_id::text,
    jsonb_build_object('previous', v_t.strikes));
  return jsonb_build_object('ok', true);
end $$;

-- Super admin only. Never available to TORQ.
create or replace function public.set_user_role(
  p_user_id uuid, p_role public.user_role, p_college_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_t public.profiles%rowtype;
begin
  if not private.is_super() then perform private.raise('CC_FORBIDDEN'); end if;
  perform private.require_not_demo();
  select * into v_t from public.profiles where id = p_user_id for update;
  if not found then perform private.raise('CC_USER_NOT_FOUND'); end if;
  if v_t.is_owner then perform private.raise('CC_OWNER_PROTECTED'); end if;
  if v_t.is_demo then perform private.raise('CC_DEMO_PROTECTED'); end if;
  if p_role = 'college_admin' and coalesce(p_college_id, v_t.college_id) is null then
    perform private.raise('CC_COLLEGE_REQUIRED');
  end if;
  update public.profiles set role = p_role,
    college_id = case when p_role = 'college_admin' then coalesce(p_college_id, college_id) else college_id end,
    status = case when status = 'pending' and p_role <> 'rider' then 'approved' else status end,
    approved_at = coalesce(approved_at, case when p_role <> 'rider' then now() end),
    approved_by = coalesce(approved_by, case when p_role <> 'rider' then auth.uid() end)
  where id = p_user_id;
  perform private.audit(coalesce(p_college_id, v_t.college_id), 'user.set_role', 'profile', p_user_id::text,
    jsonb_build_object('from', v_t.role, 'to', p_role));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- rides ----------
create or replace function public.force_return(
  p_ride_id uuid, p_stand_id uuid, p_note text, p_add_strike boolean default false,
  p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_r public.rides%rowtype; v_s public.stands%rowtype; v_code text; v_minutes int;
begin
  if char_length(trim(coalesce(p_note, ''))) < 3 then perform private.raise('CC_REASON_REQUIRED'); end if;
  select * into v_r from public.rides where id = p_ride_id for update;
  if not found then perform private.raise('CC_RIDE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_r.college_id);
  perform private.require_demo_scope(v_r.is_demo);
  if v_r.status <> 'active' then perform private.raise('CC_RIDE_NOT_ACTIVE'); end if;
  select * into v_s from public.stands where id = p_stand_id and college_id = v_r.college_id;
  if not found then perform private.raise('CC_STAND_NOT_FOUND'); end if;
  select short_code into v_code from public.bikes where id = v_r.bike_id for update;
  perform 1 from public.rider_passes where id = v_r.pass_id for update;
  v_minutes := greatest(1, ceil(extract(epoch from (now() - v_r.started_at)) / 60))::int;

  update public.rides set status = 'force_returned', ended_at = now(), end_stand_id = v_s.id,
    force_note = left(trim(p_note), 300), forced_by = auth.uid(), photo_check = 'skipped',
    late = now() > due_at, flags = flags || array['force_returned']
  where id = v_r.id;
  update public.rider_passes set status = 'ready', current_bike_id = null, current_ride_id = null, borrowed_at = null,
    total_rides = total_rides + 1, total_minutes = total_minutes + v_minutes
  where id = v_r.pass_id;
  update public.bikes set status = case when maintenance_after_return then 'maintenance'::public.bike_status else 'available'::public.bike_status end,
    current_pass_id = null, current_stand_id = v_s.id, last_seen_at = now(), last_seen_stand_id = v_s.id,
    maintenance_after_return = false
  where id = v_r.bike_id;

  if p_add_strike and v_r.rider_id is not null then
    perform private.add_strike(v_r.rider_id, 'Admin closed your ride of ' || v_code || ': ' || left(trim(p_note), 120));
  end if;
  if v_r.rider_id is not null then
    perform private.notify(v_r.rider_id, 'ride_closed', 'Ride closed by an admin',
      v_code || ' was returned at ' || v_s.name || '. Note: ' || left(trim(p_note), 200), jsonb_build_object('ride_id', v_r.id, 'screen', 'rides'));
  end if;
  update public.issue_reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(),
    resolution_note = 'Ride closed by admin'
  where ride_id = v_r.id and type = 'ride_close_request' and status <> 'resolved';
  perform private.audit(v_r.college_id, 'ride.force_return', 'ride', v_r.id::text,
    jsonb_build_object('bike', v_code, 'stand', v_s.name, 'note', left(trim(p_note), 300), 'strike', p_add_strike,
                       'ai_action_id', p_ai_action_id), p_source, case when p_source = 'torq' then auth.uid() end);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- bikes ----------
create or replace function public.mark_bike_missing(
  p_bike_id uuid, p_note text, p_add_strike boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bikes%rowtype; v_r public.rides%rowtype;
begin
  if char_length(trim(coalesce(p_note, ''))) < 3 then perform private.raise('CC_REASON_REQUIRED'); end if;
  select * into v_b from public.bikes where id = p_bike_id for update;
  if not found then perform private.raise('CC_BIKE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_b.college_id);
  perform private.require_demo_scope(v_b.is_demo);
  if v_b.status = 'borrowed' then
    select * into v_r from public.rides where bike_id = v_b.id and status = 'active' for update;
    perform 1 from public.rider_passes where id = v_b.current_pass_id for update;
    update public.rides set status = 'force_returned', ended_at = now(), end_stand_id = null,
      force_note = 'Bike marked missing: ' || left(trim(p_note), 250), forced_by = auth.uid(),
      photo_check = 'skipped', flags = flags || array['bike_missing']
    where id = v_r.id;
    update public.rider_passes set status = 'ready', current_bike_id = null, current_ride_id = null, borrowed_at = null
    where id = v_b.current_pass_id;
    if p_add_strike and v_r.rider_id is not null then
      perform private.add_strike(v_r.rider_id, v_b.short_code || ' was lost while on your pass.');
    end if;
    if v_r.rider_id is not null then
      perform private.notify(v_r.rider_id, 'ride_closed', 'Pass released',
        v_b.short_code || ' was marked missing and removed from your pass.', jsonb_build_object('screen', 'home'));
    end if;
  end if;
  update public.bikes set status = 'missing', current_pass_id = null, current_stand_id = null,
    notes = left(trim(p_note), 500), maintenance_after_return = false
  where id = v_b.id;
  perform private.audit(v_b.college_id, 'bike.missing', 'bike', v_b.id::text,
    jsonb_build_object('code', v_b.short_code, 'note', left(trim(p_note), 300), 'strike', p_add_strike));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_bike_maintenance(
  p_bike_id uuid, p_on boolean, p_note text default '', p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bikes%rowtype; v_result text;
begin
  select * into v_b from public.bikes where id = p_bike_id for update;
  if not found then perform private.raise('CC_BIKE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_b.college_id);
  perform private.require_demo_scope(v_b.is_demo);
  if p_on then
    if v_b.status = 'borrowed' then
      update public.bikes set maintenance_after_return = true, notes = coalesce(nullif(left(trim(p_note), 500), ''), notes) where id = v_b.id;
      v_result := 'after_return';
    elsif v_b.status in ('available', 'missing') then
      update public.bikes set status = 'maintenance', notes = coalesce(nullif(left(trim(p_note), 500), ''), notes) where id = v_b.id;
      v_result := 'now';
    else
      v_result := 'unchanged';
    end if;
  else
    if v_b.status = 'maintenance' then
      if v_b.current_stand_id is null then perform private.raise('CC_STAND_REQUIRED'); end if;
      update public.bikes set status = 'available', ai_flag = null where id = v_b.id;
      v_result := 'available';
    else
      update public.bikes set maintenance_after_return = false where id = v_b.id;
      v_result := 'unchanged';
    end if;
  end if;
  perform private.audit(v_b.college_id, case when p_on then 'bike.maintenance_on' else 'bike.maintenance_off' end,
    'bike', v_b.id::text, jsonb_build_object('code', v_b.short_code, 'note', p_note, 'result', v_result,
    'ai_action_id', p_ai_action_id), p_source, case when p_source = 'torq' then auth.uid() end);
  return jsonb_build_object('ok', true, 'result', v_result);
end $$;

create or replace function public.move_bike(
  p_bike_id uuid, p_stand_id uuid, p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bikes%rowtype; v_s public.stands%rowtype;
begin
  select * into v_b from public.bikes where id = p_bike_id for update;
  if not found then perform private.raise('CC_BIKE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_b.college_id);
  perform private.require_demo_scope(v_b.is_demo);
  if v_b.status in ('borrowed', 'retired') then perform private.raise('CC_BIKE_NOT_AVAILABLE'); end if;
  select * into v_s from public.stands where id = p_stand_id and college_id = v_b.college_id;
  if not found then perform private.raise('CC_STAND_NOT_FOUND'); end if;
  update public.bikes set current_stand_id = v_s.id, last_seen_at = now(), last_seen_stand_id = v_s.id,
    status = case when status = 'missing' then 'available'::public.bike_status else status end, ai_flag = null
  where id = v_b.id;
  perform private.audit(v_b.college_id, 'bike.move', 'bike', v_b.id::text,
    jsonb_build_object('code', v_b.short_code, 'to', v_s.name, 'ai_action_id', p_ai_action_id), p_source,
    case when p_source = 'torq' then auth.uid() end);
  return jsonb_build_object('ok', true);
end $$;

-- p_moves: [{"bike_code":"K-004","stand_id":"<uuid>"}]
create or replace function public.move_bikes(
  p_moves jsonb, p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_m jsonb; v_id uuid; v_n int := 0;
begin
  if jsonb_array_length(coalesce(p_moves, '[]'::jsonb)) > 20 then perform private.raise('CC_TOO_MANY'); end if;
  for v_m in select * from jsonb_array_elements(coalesce(p_moves, '[]'::jsonb)) loop
    select id into v_id from public.bikes where short_code = upper(v_m ->> 'bike_code');
    if v_id is null then perform private.raise('CC_BIKE_NOT_FOUND', jsonb_build_object('code', v_m ->> 'bike_code')); end if;
    perform public.move_bike(v_id, (v_m ->> 'stand_id')::uuid, p_source, p_ai_action_id);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'moved', v_n);
end $$;

create or replace function public.create_bikes(
  p_college_id uuid, p_stand_id uuid, p_count int default 1, p_notes text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_prefix text; v_max int; v_codes text[] := '{}'; v_i int; v_code text; v_demo boolean := private.me_is_demo();
begin
  perform private.require_admin_of(p_college_id);
  if p_count < 1 or p_count > 50 then perform private.raise('CC_INVALID_INPUT'); end if;
  if not exists (select 1 from public.stands where id = p_stand_id and college_id = p_college_id) then
    perform private.raise('CC_STAND_NOT_FOUND');
  end if;
  select bike_prefix into v_prefix from public.colleges where id = p_college_id;
  select coalesce(max(split_part(short_code, '-', 2)::int), 0) into v_max
    from public.bikes where college_id = p_college_id;
  for v_i in 1..p_count loop
    v_code := v_prefix || '-' || lpad((v_max + v_i)::text, 3, '0');
    insert into public.bikes (college_id, short_code, status, current_stand_id, last_seen_at, last_seen_stand_id, notes, is_demo)
    values (p_college_id, v_code, 'available', p_stand_id, now(), p_stand_id, left(coalesce(p_notes, ''), 500), v_demo);
    v_codes := v_codes || v_code;
  end loop;
  perform private.audit(p_college_id, 'bike.create', 'bike', array_to_string(v_codes, ','), jsonb_build_object('count', p_count));
  return jsonb_build_object('ok', true, 'codes', to_jsonb(v_codes));
end $$;

create or replace function public.update_bike_notes(p_bike_id uuid, p_notes text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bikes%rowtype;
begin
  select * into v_b from public.bikes where id = p_bike_id for update;
  if not found then perform private.raise('CC_BIKE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_b.college_id);
  perform private.require_demo_scope(v_b.is_demo);
  update public.bikes set notes = left(coalesce(p_notes, ''), 500) where id = p_bike_id;
  perform private.audit(v_b.college_id, 'bike.notes', 'bike', p_bike_id::text, jsonb_build_object('code', v_b.short_code));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.retire_bike(p_bike_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bikes%rowtype;
begin
  select * into v_b from public.bikes where id = p_bike_id for update;
  if not found then perform private.raise('CC_BIKE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_b.college_id);
  perform private.require_demo_scope(v_b.is_demo);
  if v_b.status = 'borrowed' then perform private.raise('CC_PASS_HAS_BIKE'); end if;
  update public.bikes set status = 'retired', current_stand_id = null, maintenance_after_return = false where id = p_bike_id;
  perform private.audit(v_b.college_id, 'bike.retire', 'bike', p_bike_id::text, jsonb_build_object('code', v_b.short_code));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.clear_bike_flag(p_bike_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bikes%rowtype;
begin
  select * into v_b from public.bikes where id = p_bike_id for update;
  if not found then perform private.raise('CC_BIKE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_b.college_id);
  perform private.require_demo_scope(v_b.is_demo);
  update public.bikes set ai_flag = null where id = p_bike_id;
  return jsonb_build_object('ok', true);
end $$;

-- Signed QR payloads for printing labels (A09)
create or replace function public.admin_bike_qr_payloads(p_bike_ids uuid[])
returns table (bike_id uuid, short_code text, payload text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(array_length(p_bike_ids, 1), 0) > 210 then perform private.raise('CC_TOO_MANY'); end if;
  return query
  select b.id, b.short_code, private.bike_payload(b.short_code)
  from public.bikes b
  where b.id = any (p_bike_ids) and private.is_admin_of(b.college_id) and private.demo_ok(b.is_demo)
  order by b.short_code;
end $$;

-- ---------- stands ----------
create or replace function public.upsert_stand(
  p_id uuid, p_college_id uuid, p_name text, p_lat double precision, p_lng double precision,
  p_radius_m int default null, p_capacity int default 8, p_active boolean default true
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_radius int;
begin
  perform private.require_admin_of(p_college_id);
  perform private.require_not_demo();
  select coalesce(p_radius_m, default_geofence_m) into v_radius from public.colleges where id = p_college_id;
  if p_id is null then
    insert into public.stands (college_id, name, lat, lng, radius_m, capacity, active)
    values (p_college_id, trim(p_name), p_lat, p_lng, v_radius, p_capacity, p_active) returning id into v_id;
  else
    update public.stands set name = trim(p_name), lat = p_lat, lng = p_lng, radius_m = v_radius,
      capacity = p_capacity, active = p_active
    where id = p_id and college_id = p_college_id returning id into v_id;
    if v_id is null then perform private.raise('CC_STAND_NOT_FOUND'); end if;
  end if;
  perform private.audit(p_college_id, case when p_id is null then 'stand.create' else 'stand.update' end, 'stand', v_id::text,
    jsonb_build_object('name', trim(p_name), 'lat', p_lat, 'lng', p_lng, 'radius_m', v_radius, 'capacity', p_capacity, 'active', p_active));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ---------- scans ----------
create or replace function public.admin_scan_pass(p_payload text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m text[]; v_pass public.rider_passes%rowtype; v_p public.profiles%rowtype; v_c public.colleges%rowtype;
  v_now bigint := floor(extract(epoch from now()) / 30)::bigint; v_win bigint; v_bike jsonb;
begin
  if not private.is_admin() then return private.err('CC_FORBIDDEN'); end if;
  if not private.rate_ok(auth.uid()::text, 'scan', 120, interval '10 minutes') then return private.err('CC_RATE_LIMITED'); end if;
  v_m := regexp_match(coalesce(p_payload, ''), '^campuscycle://p/([0-9a-f-]{36})\?t=([0-9]{1,12})&s=([A-Za-z0-9_-]{22})$');
  if v_m is null then return private.err('CC_BAD_QR'); end if;
  v_win := v_m[2]::bigint;
  if private.sign_pass(v_m[1]::uuid, v_win) <> v_m[3] then return private.err('CC_BAD_QR'); end if;
  if v_win < v_now - 1 or v_win > v_now + 1 then return private.err('CC_PASS_QR_EXPIRED'); end if;
  select * into v_pass from public.rider_passes where id = v_m[1]::uuid;
  if not found then return private.err('CC_BAD_QR'); end if;
  if not private.is_admin_of(v_pass.college_id) or not private.demo_ok(v_pass.is_demo) then return private.err('CC_FORBIDDEN'); end if;
  select * into v_p from public.profiles where id = v_pass.rider_id;
  select * into v_c from public.colleges where id = v_pass.college_id;
  if v_pass.current_bike_id is not null then
    select jsonb_build_object('code', b.short_code, 'since', v_pass.borrowed_at, 'from_stand', s.name,
                              'ride_id', r.id, 'due_at', r.due_at, 'is_overdue', r.is_overdue)
      into v_bike
    from public.bikes b join public.rides r on r.id = v_pass.current_ride_id
    left join public.stands s on s.id = r.start_stand_id where b.id = v_pass.current_bike_id;
  end if;
  perform private.audit(v_pass.college_id, 'pass.scan', 'pass', v_pass.id::text, jsonb_build_object('valid', true));
  return jsonb_build_object('ok', true,
    'holder', jsonb_build_object('user_id', v_p.id, 'name', v_p.full_name, 'roll_number', v_p.roll_number,
      'status', v_p.status, 'strikes', v_p.strikes, 'id_photo_path', v_p.id_photo_path,
      'pass_label', private.pass_label(v_c.short_code, v_pass.pass_number), 'pass_status', v_pass.status),
    'bike', v_bike);
end $$;

-- Accepts a full bike QR payload or a bare short code
create or replace function public.admin_scan_bike(p_payload text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_m text[]; v_code text; v_b public.bikes%rowtype; v_holder jsonb; v_signed boolean := false;
begin
  if not private.is_admin() then return private.err('CC_FORBIDDEN'); end if;
  if not private.rate_ok(auth.uid()::text, 'scan', 120, interval '10 minutes') then return private.err('CC_RATE_LIMITED'); end if;
  v_m := regexp_match(coalesce(p_payload, ''), '^campuscycle://b/([A-Z]{1,3}-[0-9]{3,4})\?s=([A-Za-z0-9_-]{22})$');
  if v_m is not null then
    if private.sign_bike(v_m[1]) <> v_m[2] then return private.err('CC_BAD_QR'); end if;
    v_code := v_m[1]; v_signed := true;
  else
    v_code := upper(trim(coalesce(p_payload, '')));
    if v_code !~ '^[A-Z]{1,3}-[0-9]{3,4}$' then return private.err('CC_BAD_CODE'); end if;
  end if;
  select * into v_b from public.bikes where short_code = v_code;
  if not found or not private.is_admin_of(v_b.college_id) or not private.demo_ok(v_b.is_demo) then
    return private.err('CC_BIKE_NOT_FOUND', jsonb_build_object('code', v_code));
  end if;
  if v_b.current_pass_id is not null then
    select jsonb_build_object('user_id', p.id, 'name', p.full_name, 'pass_label', private.pass_label(c.short_code, rp.pass_number),
                              'since', rp.borrowed_at, 'ride_id', rp.current_ride_id, 'from_stand', s.name,
                              'due_at', r.due_at, 'is_overdue', r.is_overdue)
      into v_holder
    from public.rider_passes rp join public.profiles p on p.id = rp.rider_id
    join public.colleges c on c.id = rp.college_id
    join public.rides r on r.id = rp.current_ride_id
    left join public.stands s on s.id = r.start_stand_id
    where rp.id = v_b.current_pass_id;
  end if;
  return jsonb_build_object('ok', true, 'signed', v_signed,
    'bike', jsonb_build_object('id', v_b.id, 'code', v_b.short_code, 'status', v_b.status,
      'stand_id', v_b.current_stand_id, 'stand_name', (select name from public.stands where id = v_b.current_stand_id),
      'last_seen_at', v_b.last_seen_at, 'ai_flag', v_b.ai_flag, 'notes', v_b.notes),
    'holder', v_holder);
end $$;

-- Stand check: p_codes = every bike code scanned at the stand
create or replace function public.stand_check_submit(p_stand_id uuid, p_codes text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.stands%rowtype; v_codes text[];
  v_seen jsonb; v_missing jsonb; v_unexpected jsonb; v_demo boolean := private.me_is_demo();
begin
  select * into v_s from public.stands where id = p_stand_id;
  if not found then perform private.raise('CC_STAND_NOT_FOUND'); end if;
  perform private.require_admin_of(v_s.college_id);
  select coalesce(array_agg(distinct upper(trim(c))), '{}') into v_codes from unnest(coalesce(p_codes, '{}')) c;

  select coalesce(jsonb_agg(b.short_code order by b.short_code), '[]') into v_seen
    from public.bikes b where b.current_stand_id = v_s.id and b.short_code = any (v_codes) and b.is_demo = v_demo;
  select coalesce(jsonb_agg(jsonb_build_object('code', b.short_code, 'last_seen_at', b.last_seen_at) order by b.short_code), '[]')
    into v_missing
    from public.bikes b where b.current_stand_id = v_s.id and b.status in ('available', 'maintenance')
      and not (b.short_code = any (v_codes)) and b.is_demo = v_demo;
  select coalesce(jsonb_agg(jsonb_build_object('code', b.short_code, 'status', b.status,
                    'recorded_stand', (select name from public.stands where id = b.current_stand_id)) order by b.short_code), '[]')
    into v_unexpected
    from public.bikes b where b.college_id = v_s.college_id and b.short_code = any (v_codes)
      and b.current_stand_id is distinct from v_s.id and b.is_demo = v_demo;

  update public.bikes set last_seen_at = now(), last_seen_stand_id = v_s.id
   where college_id = v_s.college_id and short_code = any (v_codes) and is_demo = v_demo;
  update public.bikes set current_stand_id = v_s.id, ai_flag = 'found_at_other_stand',
         status = case when status = 'missing' then 'available'::public.bike_status else status end
   where college_id = v_s.college_id and short_code = any (v_codes) and is_demo = v_demo
     and status in ('available', 'maintenance', 'missing') and current_stand_id is distinct from v_s.id;
  update public.bikes set ai_flag = 'not_seen_at_stand_check'
   where current_stand_id = v_s.id and status in ('available', 'maintenance')
     and not (short_code = any (v_codes)) and is_demo = v_demo;

  perform private.audit(v_s.college_id, 'stand.check', 'stand', v_s.id::text,
    jsonb_build_object('stand', v_s.name, 'seen', v_seen, 'missing', v_missing, 'unexpected', v_unexpected));
  return jsonb_build_object('ok', true, 'stand', v_s.name, 'seen', v_seen, 'missing', v_missing, 'unexpected', v_unexpected);
end $$;

-- ---------- issues ----------
create or replace function public.update_issue(
  p_issue_id uuid, p_status public.issue_status default null, p_note text default null,
  p_assign_to_me boolean default false, p_bike_maintenance boolean default null,
  p_source text default 'admin', p_ai_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_i public.issue_reports%rowtype;
begin
  select * into v_i from public.issue_reports where id = p_issue_id for update;
  if not found then perform private.raise('CC_ISSUE_NOT_FOUND'); end if;
  perform private.require_admin_of(v_i.college_id);
  perform private.require_demo_scope(v_i.is_demo);
  if p_status = 'resolved' and char_length(trim(coalesce(p_note, ''))) < 3 then perform private.raise('CC_REASON_REQUIRED'); end if;
  update public.issue_reports set
    status = coalesce(p_status, status),
    assigned_to = case when p_assign_to_me then auth.uid() else assigned_to end,
    resolution_note = case when p_status = 'resolved' then left(trim(p_note), 500) else resolution_note end,
    resolved_by = case when p_status = 'resolved' then auth.uid() else resolved_by end,
    resolved_at = case when p_status = 'resolved' then now() else resolved_at end
  where id = p_issue_id;
  if p_bike_maintenance is not null and v_i.bike_id is not null then
    perform public.set_bike_maintenance(v_i.bike_id, p_bike_maintenance, 'From issue: ' || v_i.type::text, p_source, p_ai_action_id);
  end if;
  if p_status is not null and p_status <> v_i.status and v_i.reporter_id is not null then
    perform private.notify(v_i.reporter_id, 'issue_update',
      case p_status when 'resolved' then 'Your report is resolved' when 'in_progress' then 'Your report is being handled' else 'Your report was reopened' end,
      coalesce(nullif(left(trim(p_note), 200), ''), 'Thanks for reporting.'), jsonb_build_object('issue_id', p_issue_id, 'screen', 'notifications'));
  end if;
  perform private.audit(v_i.college_id, 'issue.update', 'issue', p_issue_id::text,
    jsonb_build_object('status', p_status, 'note', p_note, 'maintenance', p_bike_maintenance, 'ai_action_id', p_ai_action_id),
    p_source, case when p_source = 'torq' then auth.uid() end);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- college settings ----------
create or replace function public.update_college_settings(
  p_college_id uuid, p_name text, p_max_ride_minutes int, p_strike_limit int, p_default_geofence_m int,
  p_email_domains text[], p_rules_text text, p_center_lat double precision default null, p_center_lng double precision default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_of(p_college_id);
  perform private.require_not_demo();
  update public.colleges set name = trim(p_name), max_ride_minutes = p_max_ride_minutes, strike_limit = p_strike_limit,
    default_geofence_m = p_default_geofence_m,
    email_domains = (select coalesce(array_agg(distinct lower(trim(d))), '{}') from unnest(coalesce(p_email_domains, '{}')) d where trim(d) <> ''),
    rules_text = coalesce(p_rules_text, ''),
    center_lat = coalesce(p_center_lat, center_lat), center_lng = coalesce(p_center_lng, center_lng)
  where id = p_college_id;
  perform private.audit(p_college_id, 'college.settings', 'college', p_college_id::text,
    jsonb_build_object('max_ride_minutes', p_max_ride_minutes, 'strike_limit', p_strike_limit,
                       'default_geofence_m', p_default_geofence_m, 'email_domains', p_email_domains));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.create_college(
  p_name text, p_short_code text, p_bike_prefix text, p_email_domains text[], p_time_zone text,
  p_center_lat double precision, p_center_lng double precision
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_super() then perform private.raise('CC_FORBIDDEN'); end if;
  perform private.require_not_demo();
  insert into public.colleges (name, short_code, bike_prefix, email_domains, time_zone, center_lat, center_lng, rules_text)
  values (trim(p_name), upper(trim(p_short_code)), upper(trim(p_bike_prefix)),
          (select coalesce(array_agg(lower(trim(d))), '{}') from unnest(coalesce(p_email_domains, '{}')) d where trim(d) <> ''),
          coalesce(nullif(p_time_zone, ''), 'Asia/Kolkata'), p_center_lat, p_center_lng,
          'Borrow and return only at CampusCycle stands. One bike per pass. Return within the ride time limit to avoid a strike.')
  returning id into v_id;
  insert into public.ai_settings (college_id) values (v_id);
  perform private.audit(v_id, 'college.create', 'college', v_id::text, jsonb_build_object('name', p_name, 'short_code', p_short_code));
  return jsonb_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  perform private.raise('CC_DUPLICATE');
  return null;
end $$;

create or replace function public.set_college_active(p_college_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super() then perform private.raise('CC_FORBIDDEN'); end if;
  perform private.require_not_demo();
  update public.colleges set active = p_active where id = p_college_id;
  perform private.audit(p_college_id, 'college.active', 'college', p_college_id::text, jsonb_build_object('active', p_active));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- dashboard ----------
create or replace function public.dashboard_stats(p_college_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_demo boolean := private.me_is_demo();
begin
  perform private.require_admin_of(p_college_id);
  return (
    select jsonb_build_object(
      'bikes_available', count(*) filter (where b.status = 'available'),
      'bikes_borrowed', count(*) filter (where b.status = 'borrowed'),
      'bikes_maintenance', count(*) filter (where b.status = 'maintenance'),
      'bikes_missing', count(*) filter (where b.status = 'missing'),
      'bikes_total', count(*) filter (where b.status <> 'retired'),
      'rides_active', (select count(*) from public.rides r where r.college_id = p_college_id and r.status = 'active' and private.demo_ok(r.is_demo) and (not v_demo or r.is_demo)),
      'rides_overdue', (select count(*) from public.rides r where r.college_id = p_college_id and r.status = 'active' and r.is_overdue and (not v_demo or r.is_demo)),
      'avg_ride_minutes_7d', (select coalesce(round(avg(extract(epoch from (r.ended_at - r.started_at)) / 60)), 0)
                                from public.rides r where r.college_id = p_college_id and r.ended_at > now() - interval '7 days' and (not v_demo or r.is_demo)),
      'pending_approvals', (select count(*) from public.profiles p where p.college_id = p_college_id and p.status = 'pending' and (not v_demo or p.is_demo)),
      'pending_id_match', (select count(*) from public.profiles p where p.college_id = p_college_id and p.status = 'pending'
                             and p.id_check_result ->> 'match' = 'yes' and (not v_demo or p.is_demo)),
      'open_issues', (select count(*) from public.issue_reports i where i.college_id = p_college_id and i.status <> 'resolved' and (not v_demo or i.is_demo)),
      'rides_yesterday', (select count(*) from public.rides r where r.college_id = p_college_id and (not v_demo or r.is_demo)
                            and (r.started_at at time zone 'Asia/Kolkata')::date = private.ist_today() - 1),
      'overdue_example', (select jsonb_build_object('bike', b2.short_code, 'pass', private.pass_label(c.short_code, rp.pass_number))
                            from public.rides r join public.bikes b2 on b2.id = r.bike_id join public.rider_passes rp on rp.id = r.pass_id
                            join public.colleges c on c.id = r.college_id
                            where r.college_id = p_college_id and r.status = 'active' and r.is_overdue and (not v_demo or r.is_demo)
                            order by r.due_at limit 1))
    from public.bikes b where b.college_id = p_college_id and (not v_demo or b.is_demo));
end $$;

create or replace function public.rides_per_day(p_college_id uuid, p_days int default 30)
returns table (day date, rides int)
language plpgsql stable security definer set search_path = '' as $$
declare v_demo boolean := private.me_is_demo();
begin
  perform private.require_admin_of(p_college_id);
  return query
  select d::date, (select count(*)::int from public.rides r where r.college_id = p_college_id
                     and (not v_demo or r.is_demo)
                     and (r.started_at at time zone 'Asia/Kolkata')::date = d::date)
  from generate_series(private.ist_today() - (p_days - 1), private.ist_today(), interval '1 day') d
  order by 1;
end $$;
```
