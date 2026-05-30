-- Storage for user-uploaded level backgrounds.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backdrops',
  'backdrops',
  true,
  8388608, -- 8 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read (the bucket is public; backdrops are served by URL).
drop policy if exists "backdrops public read" on storage.objects;
create policy "backdrops public read"
  on storage.objects for select
  using (bucket_id = 'backdrops');

-- Signed-in users may upload to the bucket.
drop policy if exists "backdrops insert" on storage.objects;
create policy "backdrops insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'backdrops');

-- Owners may replace/remove their own uploads.
drop policy if exists "backdrops update own" on storage.objects;
create policy "backdrops update own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'backdrops' and owner = auth.uid());

drop policy if exists "backdrops delete own" on storage.objects;
create policy "backdrops delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'backdrops' and owner = auth.uid());
