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
