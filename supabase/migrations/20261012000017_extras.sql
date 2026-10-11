-- Signed sample QRs of available demo bikes for the public /try page (anon).
-- Safe: demo bikes can only be borrowed by demo accounts (borrow_bike checks is_demo).
create or replace function public.demo_qr_samples()
returns table (code text, stand_name text, payload text)
language sql stable security definer set search_path = '' as $$
  select b.short_code, s.name, private.bike_payload(b.short_code)
  from public.bikes b join public.stands s on s.id = b.current_stand_id
  where b.is_demo and b.status = 'available'
  order by s.name, b.short_code
  limit 30
$$;
grant execute on function public.demo_qr_samples() to anon, authenticated;

-- Super admin overview of every college (A16)
create or replace function public.colleges_overview()
returns table (id uuid, name text, short_code text, active boolean, stands int, bikes int, riders int,
               pending int, admins int, rides_7d int)
language plpgsql stable security definer set search_path = '' as $$
declare v_demo boolean := private.me_is_demo();
begin
  if not private.is_super() then perform private.raise('CC_FORBIDDEN'); end if;
  return query
  select c.id, c.name, c.short_code, c.active,
    (select count(*)::int from public.stands s where s.college_id = c.id and s.active),
    (select count(*)::int from public.bikes b where b.college_id = c.id and b.status <> 'retired' and (not v_demo or b.is_demo)),
    (select count(*)::int from public.profiles p where p.college_id = c.id and p.role = 'rider' and p.status = 'approved' and (not v_demo or p.is_demo)),
    (select count(*)::int from public.profiles p where p.college_id = c.id and p.status = 'pending' and (not v_demo or p.is_demo)),
    (select count(*)::int from public.profiles p where p.college_id = c.id and p.role = 'college_admin' and p.status = 'approved' and (not v_demo or p.is_demo)),
    (select count(*)::int from public.rides r where r.college_id = c.id and r.started_at > now() - interval '7 days' and (not v_demo or r.is_demo))
  from public.colleges c
  order by c.name;
end $$;
