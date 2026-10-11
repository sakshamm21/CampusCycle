create or replace function private.me_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.me_college() returns uuid
language sql stable security definer set search_path = '' as $$
  select college_id from public.profiles where id = auth.uid()
$$;

create or replace function private.me_is_demo() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_demo from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
$$;

create or replace function private.is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and status = 'approved' and role = 'super_admin')
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and status = 'approved' and role in ('college_admin', 'super_admin'))
$$;

create or replace function private.is_admin_of(p_college uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
      and (role = 'super_admin' or (role = 'college_admin' and college_id = p_college)))
$$;

-- Demo users see only demo rows; real users see everything they are otherwise allowed to see.
create or replace function private.demo_ok(p_row_is_demo boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select (not private.me_is_demo()) or coalesce(p_row_is_demo, false)
$$;

-- Raises CC_FORBIDDEN unless the caller administers the college
create or replace function private.require_admin_of(p_college uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_of(p_college) then perform private.raise('CC_FORBIDDEN'); end if;
end $$;

-- Raises CC_DEMO_FORBIDDEN when a demo caller targets a real (non-demo) row
create or replace function private.require_demo_scope(p_target_is_demo boolean) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.me_is_demo() and not coalesce(p_target_is_demo, false) then
    perform private.raise('CC_DEMO_FORBIDDEN');
  end if;
end $$;

-- Raises CC_DEMO_READONLY for demo callers (college settings, stands, colleges, roles, AI routes)
create or replace function private.require_not_demo() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.me_is_demo() then perform private.raise('CC_DEMO_READONLY'); end if;
end $$;

-- ---------- audit + notifications ----------
create or replace function private.audit(
  p_college uuid, p_action text, p_target_type text, p_target_id text,
  p_details jsonb default '{}'::jsonb, p_via text default 'admin', p_confirmed_by uuid default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (college_id, actor_id, confirmed_by, via, action, target_type, target_id, details, is_demo)
  values (p_college, auth.uid(), p_confirmed_by, p_via, p_action, p_target_type, p_target_id,
          coalesce(p_details, '{}'::jsonb), private.me_is_demo())
$$;

create or replace function private.notify(
  p_user uuid, p_kind public.notification_kind, p_title text, p_body text, p_data jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, college_id, kind, title, body, data)
  select p_user, p.college_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.profiles p where p.id = p_user
$$;

-- Notifies approved college admins of the college with matching demo flag.
-- Real events with no real college admin go to the owner (who approves IITK until it has an admin).
create or replace function private.notify_admins(
  p_college uuid, p_kind public.notification_kind, p_title text, p_body text,
  p_data jsonb default '{}'::jsonb, p_is_demo boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  insert into public.notifications (user_id, college_id, kind, title, body, data)
  select p.id, p_college, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.profiles p
  where p.role = 'college_admin' and p.status = 'approved' and p.college_id = p_college
    and p.is_demo = coalesce(p_is_demo, false);
  get diagnostics v_count = row_count;
  if v_count = 0 and not coalesce(p_is_demo, false) then
    insert into public.notifications (user_id, college_id, kind, title, body, data)
    select p.id, p_college, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb)
    from public.profiles p where p.is_owner;
  end if;
end $$;

grant execute on function
  private.me_role(), private.me_college(), private.me_is_demo(), private.is_approved(),
  private.is_super(), private.is_admin(), private.is_admin_of(uuid), private.demo_ok(boolean)
to anon, authenticated;
