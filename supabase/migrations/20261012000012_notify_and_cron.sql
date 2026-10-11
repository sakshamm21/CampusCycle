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
