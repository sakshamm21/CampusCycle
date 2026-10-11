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
