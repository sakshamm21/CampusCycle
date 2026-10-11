-- Service only. The private schema is not exposed through the API, so this is how
-- `scripts/db.mjs reset` writes the per-project values of private.app_config (01 §6.1).
create or replace function public.admin_set_app_config(p_key text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_key not in ('owner_email', 'functions_base_url', 'internal_secret') then
    raise exception 'bad key %', p_key;
  end if;
  perform private.set_config_value(p_key, coalesce(p_value, ''));
end $$;

-- Service only: lets the database tests run the ride timers without waiting for pg_cron
create or replace function public.admin_run_ride_timers() returns void
language sql security definer set search_path = '' as $$ select private.process_ride_timers() $$;

revoke execute on function public.admin_set_app_config(text, text), public.admin_run_ride_timers()
  from public, anon, authenticated;
