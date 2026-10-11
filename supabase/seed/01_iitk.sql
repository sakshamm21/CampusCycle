insert into public.colleges (id, name, short_code, bike_prefix, email_domains, time_zone, max_ride_minutes, strike_limit,
                             default_geofence_m, center_lat, center_lng, next_pass_no, rules_text)
values ('11111111-1111-4111-8111-111111111111', 'IIT Kanpur', 'IITK', 'K', array['iitk.ac.in'], 'Asia/Kolkata', 240, 3, 40,
        26.5123, 80.2329, 1001,
$rules$1. Borrow and return bikes only at CampusCycle stands. The app checks that you are inside the stand.
2. One bike per pass. The bike stays on your Rider Pass until you return it at any stand.
3. Maximum ride time is 4 hours. You get a reminder 15 minutes before the limit.
4. To return: park inside the stand, tap Return, scan the same bike and take one photo of it parked.
5. A late return adds a strike. At 3 strikes your pass is suspended until a college admin reinstates it.
6. If a bike is faulty (flat tyre, brakes, chain, damaged sticker), report it from the app and do not ride it.
7. Never lend your pass. If anyone asks, show the bike on your pass. Admins may scan your pass QR.
8. Ride on the left, use a light after dark and park inside the stand markings.
9. If you cannot reach a stand (accident, puncture far away), report a problem and an admin will close your ride.$rules$)
on conflict (id) do nothing;

insert into public.stands (id, college_id, name, lat, lng, radius_m, capacity) values
  ('22222222-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Main Gate',            26.5036, 80.2311, 40, 8),
  ('22222222-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Lecture Hall Complex', 26.5096, 80.2330, 40, 10),
  ('22222222-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Library',              26.5110, 80.2341, 40, 8),
  ('22222222-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Computer Centre',      26.5121, 80.2349, 40, 6),
  ('22222222-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'New SAC',              26.5145, 80.2373, 40, 6),
  ('22222222-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Shopping Complex',     26.5089, 80.2268, 40, 6),
  ('22222222-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Hall 1',               26.5076, 80.2284, 40, 6),
  ('22222222-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Hall 5',               26.5121, 80.2265, 40, 6),
  ('22222222-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Hall 8',               26.5137, 80.2247, 40, 6),
  ('22222222-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'Hall 12',              26.5170, 80.2302, 40, 6)
on conflict (id) do nothing;

-- 30 demo bikes, 3 per stand, in stand order: K-001..K-003 Main Gate, K-004..K-006 Lecture Hall Complex, ...
insert into private.demo_bike_home (short_code, stand_name)
select 'K-' || lpad(n::text, 3, '0'),
       (array['Main Gate', 'Lecture Hall Complex', 'Library', 'Computer Centre', 'New SAC',
              'Shopping Complex', 'Hall 1', 'Hall 5', 'Hall 8', 'Hall 12'])[((n - 1) / 3) + 1]
from generate_series(1, 30) n
on conflict (short_code) do nothing;

insert into public.bikes (college_id, short_code, status, current_stand_id, last_seen_at, last_seen_stand_id, is_demo)
select '11111111-1111-4111-8111-111111111111', h.short_code, 'available', s.id, now(), s.id, true
from private.demo_bike_home h
join public.stands s on s.name = h.stand_name and s.college_id = '11111111-1111-4111-8111-111111111111'
on conflict (short_code) do nothing;
