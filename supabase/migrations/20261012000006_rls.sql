create or replace function public.pass_label_of(p_short_code text, p_number int) returns text
language sql immutable set search_path = '' as $$
  select case when p_number is null or p_short_code is null then null
              else p_short_code || ' · ' || lpad(p_number::text, 4, '0') end
$$;
grant execute on function public.pass_label_of(text, int) to anon, authenticated;

alter table public.colleges enable row level security;
alter table public.profiles enable row level security;
alter table public.stands enable row level security;
alter table public.bikes enable row level security;
alter table public.rider_passes enable row level security;
alter table public.rides enable row level security;
alter table public.issue_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Default deny for writes from clients
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

-- profiles: a user may update only these columns on their own row
grant update (phone, push_token, notif_prefs, theme) on public.profiles to authenticated;

-- ---------- colleges ----------
create policy colleges_read on public.colleges for select to anon, authenticated
  using (active or private.is_super());

-- ---------- profiles ----------
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_read_admin on public.profiles for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));
create policy profiles_read_super_no_college on public.profiles for select to authenticated
  using (college_id is null and private.is_super());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- stands ----------
create policy stands_read on public.stands for select to authenticated
  using (college_id = private.me_college() or private.is_admin_of(college_id));

-- ---------- bikes ----------
create policy bikes_read_rider on public.bikes for select to authenticated
  using (college_id = private.me_college() and private.is_approved() and is_demo = private.me_is_demo());
create policy bikes_read_admin on public.bikes for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- rider_passes ----------
create policy passes_read_own on public.rider_passes for select to authenticated
  using (rider_id = (select auth.uid()));
create policy passes_read_admin on public.rider_passes for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- rides ----------
create policy rides_read_own on public.rides for select to authenticated
  using (rider_id = (select auth.uid()));
create policy rides_read_admin on public.rides for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- issue_reports ----------
create policy issues_read_own on public.issue_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy issues_read_admin on public.issue_reports for select to authenticated
  using (private.is_admin_of(college_id) and private.demo_ok(is_demo));

-- ---------- notifications ----------
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- audit_log ----------
create policy audit_read_admin on public.audit_log for select to authenticated
  using ((private.is_admin_of(college_id) or (college_id is null and private.is_super()))
         and private.demo_ok(is_demo));

-- ---------- admin views (security_invoker: RLS of the caller applies) ----------
create or replace view public.admin_users_v with (security_invoker = true) as
select p.id, p.college_id, c.short_code as college_code, c.name as college_name,
       p.email, p.full_name, p.phone, p.roll_number, p.role, p.status, p.strikes,
       p.email_domain_match, p.id_photo_path, p.id_check_consent, p.id_check_result,
       p.applied_at, p.approved_at, p.rejection_reason, p.suspended_reason,
       p.password_reset_requested_at, p.is_demo, p.demo_role, p.is_owner, p.created_at,
       rp.id as pass_id, rp.status as pass_status, rp.pass_number,
       public.pass_label_of(c.short_code, rp.pass_number) as pass_label,
       rp.total_rides, rp.total_minutes, rp.borrowed_at,
       b.short_code as bike_code, rp.current_ride_id
from public.profiles p
left join public.colleges c on c.id = p.college_id
left join public.rider_passes rp on rp.rider_id = p.id
left join public.bikes b on b.id = rp.current_bike_id;

create or replace view public.admin_rides_v with (security_invoker = true) as
select r.id, r.college_id, r.rider_id, p.full_name as rider_name,
       public.pass_label_of(c.short_code, rp.pass_number) as pass_label,
       b.short_code as bike_code, r.bike_id,
       r.start_stand_id, ss.name as start_stand_name, r.end_stand_id, es.name as end_stand_name,
       r.started_at, r.due_at, r.ended_at, r.status, r.is_overdue, r.late,
       r.return_photo_path, r.photo_check, r.photo_check_note, r.flags, r.force_note, r.is_demo,
       case when r.ended_at is null then null
            else greatest(1, ceil(extract(epoch from (r.ended_at - r.started_at)) / 60))::int end as minutes
from public.rides r
join public.colleges c on c.id = r.college_id
join public.bikes b on b.id = r.bike_id
left join public.profiles p on p.id = r.rider_id
left join public.rider_passes rp on rp.id = r.pass_id
left join public.stands ss on ss.id = r.start_stand_id
left join public.stands es on es.id = r.end_stand_id;

create or replace view public.admin_bikes_v with (security_invoker = true) as
select b.id, b.college_id, b.short_code, b.status, b.current_stand_id, s.name as stand_name,
       b.last_seen_at, b.last_seen_stand_id, ls.name as last_seen_stand_name,
       b.maintenance_after_return, b.ai_flag, b.notes, b.is_demo, b.created_at,
       rp.id as pass_id, public.pass_label_of(c.short_code, rp.pass_number) as pass_label,
       p.full_name as holder_name, rp.borrowed_at
from public.bikes b
join public.colleges c on c.id = b.college_id
left join public.stands s on s.id = b.current_stand_id
left join public.stands ls on ls.id = b.last_seen_stand_id
left join public.rider_passes rp on rp.id = b.current_pass_id
left join public.profiles p on p.id = rp.rider_id;

create or replace view public.admin_issues_v with (security_invoker = true) as
select i.id, i.college_id, i.type, i.note, i.photo_path, i.status, i.ai_suggested_type,
       i.group_id, i.urgency, i.triaged_at, i.source, i.is_demo, i.created_at, i.updated_at,
       i.resolved_at, i.resolution_note,
       i.reporter_id, rp.full_name as reporter_name,
       i.bike_id, b.short_code as bike_code, b.status as bike_status,
       i.stand_id, s.name as stand_name, i.ride_id,
       i.assigned_to, ap.full_name as assignee_name
from public.issue_reports i
left join public.profiles rp on rp.id = i.reporter_id
left join public.bikes b on b.id = i.bike_id
left join public.stands s on s.id = i.stand_id
left join public.profiles ap on ap.id = i.assigned_to;

grant select on public.admin_users_v, public.admin_rides_v, public.admin_bikes_v, public.admin_issues_v
  to authenticated;
