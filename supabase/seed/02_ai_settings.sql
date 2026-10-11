insert into public.ai_settings (college_id, monthly_cap_usd) values (null, 5.00)
on conflict do nothing;
insert into public.ai_settings (college_id) values ('11111111-1111-4111-8111-111111111111')
on conflict (college_id) do nothing;
