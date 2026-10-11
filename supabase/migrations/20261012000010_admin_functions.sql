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
