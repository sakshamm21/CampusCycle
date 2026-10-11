-- New auth user → profile + pending pass. Role is NEVER taken from client metadata.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_owner_email text := private.config('owner_email');
  v_is_owner boolean := v_owner_email <> '' and lower(new.email) = lower(v_owner_email);
  v_college uuid;
  v_domains text[];
  v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if not v_is_owner then
    begin
      v_college := nullif(v_meta ->> 'college_id', '')::uuid;
    exception when others then
      v_college := null;
    end;
    if v_college is not null and not exists (select 1 from public.colleges where id = v_college and active) then
      v_college := null;
    end if;
  end if;

  select email_domains into v_domains from public.colleges where id = v_college;

  insert into public.profiles (
    id, college_id, email, full_name, phone, roll_number, role, status,
    email_domain_match, id_check_consent, rules_accepted_at, is_owner, approved_at)
  values (
    new.id, v_college, lower(coalesce(new.email, '')),
    left(coalesce(v_meta ->> 'full_name', ''), 120),
    left(coalesce(v_meta ->> 'phone', ''), 20),
    left(coalesce(v_meta ->> 'roll_number', ''), 40),
    case when v_is_owner then 'super_admin'::public.user_role else 'rider'::public.user_role end,
    case when v_is_owner then 'approved'::public.profile_status else 'pending'::public.profile_status end,
    coalesce(v_domain = any (v_domains), false),
    coalesce((v_meta ->> 'id_check_consent')::boolean, false),
    case when (v_meta ->> 'rules_accepted') = 'true' then now() end,
    v_is_owner,
    case when v_is_owner then now() end);

  insert into public.rider_passes (rider_id, college_id, status)
  values (new.id, v_college, 'pending');

  if not v_is_owner and v_college is not null then
    perform private.notify_admins(
      v_college, 'admin_alert', 'New rider waiting',
      coalesce(nullif(v_meta ->> 'full_name', ''), 'Someone') || ' asked to join.',
      jsonb_build_object('user_id', new.id, 'screen', 'approvals'), false);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Owner can never be demoted, suspended or deleted. Protected demo logins can never be
-- suspended, rejected or demoted.
create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_owner then perform private.raise('CC_OWNER_PROTECTED'); end if;
    return old;
  end if;
  if old.is_owner and (new.role <> 'super_admin' or new.status <> 'approved' or not new.is_owner) then
    perform private.raise('CC_OWNER_PROTECTED');
  end if;
  if old.demo_role is not null and (new.status in ('suspended', 'rejected') or new.role::text <> old.demo_role) then
    perform private.raise('CC_DEMO_PROTECTED');
  end if;
  return new;
end $$;

create trigger profiles_guard before update or delete on public.profiles
  for each row execute function private.guard_profile();

-- Protected demo logins keep their password and email forever: any change is refused.
create or replace function private.guard_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = old.id and p.demo_role is not null) then
    if new.encrypted_password is distinct from old.encrypted_password
       or new.email is distinct from old.email then
      raise exception using message = 'CC_DEMO_PROTECTED', errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger auth_user_guard before update on auth.users
  for each row execute function private.guard_auth_user();
