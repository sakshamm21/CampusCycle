# 02b · Database part 2: storage, notifications, AI tables, demo, seed, tests

The second half of the database: migrations 11 to 17, the seed and the database tests. The rules at the top of `02-database.md` apply here too, and section numbers continue from that file.

## 13. Migration 11: `20261012000011_storage.sql`

Photos are compressed on the phone to max 1080 px long side, JPEG quality 0.6 (about 150 KB) before upload. Path convention: `<bucket>/<user_id>/<uuid>.jpg`.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('id-cards', 'id-cards', false, 2097152, array['image/jpeg', 'image/png']),
  ('return-photos', 'return-photos', false, 2097152, array['image/jpeg']),
  ('issue-photos', 'issue-photos', false, 2097152, array['image/jpeg']),
  ('torq-photos', 'torq-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Upload only into your own folder
create policy cc_upload_own on storage.objects for insert to authenticated
  with check (
    bucket_id in ('id-cards', 'return-photos', 'issue-photos', 'torq-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Read your own files
create policy cc_read_own on storage.objects for select to authenticated
  using (
    bucket_id in ('id-cards', 'return-photos', 'issue-photos', 'torq-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Admins read files of users in their college (demo admins: demo users only)
create policy cc_read_admin on storage.objects for select to authenticated
  using (
    bucket_id in ('id-cards', 'return-photos', 'issue-photos')
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and private.is_admin_of(p.college_id) and private.demo_ok(p.is_demo)));
-- No update/delete policies: only the service role (Edge Functions) deletes files.
```

## 14. Migration 12: `20261012000012_notify_and_cron.sql`

```sql
-- Calls an Edge Function asynchronously through pg_net with the internal secret.
create or replace function private.call_function(p_name text, p_body jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := private.config('functions_base_url') || '/' || p_name,
    body := coalesce(p_body, '{}'::jsonb),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-internal-secret', private.config('internal_secret')),
    timeout_milliseconds := 10000);
end $$;

-- Push every new notification whose user has a push token and has that category switched on.
create or replace function private.on_notification_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_prefs jsonb; v_cat text;
begin
  select push_token, notif_prefs into v_token, v_prefs from public.profiles where id = new.user_id;
  if v_token is null or v_token = '' then return new; end if;
  v_cat := case
    when new.kind in ('approval', 'rejection', 'suspension', 'reinstated', 'password_reset') then 'approval'
    when new.kind in ('ride_reminder', 'ride_overdue', 'ride_closed', 'strike') then 'reminders'
    else 'issues' end;
  if coalesce((v_prefs ->> v_cat)::boolean, true) = false
     and new.kind not in ('approval', 'suspension', 'ride_overdue') then
    return new;   -- approval, suspension and overdue are always pushed
  end if;
  perform private.call_function('push-send', jsonb_build_object('notification_id', new.id));
  return new;
end $$;

create trigger notifications_push after insert on public.notifications
  for each row execute function private.on_notification_insert();

-- Every 5 minutes: 15-minute reminders and overdue marking.
create or replace function private.process_ride_timers() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select rd.id, rd.rider_id, rd.pass_id, rd.due_at, rd.college_id, rd.is_demo, b.short_code, c.time_zone, c.short_code as ccode,
           rp.pass_number
    from public.rides rd join public.bikes b on b.id = rd.bike_id join public.colleges c on c.id = rd.college_id
    left join public.rider_passes rp on rp.id = rd.pass_id
    where rd.status = 'active' and rd.reminder_sent_at is null
      and now() >= rd.due_at - interval '15 minutes' and now() < rd.due_at
  loop
    perform private.notify(r.rider_id, 'ride_reminder', '15 minutes left',
      'Return ' || r.short_code || ' at any stand before ' || to_char(r.due_at at time zone r.time_zone, 'HH12:MI AM') ||
      ' to avoid a strike.', jsonb_build_object('screen', 'riding'));
    update public.rides set reminder_sent_at = now() where id = r.id;
  end loop;

  for r in
    select rd.id, rd.rider_id, rd.pass_id, rd.college_id, rd.is_demo, b.short_code, c.short_code as ccode, rp.pass_number,
           c.max_ride_minutes
    from public.rides rd join public.bikes b on b.id = rd.bike_id join public.colleges c on c.id = rd.college_id
    left join public.rider_passes rp on rp.id = rd.pass_id
    where rd.status = 'active' and not rd.is_overdue and now() > rd.due_at
  loop
    update public.rides set is_overdue = true, overdue_at = now() where id = r.id;
    update public.rider_passes set status = 'overdue' where id = r.pass_id and status = 'riding';
    perform private.notify(r.rider_id, 'ride_overdue', 'Your ride is overdue',
      r.short_code || ' is past the ' || (r.max_ride_minutes / 60.0)::numeric(4,1)::text ||
      ' hour limit. Return it at any stand now; a late return adds a strike.', jsonb_build_object('screen', 'riding'));
    perform private.notify_admins(r.college_id, 'admin_alert', 'Overdue ride',
      r.short_code || ' on pass ' || coalesce(private.pass_label(r.ccode, r.pass_number), '?') || ' is overdue.',
      jsonb_build_object('ride_id', r.id, 'screen', 'rides'), r.is_demo);
  end loop;
end $$;

select cron.schedule('cc-ride-timers', '*/5 * * * *', $$select private.process_ride_timers()$$);
-- 03:30 IST = 22:00 UTC
select cron.schedule('cc-photo-cleanup', '0 22 * * *', $$select private.call_function('cleanup-photos', '{}'::jsonb)$$);
```

## 15. Migration 13: `20261012000013_ai_tables.sql`

```sql
create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  college_id uuid references public.colleges (id) on delete set null,
  surface text not null check (surface in ('rider_chat', 'admin_console')),
  title text not null default 'New chat',
  summary text not null default '',
  summary_upto timestamptz,
  language text not null default 'en',
  is_demo boolean not null default false,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_threads_user on public.ai_threads (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  photo_path text,
  input_mode text not null default 'typed' check (input_mode in ('typed', 'voice')),
  run_id uuid,
  chart jsonb,
  table_data jsonb,
  action_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index ai_messages_thread on public.ai_messages (thread_id, created_at);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.ai_threads (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  college_id uuid references public.colleges (id) on delete set null,
  agent public.ai_agent not null,
  trigger public.ai_trigger not null,
  status public.ai_run_status not null default 'running',
  models_used text[] not null default '{}',
  steps int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  duration_ms int,
  error text,
  input_summary text,
  output_summary text,
  prompt_version text,
  is_demo boolean not null default false,
  is_seed boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index ai_runs_college_started on public.ai_runs (college_id, started_at desc);

create table public.ai_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_runs (id) on delete cascade,
  step_no int not null,
  kind public.ai_step_kind not null,
  agent public.ai_agent,
  name text not null default '',
  input jsonb,
  output jsonb,
  model text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  duration_ms int not null default 0,
  ok boolean not null default true,
  created_at timestamptz not null default now(),
  unique (run_id, step_no)
);

create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ai_runs (id) on delete set null,
  thread_id uuid references public.ai_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  college_id uuid references public.colleges (id) on delete set null,
  tool text not null,
  args jsonb not null,
  preview jsonb not null,
  status public.ai_action_status not null default 'proposed',
  expires_at timestamptz not null default now() + interval '15 minutes',
  confirmed_at timestamptz,
  result jsonb,
  error text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_actions_user on public.ai_actions (user_id, created_at desc);

create table public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) <= 300),
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index ai_memories_user on public.ai_memories (user_id);
create index ai_memories_vec on public.ai_memories using hnsw (embedding extensions.vector_cosine_ops);

create table public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  college_id uuid references public.colleges (id) on delete cascade,  -- null = global help text
  source text not null check (source in ('college_rules', 'help')),
  chunk_index int not null,
  content text not null,
  content_hash text not null,
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now()
);
create index ai_knowledge_college on public.ai_knowledge (college_id, source);
create index ai_knowledge_vec on public.ai_knowledge using hnsw (embedding extensions.vector_cosine_ops);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  kind public.ai_insight_kind not null,
  content jsonb not null,
  status public.ai_insight_status not null default 'active',
  valid_until timestamptz,
  run_id uuid references public.ai_runs (id) on delete set null,
  is_demo boolean not null default false,
  is_seed boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_insights_college_kind on public.ai_insights (college_id, kind, created_at desc);

alter table public.issue_reports
  add constraint issue_group_fk foreign key (group_id) references public.ai_insights (id) on delete set null;

create table public.ai_usage (
  day date not null,
  pool text not null,             -- 'user:<uuid>' | 'demo' | 'system:<college uuid>'
  user_id uuid references public.profiles (id) on delete set null,
  college_id uuid references public.colleges (id) on delete set null,
  steps int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  primary key (day, pool)
);

create table public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  college_id uuid unique references public.colleges (id) on delete cascade,   -- null = the single global row
  features jsonb not null default '{"rider_assistant": true, "return_photo_check": true, "snap_to_report": true,
    "id_card_check": true, "admin_copilot": true, "forecast": true, "daily_digest": true, "issue_grouping": true}'::jsonb,
  monthly_cap_usd numeric(6, 2) not null default 5.00 check (monthly_cap_usd between 0 and 5),
  daily_steps jsonb not null default '{"rider": 40, "college_admin": 150, "super_admin": 300, "demo_pool": 300, "system": 200}'::jsonb,
  model_routes jsonb,
  free_only boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create unique index ai_settings_one_global on public.ai_settings ((college_id is null)) where college_id is null;

create table public.ai_evals (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  model text not null,
  prompt_version text not null,
  cases_total int not null,
  cases_passed int not null,
  score numeric(5, 2) not null,
  safety_passed boolean not null,
  cost_usd numeric(10, 6) not null default 0,
  details jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_steps enable row level security;
alter table public.ai_actions enable row level security;
alter table public.ai_memories enable row level security;
alter table public.ai_knowledge enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_settings enable row level security;
alter table public.ai_evals enable row level security;

revoke insert, update, delete on public.ai_threads, public.ai_messages, public.ai_runs, public.ai_steps,
  public.ai_actions, public.ai_memories, public.ai_knowledge, public.ai_insights, public.ai_usage,
  public.ai_settings, public.ai_evals from anon, authenticated;
grant select on public.ai_threads, public.ai_messages, public.ai_runs, public.ai_steps, public.ai_actions,
  public.ai_insights, public.ai_settings, public.ai_evals to authenticated;
revoke select on public.ai_memories, public.ai_knowledge, public.ai_usage from anon, authenticated;

create policy ai_threads_own on public.ai_threads for select to authenticated using (user_id = (select auth.uid()));
create policy ai_messages_own on public.ai_messages for select to authenticated
  using (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = (select auth.uid())));
create policy ai_actions_own on public.ai_actions for select to authenticated using (user_id = (select auth.uid()));
create policy ai_runs_admin on public.ai_runs for select to authenticated
  using ((private.is_admin_of(college_id) or (college_id is null and private.is_super())) and private.demo_ok(is_demo));
create policy ai_steps_admin on public.ai_steps for select to authenticated
  using (exists (select 1 from public.ai_runs r where r.id = run_id
                 and (private.is_admin_of(r.college_id) or (r.college_id is null and private.is_super()))
                 and private.demo_ok(r.is_demo)));
create policy ai_insights_admin on public.ai_insights for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));
create policy ai_settings_admin on public.ai_settings for select to authenticated
  using (private.is_admin() and (college_id is null or private.is_admin_of(college_id)));
create policy ai_evals_admin on public.ai_evals for select to authenticated using (private.is_admin());
```

## 16. Migration 14: `20261012000014_ai_functions.sql`

Functions marked "service only" are revoked from `anon` and `authenticated`; Edge Functions call them with the service-role client.

```sql
-- ---------- vector search (service only) ----------
create or replace function public.match_ai_memories(p_user uuid, p_embedding extensions.vector(384), p_count int default 3,
                                                    p_min_similarity double precision default 0.75)
returns table (id uuid, content text, similarity double precision)
language sql stable security definer set search_path = '' as $$
  select m.id, m.content, 1 - (m.embedding operator(extensions.<=>) p_embedding) as similarity
  from public.ai_memories m
  where m.user_id = p_user and 1 - (m.embedding operator(extensions.<=>) p_embedding) >= p_min_similarity
  order by m.embedding operator(extensions.<=>) p_embedding
  limit p_count
$$;

create or replace function public.match_ai_knowledge(p_college uuid, p_embedding extensions.vector(384), p_count int default 4)
returns table (id uuid, source text, content text, similarity double precision)
language sql stable security definer set search_path = '' as $$
  select k.id, k.source, k.content, 1 - (k.embedding operator(extensions.<=>) p_embedding)
  from public.ai_knowledge k
  where k.college_id = p_college or k.college_id is null
  order by k.embedding operator(extensions.<=>) p_embedding
  limit p_count
$$;

-- ---------- usage + budget (service only) ----------
create or replace function public.ai_record_usage(p_pool text, p_user uuid, p_college uuid, p_steps int,
                                                  p_tokens_in int, p_tokens_out int, p_cost numeric)
returns void
language sql security definer set search_path = '' as $$
  insert into public.ai_usage as u (day, pool, user_id, college_id, steps, tokens_in, tokens_out, cost_usd)
  values (private.ist_today(), p_pool, p_user, p_college, p_steps, p_tokens_in, p_tokens_out, p_cost)
  on conflict (day, pool) do update set
    steps = u.steps + excluded.steps, tokens_in = u.tokens_in + excluded.tokens_in,
    tokens_out = u.tokens_out + excluded.tokens_out, cost_usd = u.cost_usd + excluded.cost_usd
$$;

create or replace function public.ai_budget_state(p_pool text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'month_cost_usd', (select coalesce(sum(cost_usd), 0) from public.ai_usage
                        where day >= date_trunc('month', private.ist_today())::date),
    'cap_usd', (select monthly_cap_usd from public.ai_settings where college_id is null),
    'free_only', (select free_only from public.ai_settings where college_id is null),
    'daily_steps', (select daily_steps from public.ai_settings where college_id is null),
    'model_routes', (select model_routes from public.ai_settings where college_id is null),
    'pool_steps_today', (select coalesce(steps, 0) from public.ai_usage where day = private.ist_today() and pool = p_pool))
$$;

-- Admin-facing summary for A15 (college admins: own college; super: global when p_college_id is null)
create or replace function public.ai_usage_summary(p_college_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_global boolean := p_college_id is null;
begin
  if v_global then
    if not private.is_super() then perform private.raise('CC_FORBIDDEN'); end if;
  else
    perform private.require_admin_of(p_college_id);
  end if;
  return jsonb_build_object(
    'month_cost_usd', (select coalesce(sum(cost_usd), 0) from public.ai_usage
                        where day >= date_trunc('month', private.ist_today())::date
                          and (v_global or college_id = p_college_id)),
    'all_month_cost_usd', (select coalesce(sum(cost_usd), 0) from public.ai_usage
                            where day >= date_trunc('month', private.ist_today())::date),
    'cap_usd', (select monthly_cap_usd from public.ai_settings where college_id is null),
    'demo_pool_today', (select coalesce(steps, 0) from public.ai_usage where day = private.ist_today() and pool = 'demo'),
    'demo_pool_limit', (select (daily_steps ->> 'demo_pool')::int from public.ai_settings where college_id is null),
    'per_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'steps', d.steps, 'cost_usd', d.cost) order by d.day), '[]'::jsonb)
                from (select day, sum(steps) as steps, sum(cost_usd) as cost from public.ai_usage
                      where day > private.ist_today() - 14 and (v_global or college_id = p_college_id)
                      group by day) d),
    'per_agent', (select coalesce(jsonb_agg(jsonb_build_object('agent', a.agent, 'runs', a.runs, 'cost_usd', a.cost)), '[]'::jsonb)
                  from (select agent, count(*) as runs, sum(cost_usd) as cost from public.ai_runs
                        where started_at > date_trunc('month', now()) and (v_global or college_id = p_college_id)
                          and private.demo_ok(is_demo)
                        group by agent) a));
end $$;

create or replace function public.update_ai_settings(
  p_college_id uuid, p_features jsonb default null, p_daily_steps jsonb default null,
  p_monthly_cap_usd numeric default null, p_model_routes jsonb default null, p_free_only boolean default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_not_demo();
  if p_college_id is null then
    if not private.is_super() then perform private.raise('CC_FORBIDDEN'); end if;
    if p_monthly_cap_usd is not null and (p_monthly_cap_usd < 0 or p_monthly_cap_usd > 5) then
      perform private.raise('CC_CAP_TOO_HIGH');
    end if;
    update public.ai_settings set
      daily_steps = coalesce(p_daily_steps, daily_steps), monthly_cap_usd = coalesce(p_monthly_cap_usd, monthly_cap_usd),
      model_routes = coalesce(p_model_routes, model_routes), free_only = coalesce(p_free_only, free_only),
      updated_at = now(), updated_by = auth.uid()
    where college_id is null;
  else
    perform private.require_admin_of(p_college_id);
    insert into public.ai_settings (college_id) values (p_college_id) on conflict (college_id) do nothing;
    update public.ai_settings set features = coalesce(p_features, features), updated_at = now(), updated_by = auth.uid()
    where college_id = p_college_id;
  end if;
  perform private.audit(p_college_id, 'ai.settings', 'ai_settings', coalesce(p_college_id::text, 'global'),
    jsonb_build_object('features', p_features, 'daily_steps', p_daily_steps, 'cap', p_monthly_cap_usd, 'free_only', p_free_only,
                       'routes_changed', p_model_routes is not null));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_insight_status(p_id uuid, p_status public.ai_insight_status) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_i public.ai_insights%rowtype;
begin
  select * into v_i from public.ai_insights where id = p_id for update;
  if not found then perform private.raise('CC_NOT_FOUND'); end if;
  perform private.require_admin_of(v_i.college_id);
  perform private.require_demo_scope(v_i.is_demo);
  update public.ai_insights set status = p_status where id = p_id;
  perform private.audit(v_i.college_id, 'ai.insight_status', 'ai_insight', p_id::text, jsonb_build_object('status', p_status, 'kind', v_i.kind));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.clear_my_ai_memory() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from public.ai_memories where user_id = auth.uid();
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_n);
end $$;

-- ---------- forecast inputs (service only). TS turns these into forecasts and moves ----------
-- For each active stand of the college: free bikes now, and for each IST hour 6..22 the average
-- departures and arrivals over the last 4 same weekdays.
create or replace function public.ai_forecast_inputs(p_college uuid, p_demo boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  with days as (
    select (private.ist_today() - (7 * g))::date as d from generate_series(1, 4) g
  ), hours as (select generate_series(6, 22) as h),
  dep as (
    select r.start_stand_id as stand_id, extract(hour from r.started_at at time zone 'Asia/Kolkata')::int as h, count(*)::numeric / 4 as n
    from public.rides r where r.college_id = p_college and r.is_demo = p_demo
      and (r.started_at at time zone 'Asia/Kolkata')::date in (select d from days)
    group by 1, 2
  ), arr as (
    select r.end_stand_id as stand_id, extract(hour from r.ended_at at time zone 'Asia/Kolkata')::int as h, count(*)::numeric / 4 as n
    from public.rides r where r.college_id = p_college and r.is_demo = p_demo and r.ended_at is not null
      and (r.ended_at at time zone 'Asia/Kolkata')::date in (select d from days)
    group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'stand_id', s.id, 'name', s.name, 'capacity', s.capacity,
    'free_now', (select count(*) from public.bikes b where b.current_stand_id = s.id and b.status = 'available' and b.is_demo = p_demo),
    'available_codes', (select coalesce(jsonb_agg(b.short_code order by b.short_code), '[]'::jsonb) from public.bikes b
                         where b.current_stand_id = s.id and b.status = 'available' and b.is_demo = p_demo),
    'hours', (select jsonb_agg(jsonb_build_object('h', hours.h,
                'dep', round(coalesce((select n from dep where dep.stand_id = s.id and dep.h = hours.h), 0), 2),
                'arr', round(coalesce((select n from arr where arr.stand_id = s.id and arr.h = hours.h), 0), 2)) order by hours.h)
              from hours)) order by s.name), '[]'::jsonb)
  from public.stands s where s.college_id = p_college and s.active
$$;

-- Yesterday's numbers for the digest (service only)
create or replace function public.ai_digest_inputs(p_college uuid, p_demo boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'rides_yesterday', (select count(*) from public.rides r where r.college_id = p_college and r.is_demo = p_demo
                          and (r.started_at at time zone 'Asia/Kolkata')::date = private.ist_today() - 1),
    'busiest_hour', (select extract(hour from r.started_at at time zone 'Asia/Kolkata')::int from public.rides r
                      where r.college_id = p_college and r.is_demo = p_demo
                        and (r.started_at at time zone 'Asia/Kolkata')::date = private.ist_today() - 1
                      group by 1 order by count(*) desc limit 1),
    'top_routes', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                     select ss.name as from_stand, es.name as to_stand, count(*) as rides from public.rides r
                     join public.stands ss on ss.id = r.start_stand_id join public.stands es on es.id = r.end_stand_id
                     where r.college_id = p_college and r.is_demo = p_demo
                       and (r.started_at at time zone 'Asia/Kolkata')::date = private.ist_today() - 1
                     group by 1, 2 order by 3 desc limit 3) x),
    'late_returns', (select count(*) from public.rides r where r.college_id = p_college and r.is_demo = p_demo and r.late
                       and (r.ended_at at time zone 'Asia/Kolkata')::date = private.ist_today() - 1),
    'open_issue_groups', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'title', g.content ->> 'title',
                             'urgency', g.content ->> 'urgency', 'count', (select count(*) from public.issue_reports i where i.group_id = g.id))), '[]'::jsonb)
                          from public.ai_insights g where g.college_id = p_college and g.kind = 'issue_group'
                            and g.status = 'active' and g.is_demo = p_demo),
    'flagged_bikes', (select coalesce(jsonb_agg(jsonb_build_object('code', b.short_code, 'flag', b.ai_flag)), '[]'::jsonb)
                      from public.bikes b where b.college_id = p_college and b.is_demo = p_demo and b.ai_flag is not null),
    'pending_approvals', (select count(*) from public.profiles p where p.college_id = p_college and p.is_demo = p_demo and p.status = 'pending'),
    'overdue_now', (select count(*) from public.rides r where r.college_id = p_college and r.is_demo = p_demo and r.status = 'active' and r.is_overdue))
$$;

revoke execute on function public.match_ai_memories(uuid, extensions.vector, int, double precision),
  public.match_ai_knowledge(uuid, extensions.vector, int),
  public.ai_record_usage(text, uuid, uuid, int, int, int, numeric), public.ai_budget_state(text),
  public.ai_forecast_inputs(uuid, boolean), public.ai_digest_inputs(uuid, boolean)
from public, anon, authenticated;

-- ---------- queue triggers: work for TORQ's background agents ----------
create or replace function private.ai_feature_on(p_college uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (features ->> p_feature)::boolean from public.ai_settings where college_id = p_college), true)
$$;

create or replace function private.on_ride_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.return_photo_path is not null and old.return_photo_path is null
     and private.ai_feature_on(new.college_id, 'return_photo_check') then
    perform private.call_function('torq-worker', jsonb_build_object('job', 'photo_check', 'ride_id', new.id));
  end if;
  return new;
end $$;
create trigger rides_photo_queue after update of return_photo_path on public.rides
  for each row execute function private.on_ride_photo();

create or replace function private.on_id_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id_photo_path is not null and new.id_check_consent and new.status = 'pending'
     and (old.id_photo_path is distinct from new.id_photo_path or old.id_check_consent is distinct from new.id_check_consent)
     and private.ai_feature_on(new.college_id, 'id_card_check') then
    perform private.call_function('torq-worker', jsonb_build_object('job', 'id_check', 'user_id', new.id));
  end if;
  return new;
end $$;
create trigger profiles_id_queue after update of id_photo_path, id_check_consent on public.profiles
  for each row execute function private.on_id_photo();

create or replace function private.on_issue_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_seed and private.ai_feature_on(new.college_id, 'issue_grouping') then
    perform private.call_function('torq-worker', jsonb_build_object('job', 'issue_triage', 'issue_id', new.id));
  end if;
  return new;
end $$;
create trigger issues_queue after insert on public.issue_reports
  for each row execute function private.on_issue_insert();

create or replace function private.on_rules_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.rules_text is distinct from old.rules_text then
    perform private.call_function('torq-knowledge', jsonb_build_object('college_id', new.id));
  end if;
  return new;
end $$;
create trigger colleges_rules_queue after update of rules_text on public.colleges
  for each row execute function private.on_rules_change();

-- ---------- sweep: expire actions, retry stuck AI work (max 3 attempts each) ----------
create or replace function private.torq_sweep() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.ai_actions set status = 'expired' where status = 'proposed' and expires_at < now();
  update public.ai_runs set status = 'failed', error = 'timed out', ended_at = now()
   where status = 'running' and started_at < now() - interval '5 minutes';

  update public.rides set photo_check = 'skipped'
   where status = 'returned' and return_photo_path is null and photo_check = 'pending' and ended_at < now() - interval '24 hours';

  for r in select id from public.rides where photo_check = 'pending' and return_photo_path is not null
             and photo_check_attempts < 3 and ended_at between now() - interval '1 day' and now() - interval '5 minutes' limit 10 loop
    perform private.call_function('torq-worker', jsonb_build_object('job', 'photo_check', 'ride_id', r.id));
  end loop;
  for r in select id from public.issue_reports where triaged_at is null and not is_seed and triage_attempts < 3
             and created_at between now() - interval '1 day' and now() - interval '5 minutes' limit 10 loop
    perform private.call_function('torq-worker', jsonb_build_object('job', 'issue_triage', 'issue_id', r.id));
  end loop;
  for r in select id from public.profiles where status = 'pending' and id_check_consent and id_photo_path is not null
             and id_check_result is null and id_check_attempts < 3 and applied_at < now() - interval '5 minutes' limit 10 loop
    perform private.call_function('torq-worker', jsonb_build_object('job', 'id_check', 'user_id', r.id));
  end loop;
end $$;

select cron.schedule('cc-torq-sweep', '*/10 * * * *', $$select private.torq_sweep()$$);
-- 06:00 IST = 00:30 UTC
select cron.schedule('cc-torq-morning', '30 0 * * *', $$select private.call_function('torq-cron', '{"job":"morning"}'::jsonb)$$);
```

## 17. Migration 15: `20261012000015_demo.sql`

Demo logins and sample people are auth users created by `scripts/seed-auth.mjs` (§18.4), because creating auth users in raw SQL is fragile across Supabase Auth versions. The script then calls the service-only functions below.

```sql
-- Service only. p_kind: 'rider' | 'college_admin' | 'super_admin' | 'sample_rider' | 'applicant'
create or replace function public.admin_setup_demo_account(
  p_user uuid, p_kind text, p_college uuid, p_pass_number int default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('rider', 'college_admin', 'super_admin', 'sample_rider', 'applicant') then
    raise exception 'bad kind %', p_kind;
  end if;
  update public.profiles set
    college_id = p_college, is_demo = true,
    demo_role = case when p_kind in ('rider', 'college_admin', 'super_admin') then p_kind end,
    role = case p_kind when 'college_admin' then 'college_admin'::public.user_role
                       when 'super_admin' then 'super_admin'::public.user_role else 'rider'::public.user_role end,
    status = case when p_kind = 'applicant' then 'pending'::public.profile_status else 'approved'::public.profile_status end,
    approved_at = case when p_kind = 'applicant' then null else now() end,
    rules_accepted_at = now(),
    email_domain_match = false
  where id = p_user;
  update public.rider_passes set college_id = p_college, is_demo = true,
    pass_number = case when p_kind = 'applicant' then null else p_pass_number end,
    status = case when p_kind = 'applicant' then 'pending'::public.pass_status else 'ready'::public.pass_status end,
    issued_at = case when p_kind = 'applicant' then null else now() end,
    minted_seen_at = case when p_kind = 'applicant' then null else now() end
  where rider_id = p_user;
end $$;

-- 60 days of believable rides for demo sample riders (+7 for the demo rider)
create or replace function private.generate_demo_history(p_college uuid, p_days int default 60) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_riders uuid[]; v_passes uuid[]; v_bikes uuid[]; v_halls uuid[]; v_academic uuid[]; v_all uuid[];
  v_day date; v_hour int; v_n int; v_i int; v_count int := 0; v_r int; v_dur int;
  v_from uuid; v_to uuid; v_start timestamptz; v_factor numeric;
  v_demo_rider uuid; v_demo_pass uuid; v_hall5 uuid; v_lhc uuid; v_lib uuid;
begin
  perform setseed(0.42);
  select array_agg(p.id order by p.email), array_agg(rp.id order by p.email) into v_riders, v_passes
  from public.profiles p join public.rider_passes rp on rp.rider_id = p.id
  where p.college_id = p_college and p.is_demo and p.demo_role is null and p.status = 'approved';
  select array_agg(id order by short_code) into v_bikes from public.bikes where college_id = p_college and is_demo and status <> 'retired';
  select array_agg(id order by name) into v_halls from public.stands where college_id = p_college and active and name like 'Hall %';
  select array_agg(id order by name) into v_academic from public.stands where college_id = p_college and active and name not like 'Hall %';
  select array_agg(id order by name) into v_all from public.stands where college_id = p_college and active;
  if v_riders is null or v_bikes is null or v_halls is null or v_academic is null then return 0; end if;

  for v_day in select g::date from generate_series(private.ist_today() - p_days, private.ist_today() - 1, interval '1 day') g loop
    v_factor := case when extract(isodow from v_day) in (6, 7) then 0.45 else 1.0 end;
    for v_hour in 7..22 loop
      v_n := floor((case v_hour when 8 then 14 when 9 then 9 when 13 then 7 when 17 then 10 when 18 then 9 when 19 then 6 else 3 end)
                   * v_factor * (0.7 + random() * 0.6))::int;
      for v_i in 1..v_n loop
        if v_hour in (8, 9, 13) then
          v_from := v_halls[1 + floor(random() * array_length(v_halls, 1))::int];
          v_to := v_academic[1 + floor(random() * array_length(v_academic, 1))::int];
        elsif v_hour in (17, 18, 19) then
          v_from := v_academic[1 + floor(random() * array_length(v_academic, 1))::int];
          v_to := v_halls[1 + floor(random() * array_length(v_halls, 1))::int];
        else
          v_from := v_all[1 + floor(random() * array_length(v_all, 1))::int];
          v_to := v_all[1 + floor(random() * array_length(v_all, 1))::int];
        end if;
        v_dur := 6 + floor(random() * 30)::int;
        v_start := (v_day + make_time(v_hour, floor(random() * 60)::int, 0)) at time zone 'Asia/Kolkata';
        v_r := 1 + floor(random() * array_length(v_riders, 1))::int;
        insert into public.rides (college_id, rider_id, pass_id, bike_id, start_stand_id, end_stand_id, started_at, due_at,
                                  ended_at, status, photo_check, flags, is_demo)
        values (p_college, v_riders[v_r], v_passes[v_r], v_bikes[1 + floor(random() * array_length(v_bikes, 1))::int],
                v_from, v_to, v_start, v_start + interval '4 hours', v_start + make_interval(mins => v_dur), 'returned',
                case when random() < 0.94 then 'ok'::public.photo_check else 'unclear'::public.photo_check end,
                array['seed_history'], true);
        v_count := v_count + 1;
      end loop;
    end loop;
  end loop;

  -- The demo rider: exactly 7 rides, Hall 5 regular (pass shows Graphite, 3 rides to Chrome)
  select p.id, rp.id into v_demo_rider, v_demo_pass from public.profiles p join public.rider_passes rp on rp.rider_id = p.id
   where p.demo_role = 'rider' and p.college_id = p_college;
  select id into v_hall5 from public.stands where college_id = p_college and name = 'Hall 5';
  select id into v_lhc from public.stands where college_id = p_college and name = 'Lecture Hall Complex';
  select id into v_lib from public.stands where college_id = p_college and name = 'Library';
  if v_demo_rider is not null then
    for v_i in 1..7 loop
      v_start := ((private.ist_today() - (v_i * 2)) + time '08:40') at time zone 'Asia/Kolkata';
      insert into public.rides (college_id, rider_id, pass_id, bike_id, start_stand_id, end_stand_id, started_at, due_at,
                                ended_at, status, photo_check, flags, is_demo)
      values (p_college, v_demo_rider, v_demo_pass, v_bikes[v_i], v_hall5, case when v_i % 2 = 0 then v_lib else v_lhc end,
              v_start, v_start + interval '4 hours', v_start + make_interval(mins => 9 + v_i * 2), 'returned', 'ok',
              array['seed_history'], true);
    end loop;
  end if;

  update public.rider_passes rp set
    total_rides = (select count(*) from public.rides r where r.pass_id = rp.id and r.status <> 'active'),
    total_minutes = (select coalesce(sum(greatest(1, ceil(extract(epoch from (r.ended_at - r.started_at)) / 60))), 0)::int
                     from public.rides r where r.pass_id = rp.id and r.status <> 'active')
  where rp.college_id = p_college and rp.is_demo;
  return v_count;
end $$;

-- Seeded issues, ID-check results, fallback digest and two example TORQ traces
create or replace function private.seed_demo_content(p_college uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s uuid[]; v_group uuid; v_rider uuid; v_admin uuid; v_thread uuid; v_run uuid;
begin
  select array_agg(p.id order by p.email) into v_s from public.profiles p
   where p.college_id = p_college and p.is_demo and p.demo_role is null and p.status = 'approved';
  select id into v_rider from public.profiles where demo_role = 'rider';
  select id into v_admin from public.profiles where demo_role = 'college_admin';
  if v_s is null then return; end if;

  -- Three brake reports about K-021, already grouped into one urgent issue
  insert into public.ai_insights (college_id, kind, content, status, is_demo, is_seed)
  values (p_college, 'issue_group', jsonb_build_object('title', 'K-021 brakes', 'urgency', 5,
          'summary', '3 riders reported weak brakes on K-021 since yesterday evening.'), 'active', true, true)
  returning id into v_group;
  insert into public.issue_reports (college_id, reporter_id, bike_id, type, note, status, group_id, urgency, triaged_at,
                                    ai_suggested_type, is_demo, is_seed, created_at)
  select p_college, v_s[x.i], (select id from public.bikes where short_code = 'K-021'), 'brakes', x.note, 'open', v_group, 5, now(),
         'brakes', true, true, now() - (x.i || ' hours')::interval
  from (values (1, 'Front brake barely works'), (2, 'Brakes very weak, almost hit someone'), (3, 'Back brake loose')) as x(i, note);
  insert into public.issue_reports (college_id, reporter_id, bike_id, type, note, status, urgency, triaged_at, ai_suggested_type, is_demo, is_seed)
  values
    (p_college, v_s[4], (select id from public.bikes where short_code = 'K-008'), 'flat_tyre', 'Rear tyre flat', 'open', 3, now(), 'flat_tyre', true, true),
    (p_college, v_s[5], (select id from public.bikes where short_code = 'K-012'), 'damaged_qr', 'Sticker peeling, scan fails', 'in_progress', 2, now(), 'damaged_qr', true, true);

  -- Applicants: three ID cards match, one does not
  update public.profiles set id_check_consent = true, id_check_result = case
      when email = 'applicant04@example.com' then jsonb_build_object('match', 'no', 'name_ok', false, 'roll_ok', true, 'college_ok', true,
           'notes', 'Name on the card is "Rohit Verma", typed name is "Rohan Verma".', 'model', 'seed', 'checked_at', now())
      else jsonb_build_object('match', 'yes', 'name_ok', true, 'roll_ok', true, 'college_ok', true,
           'notes', 'Name, roll number and college match the card.', 'model', 'seed', 'checked_at', now()) end
  where college_id = p_college and is_demo and email like 'applicant%@example.com';

  -- Fallback digest (the 06:00 TORQ run replaces it)
  insert into public.ai_insights (college_id, kind, content, status, valid_until, is_demo, is_seed)
  values (p_college, 'digest', jsonb_build_object(
    'title', 'good morning, ops team.',
    'items', jsonb_build_array(
      jsonb_build_object('n', (select count(*) from public.rides r where r.college_id = p_college and r.is_demo
                                  and (r.started_at at time zone 'Asia/Kolkata')::date = private.ist_today() - 1)::text,
                         'text', 'rides yesterday, busiest from 8 to 9 am between the halls and the Lecture Hall Complex.'),
      jsonb_build_object('n', '3', 'text', 'reports about K-021''s brakes, grouped into one issue and marked urgent.'),
      jsonb_build_object('n', '1', 'text', 'bike not seen at the Library stand check: K-017.'))),
    'active', now() + interval '1 day', true, true);

  -- Example rider conversation (Hinglish flat tyre) with a trace
  insert into public.ai_threads (user_id, college_id, surface, title, language, is_demo, is_seed)
  values (v_rider, p_college, 'rider_chat', 'Flat tyre on K-004', 'hinglish', true, true) returning id into v_thread;
  insert into public.ai_runs (thread_id, user_id, college_id, agent, trigger, status, models_used, steps, tokens_in, tokens_out,
                              cost_usd, duration_ms, input_summary, output_summary, prompt_version, is_demo, is_seed, started_at, ended_at)
  values (v_thread, v_rider, p_college, 'ride', 'chat', 'done', array['meta-llama/llama-3.3-70b-instruct:free'], 3, 2810, 210, 0, 4120,
          'K-004 ka tyre flat ho gaya, ab kya karu?', 'Walk it to the nearest stand, return it, report the flat.', 'ride.v1', true, true,
          now() - interval '2 days', now() - interval '2 days' + interval '4 seconds')
  returning id into v_run;
  insert into public.ai_messages (thread_id, role, content, input_mode, run_id, created_at) values
    (v_thread, 'user', 'K-004 ka tyre flat ho gaya 😩 ab kya karu?', 'voice', null, now() - interval '2 days'),
    (v_thread, 'assistant', 'Oof! K-004 ko Lecture Hall Complex stand tak le jao, sirf 80 m aage hai, aur wahi return kar do. Flat tyre ka report maine ready kar diya hai, bas Confirm dabao.', 'typed', v_run, now() - interval '2 days' + interval '4 seconds');
  insert into public.ai_steps (run_id, step_no, kind, agent, name, input, output, model, tokens_in, tokens_out, duration_ms) values
    (v_run, 1, 'model_call', 'orchestrator', 'route', '{"message":"K-004 ka tyre flat ho gaya"}', '{"route":"ride","language":"hinglish"}', 'openai/gpt-oss-20b:free', 640, 22, 610),
    (v_run, 2, 'tool_call', 'ride', 'get_my_status', '{}', '{"bike":"K-004","minutes_left":214}', null, 0, 0, 80),
    (v_run, 3, 'tool_call', 'ride', 'find_nearby_stands', '{"limit":2}', '[{"name":"Lecture Hall Complex","distance_m":80,"free_bikes":6}]', null, 0, 0, 95),
    (v_run, 4, 'model_call', 'ride', 'answer', '{"tools":2}', '{"proposed":"file_issue_report"}', 'meta-llama/llama-3.3-70b-instruct:free', 2170, 188, 3210);

  -- Example admin console run ("who has 2 strikes")
  insert into public.ai_threads (user_id, college_id, surface, title, language, is_demo, is_seed)
  values (v_admin, p_college, 'admin_console', 'Riders with 2 strikes', 'en', true, true) returning id into v_thread;
  insert into public.ai_runs (thread_id, user_id, college_id, agent, trigger, status, models_used, steps, tokens_in, tokens_out,
                              cost_usd, duration_ms, input_summary, output_summary, prompt_version, is_demo, is_seed, started_at, ended_at)
  values (v_thread, v_admin, p_college, 'ops', 'console', 'done', array['openai/gpt-oss-120b:free'], 2, 1900, 160, 0, 2900,
          'Who has 2 strikes?', '1 rider has 2 strikes.', 'ops.v1', true, true, now() - interval '1 day', now() - interval '1 day' + interval '3 seconds')
  returning id into v_run;
  insert into public.ai_messages (thread_id, role, content, run_id, table_data, created_at) values
    (v_thread, 'user', 'Who has 2 strikes?', null, null, now() - interval '1 day'),
    (v_thread, 'assistant', 'One rider is one strike away from suspension.', v_run,
     jsonb_build_object('columns', jsonb_build_array('Rider', 'Pass', 'Strikes'),
                        'rows', (select jsonb_agg(jsonb_build_array(p.full_name, private.pass_label('IITK', rp.pass_number), p.strikes))
                                 from public.profiles p join public.rider_passes rp on rp.rider_id = p.id
                                 where p.college_id = p_college and p.is_demo and p.strikes = 2)),
     now() - interval '1 day' + interval '3 seconds');
  insert into public.ai_steps (run_id, step_no, kind, agent, name, input, output, model, tokens_in, tokens_out, duration_ms) values
    (v_run, 1, 'tool_call', 'ops', 'find_riders', '{"strikes_gte":2}', '{"count":1}', null, 0, 0, 120),
    (v_run, 2, 'model_call', 'ops', 'answer', '{"tools":1}', '{"table":true}', 'openai/gpt-oss-120b:free', 1900, 160, 2700);
end $$;

-- Nightly reset of everything demo users can change
create or replace function private.demo_reset() returns void
language plpgsql security definer set search_path = '' as $$
declare v_college uuid; v_demo_users uuid[];
begin
  for v_college in select distinct college_id from public.profiles where demo_role is not null and college_id is not null loop
    select array_agg(id) into v_demo_users from public.profiles where college_id = v_college and is_demo;

    -- 1. release passes and bikes, remove all demo rides and issues
    update public.rider_passes set status = 'ready', current_bike_id = null, current_ride_id = null, borrowed_at = null
     where college_id = v_college and is_demo and status in ('riding', 'overdue');
    update public.bikes set status = 'available', current_pass_id = null
     where college_id = v_college and is_demo and status = 'borrowed';
    delete from public.issue_reports where college_id = v_college and is_demo;
    delete from public.rides where college_id = v_college and is_demo;

    -- 2. bikes back to their home stands; bikes added by visitors are removed
    delete from public.bikes b where b.college_id = v_college and b.is_demo
      and not exists (select 1 from private.demo_bike_home h where h.short_code = b.short_code);
    update public.bikes b set status = 'available', current_pass_id = null, current_stand_id = s.id,
      last_seen_at = now(), last_seen_stand_id = s.id, maintenance_after_return = false, ai_flag = null, notes = ''
    from private.demo_bike_home h join public.stands s on s.name = h.stand_name and s.college_id = v_college
    where b.short_code = h.short_code and b.college_id = v_college;
    update public.bikes set status = 'maintenance', notes = 'Brakes squeak, waiting for a mechanic.'
     where college_id = v_college and short_code = 'K-023';
    update public.bikes set ai_flag = 'not_seen_at_stand_check' where college_id = v_college and short_code = 'K-017';

    -- 3. people back to their seeded state
    update public.profiles set status = 'approved', strikes = 0, suspended_reason = null, rejection_reason = null,
      password_reset_requested_at = null
     where college_id = v_college and is_demo and email not like 'applicant%@example.com';
    update public.profiles set strikes = 2 where college_id = v_college and email = 'sample03@example.com';
    update public.rider_passes rp set status = 'ready'
      from public.profiles p where p.id = rp.rider_id and p.college_id = v_college and p.is_demo
       and p.email not like 'applicant%@example.com';
    update public.profiles set status = 'pending', approved_at = null, approved_by = null, rejection_reason = null,
      applied_at = now() - interval '3 hours'
     where college_id = v_college and is_demo and email like 'applicant%@example.com';
    update public.rider_passes rp set status = 'pending', pass_number = null, issued_at = null, minted_seen_at = null
      from public.profiles p where p.id = rp.rider_id and p.email like 'applicant%@example.com' and p.college_id = v_college;

    -- 4. inbox, AI conversations, memory, insights, usage pool
    delete from public.notifications where user_id = any (v_demo_users);
    delete from public.ai_actions where is_demo and college_id = v_college;
    delete from public.ai_threads where is_demo and college_id = v_college;
    delete from public.ai_runs where is_demo and college_id = v_college;
    delete from public.ai_memories where user_id = any (v_demo_users);
    delete from public.ai_insights where is_demo and college_id = v_college;
    delete from public.ai_usage where pool = 'demo' and day = private.ist_today();
    delete from public.audit_log where is_demo and created_at < now() - interval '7 days';

    -- 5. regenerate history and seeded content
    perform private.generate_demo_history(v_college, 60);
    perform private.seed_demo_content(v_college);
  end loop;
  perform private.set_config_value('last_demo_reset_at', now()::text);
end $$;

-- Service only: lets scripts/seed-auth.mjs run the full demo reset once after creating users
create or replace function public.admin_run_demo_reset() returns void
language sql security definer set search_path = '' as $$ select private.demo_reset() $$;

revoke execute on function public.admin_setup_demo_account(uuid, text, uuid, int), public.admin_run_demo_reset()
  from public, anon, authenticated;

-- 04:00 IST = 22:30 UTC
select cron.schedule('cc-demo-reset', '30 22 * * *', $$select private.demo_reset()$$);
```

## 18. Migration 16: `20261012000016_realtime.sql`

```sql
alter publication supabase_realtime add table
  public.bikes, public.rides, public.rider_passes, public.profiles, public.notifications,
  public.issue_reports, public.ai_actions;
```

Realtime respects RLS: riders receive only their own `profiles`, `rider_passes`, `notifications`, `ai_actions` rows; admins receive their college's rows.

## 19. Migration 17: `20261012000017_extras.sql`

Two read functions used by the admin site: signed sample QRs for the public `/try` page, and the super admin overview of every college (A16).

```sql
-- Signed sample QRs of available demo bikes for the public /try page (anon).
-- Safe: demo bikes can only be borrowed by demo accounts (borrow_bike checks is_demo).
create or replace function public.demo_qr_samples()
returns table (code text, stand_name text, payload text)
language sql stable security definer set search_path = '' as $$
  select b.short_code, s.name, private.bike_payload(b.short_code)
  from public.bikes b join public.stands s on s.id = b.current_stand_id
  where b.is_demo and b.status = 'available'
  order by s.name, b.short_code
  limit 30
$$;
grant execute on function public.demo_qr_samples() to anon, authenticated;

-- Super admin overview of every college (A16)
create or replace function public.colleges_overview()
returns table (id uuid, name text, short_code text, active boolean, stands int, bikes int, riders int,
               pending int, admins int, rides_7d int)
language plpgsql stable security definer set search_path = '' as $$
declare v_demo boolean := private.me_is_demo();
begin
  if not private.is_super() then perform private.raise('CC_FORBIDDEN'); end if;
  return query
  select c.id, c.name, c.short_code, c.active,
    (select count(*)::int from public.stands s where s.college_id = c.id and s.active),
    (select count(*)::int from public.bikes b where b.college_id = c.id and b.status <> 'retired' and (not v_demo or b.is_demo)),
    (select count(*)::int from public.profiles p where p.college_id = c.id and p.role = 'rider' and p.status = 'approved' and (not v_demo or p.is_demo)),
    (select count(*)::int from public.profiles p where p.college_id = c.id and p.status = 'pending' and (not v_demo or p.is_demo)),
    (select count(*)::int from public.profiles p where p.college_id = c.id and p.role = 'college_admin' and p.status = 'approved' and (not v_demo or p.is_demo)),
    (select count(*)::int from public.rides r where r.college_id = c.id and r.started_at > now() - interval '7 days' and (not v_demo or r.is_demo))
  from public.colleges c
  order by c.name;
end $$;
```

After adding it, run `pnpm db:types` so both functions appear in `database.types.ts`.

## 20. Seed (`supabase/seed/`)

`supabase/config.toml` contains:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed/01_iitk.sql", "./seed/02_ai_settings.sql"]
```

All seed SQL is idempotent (`on conflict do nothing` / `do update`). Fixed UUIDs keep tests and scripts stable.

### 20.1 `supabase/seed/01_iitk.sql`

IITK is onboarded from public information. Stand coordinates are taken from OpenStreetMap and are approximate (within about 200 m). Demo accounts skip the geofence, so the demo works regardless. **Sak does this in Phase 2 (P2-T12):** open A10 Stands as the owner and drag each stand pin onto the exact spot shown on the OpenStreetMap layer, then save.

```sql
insert into public.colleges (id, name, short_code, bike_prefix, email_domains, time_zone, max_ride_minutes, strike_limit,
                             default_geofence_m, center_lat, center_lng, next_pass_no, rules_text)
values ('11111111-1111-4111-8111-111111111111', 'IIT Kanpur', 'IITK', 'K', array['iitk.ac.in'], 'Asia/Kolkata', 240, 3, 40,
        26.5123, 80.2329, 1001,
$rules$1. Borrow and return bikes only at CampusCycle stands. The app checks that you are inside the stand.
2. One bike per pass. The bike stays on your Rider Pass until you return it at any stand.
3. Maximum ride time is 4 hours. You get a reminder 15 minutes before the limit.
4. To return: park inside the stand, tap Return, scan the same bike and take one photo of it parked.
5. A late return adds a strike. At 3 strikes your pass is suspended until a college admin reinstates it.
6. If a bike is faulty (flat tyre, brakes, chain, damaged sticker), report it from the app and do not ride it.
7. Never lend your pass. If anyone asks, show the bike on your pass. Admins may scan your pass QR.
8. Ride on the left, use a light after dark and park inside the stand markings.
9. If you cannot reach a stand (accident, puncture far away), report a problem and an admin will close your ride.$rules$)
on conflict (id) do nothing;

insert into public.stands (id, college_id, name, lat, lng, radius_m, capacity) values
  ('22222222-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Main Gate',            26.5036, 80.2311, 40, 8),
  ('22222222-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Lecture Hall Complex', 26.5096, 80.2330, 40, 10),
  ('22222222-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Library',              26.5110, 80.2341, 40, 8),
  ('22222222-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Computer Centre',      26.5121, 80.2349, 40, 6),
  ('22222222-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'New SAC',              26.5145, 80.2373, 40, 6),
  ('22222222-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Shopping Complex',     26.5089, 80.2268, 40, 6),
  ('22222222-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Hall 1',               26.5076, 80.2284, 40, 6),
  ('22222222-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Hall 5',               26.5121, 80.2265, 40, 6),
  ('22222222-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Hall 8',               26.5137, 80.2247, 40, 6),
  ('22222222-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'Hall 12',              26.5170, 80.2302, 40, 6)
on conflict (id) do nothing;

-- 30 demo bikes, 3 per stand, in stand order: K-001..K-003 Main Gate, K-004..K-006 Lecture Hall Complex, ...
insert into private.demo_bike_home (short_code, stand_name)
select 'K-' || lpad(n::text, 3, '0'),
       (array['Main Gate', 'Lecture Hall Complex', 'Library', 'Computer Centre', 'New SAC',
              'Shopping Complex', 'Hall 1', 'Hall 5', 'Hall 8', 'Hall 12'])[((n - 1) / 3) + 1]
from generate_series(1, 30) n
on conflict (short_code) do nothing;

insert into public.bikes (college_id, short_code, status, current_stand_id, last_seen_at, last_seen_stand_id, is_demo)
select '11111111-1111-4111-8111-111111111111', h.short_code, 'available', s.id, now(), s.id, true
from private.demo_bike_home h
join public.stands s on s.name = h.stand_name and s.college_id = '11111111-1111-4111-8111-111111111111'
on conflict (short_code) do nothing;
```

### 20.2 `supabase/seed/02_ai_settings.sql`

```sql
insert into public.ai_settings (college_id, monthly_cap_usd) values (null, 5.00)
on conflict do nothing;
insert into public.ai_settings (college_id) values ('11111111-1111-4111-8111-111111111111')
on conflict (college_id) do nothing;
```

`model_routes` stays `null` in the database; the router then uses the defaults in `packages/torq/src/router/routes.ts` (07-torq.md §6). A super admin can override them on A15.

### 20.3 Demo people (created by `scripts/seed-auth.mjs`)

| Kind                      | Email                                                 | Password                       | Name                                               | Pass number    | Notes                                              |
| ------------------------- | ----------------------------------------------------- | ------------------------------ | -------------------------------------------------- | -------------- | -------------------------------------------------- |
| rider (protected)         | `demo-rider@example.com`                              | `ride-the-demo-2026`           | Aanya Sharma                                       | 421            | 7 rides, Hall 5 regular                            |
| college_admin (protected) | `demo-admin@example.com`                              | `ride-the-demo-2026`           | Demo Admin                                         | 422            | IITK college admin                                 |
| super_admin (protected)   | `demo-super@example.com`                              | `ride-the-demo-2026`           | Demo Super Admin                                   | 423            | sees demo data of every college                    |
| sample_rider ×20          | `sample01@example.com` … `sample20@example.com`       | random 24 chars, never printed | names from the list below                          | 101–120        | history only; `sample03` has 2 strikes             |
| applicant ×4              | `applicant01@example.com` … `applicant04@example.com` | random 24 chars                | Ishaan Gupta, Meera Iyer, Kabir Singh, Rohan Verma | none (pending) | with sample ID card images; applicant04 mismatched |

Sample rider names (in order): Arjun Mehta, Diya Patel, Vihaan Rao, Saanvi Nair, Aditya Kumar, Ananya Joshi, Reyansh Das, Myra Kapoor, Krish Malhotra, Aarohi Bose, Vivaan Reddy, Kiara Menon, Ayaan Chatterjee, Ira Shah, Dhruv Pillai, Tara Banerjee, Rudra Saxena, Anika Desai, Shaurya Kulkarni, Zoya Khan.

Demo emails use the reserved domain `example.com`, never `iitk.ac.in`, so the IITK domain badge is never shown for them. The demo password is public on purpose (README and A01 buttons); the guard trigger stops anyone changing it.

### 20.4 `scripts/seed-auth.mjs` (exact behaviour)

Run with `pnpm seed:auth` (dev project, reads `.env`) or `pnpm seed:auth:prod` (production project, reads `.env.prod`); `--target dev|prod` selects the file (01 §3.4). Uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL` and `OWNER_PASSWORD` from it. Steps:

1. Create a supabase-js admin client (`auth: { persistSession: false }`).
2. For each person in §20.3: `auth.admin.listUsers` lookup by email (page through, 200 per page); if missing, `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, college_id: IITK_ID, phone: '+91 90000 00XXX', roll_number } })`. Roll numbers: demo rider `230421`, admin `ADM-001`, super `ADM-002`, samples `2301NN`, applicants `2402NN`.
3. Call `rpc('admin_setup_demo_account', { p_user, p_kind, p_college: IITK_ID, p_pass_number })`.
4. Applicants: upload `supabase/seed/assets/id-cards/applicantNN.png` to bucket `id-cards` at `<user_id>/id-sample.png` (`upsert: true`), then `update profiles set id_photo_path` with the service client.
5. If env `OWNER_EMAIL` and `OWNER_PASSWORD` are set and no user has that email: `createUser({ email: OWNER_EMAIL, password: OWNER_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Owner' } })`. The trigger makes it the owner **only if** `private.app_config.owner_email` already equals that email (Sak sets it first, P1-T21). Print `owner: created` or `owner: exists`; never print the email or password.
6. Call `rpc('admin_run_demo_reset')`.
7. Print a table of demo logins (emails and the public demo password only) and `done`.

`scripts/make-demo-id-cards.mjs` renders the four sample ID cards with `sharp` from inline SVG (1000×630 px, white card, grey header "SAMPLE STUDENT ID · NOT A REAL CARD", fields Name, Roll No, Programme "B.Tech", Institute "IIT Kanpur", a grey photo square, diagonal "SAMPLE" watermark at 12% opacity). applicant04's card prints "Rohit Verma" (typed name is Rohan Verma). Output: `supabase/seed/assets/id-cards/applicant01.png` … `applicant04.png` (committed).

## 21. Database tests (`supabase/tests/database/`)

Run with `pnpm db:test` (`vitest run supabase/tests/database`, 01 §6.1), which runs each test file against the hosted Supabase project using `@supabase/supabase-js`. No local PostgreSQL binaries or `psql` are required.

### 21.1 `helpers.ts` (`supabase/tests/database/helpers.ts`)

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const adminClient: SupabaseClient = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

export async function createTestCollege(code: string, prefix: string) {
  const { data, error } = await adminClient
    .from('colleges')
    .insert({
      name: `Test ${code}`,
      short_code: code,
      bike_prefix: prefix,
      email_domains: [`${code.toLowerCase()}.test`],
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function createTestStand(collegeId: string, name: string, lat: number, lng: number) {
  const { data, error } = await adminClient
    .from('stands')
    .insert({ college_id: collegeId, name, lat, lng, radius_m: 40, capacity: 2 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function createTestBike(collegeId: string, code: string, standId: string, isDemo = false) {
  const { data, error } = await adminClient
    .from('bikes')
    .insert({ college_id: collegeId, short_code: code, current_stand_id: standId, is_demo: isDemo })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
```

### 21.2 `010_borrow_return.test.ts` (full pattern)

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { adminClient, createTestCollege, createTestStand, createTestBike } from './helpers';

describe('Borrow and Return RPCs', () => {
  let collegeId: string;
  let standAId: string;
  let standBId: string;
  let bike1Id: string;
  let bikeSig: string;

  beforeAll(async () => {
    collegeId = await createTestCollege('TA', 'TA');
    standAId = await createTestStand(collegeId, 'Stand A', 26.5, 80.2);
    standBId = await createTestStand(collegeId, 'Stand B', 26.51, 80.21);
    bike1Id = await createTestBike(collegeId, 'TA-001', standAId);

    const { data: sig } = await adminClient.rpc('demo_sign_bike', { p_short_code: 'TA-001' });
    bikeSig = sig || 'test-sig';
  });

  it('rejects borrow with bad QR signature', async () => {
    const { data } = await adminClient.rpc('borrow_bike', {
      p_short_code: 'TA-001',
      p_signature: 'wrongsignature00000000',
      p_lat: 26.5,
      p_lng: 80.2,
      p_accuracy_m: 10,
      p_is_mock: false,
    });
    expect(data?.code).toBe('CC_BAD_QR');
  });

  it('rejects borrow when outside geofence', async () => {
    const { data } = await adminClient.rpc('borrow_bike', {
      p_short_code: 'TA-001',
      p_signature: bikeSig,
      p_lat: 26.6,
      p_lng: 80.3,
      p_accuracy_m: 10,
      p_is_mock: false,
    });
    expect(data?.code).toBe('CC_NOT_AT_STAND');
  });

  it('rejects borrow with mock location', async () => {
    const { data } = await adminClient.rpc('borrow_bike', {
      p_short_code: 'TA-001',
      p_signature: bikeSig,
      p_lat: 26.5,
      p_lng: 80.2,
      p_accuracy_m: 10,
      p_is_mock: true,
    });
    expect(data?.code).toBe('CC_MOCK_LOCATION');
  });
});
```

The other database test files and their cases are listed in `09-testing-release.md` §2.1. Each follows the TypeScript/Vitest pattern above.
