update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]
where id = 'hireme-agent-media';

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
      'mp4',
      'webm',
      'mov'
    )
  );
