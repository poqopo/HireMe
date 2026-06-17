insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hireme-agent-media',
  'hireme-agent-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hireme agent media public read"
  on storage.objects;

create policy "hireme agent media public read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'hireme-agent-media');

drop policy if exists "hireme agent media authenticated upload"
  on storage.objects;

create policy "hireme agent media authenticated upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'hireme-agent-media'
    and lower(storage.extension(name)) in (
      'jpg',
      'jpeg',
      'png',
      'webp',
      'gif',
      'mp4',
      'webm',
      'mov'
    )
  );

drop policy if exists "hireme agent media owners update"
  on storage.objects;

create policy "hireme agent media owners update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'hireme-agent-media'
    and owner_id = (select auth.uid())::text
  )
  with check (
    bucket_id = 'hireme-agent-media'
    and owner_id = (select auth.uid())::text
    and lower(storage.extension(name)) in (
      'jpg',
      'jpeg',
      'png',
      'webp',
      'gif',
      'mp4',
      'webm',
      'mov'
    )
  );

drop policy if exists "hireme agent media owners delete"
  on storage.objects;

create policy "hireme agent media owners delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'hireme-agent-media'
    and owner_id = (select auth.uid())::text
  );
