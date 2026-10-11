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
