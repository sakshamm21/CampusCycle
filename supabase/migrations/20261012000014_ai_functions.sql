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
