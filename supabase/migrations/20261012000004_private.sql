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
