insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('id-cards', 'id-cards', false, 2097152, array['image/jpeg', 'image/png']),
  ('return-photos', 'return-photos', false, 2097152, array['image/jpeg']),
  ('issue-photos', 'issue-photos', false, 2097152, array['image/jpeg']),
  ('torq-photos', 'torq-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Upload only into your own folder
create policy cc_upload_own on storage.objects for insert to authenticated
  with check (
    bucket_id in ('id-cards', 'return-photos', 'issue-photos', 'torq-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Read your own files
create policy cc_read_own on storage.objects for select to authenticated
  using (
    bucket_id in ('id-cards', 'return-photos', 'issue-photos', 'torq-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Admins read files of users in their college (demo admins: demo users only)
create policy cc_read_admin on storage.objects for select to authenticated
  using (
    bucket_id in ('id-cards', 'return-photos', 'issue-photos')
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and private.is_admin_of(p.college_id) and private.demo_ok(p.is_demo)));
-- No update/delete policies: only the service role (Edge Functions) deletes files.
