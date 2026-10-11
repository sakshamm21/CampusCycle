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
