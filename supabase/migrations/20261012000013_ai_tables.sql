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
