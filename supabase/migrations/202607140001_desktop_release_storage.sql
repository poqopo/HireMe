begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'desktop-releases',
  'desktop-releases',
  false,
  805306368,
  array['application/x-apple-diskimage', 'application/zip']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Desktop builds are published by the trusted release script using service_role.
-- There are intentionally no client read/write policies. Testers receive a
-- short-lived signed URL instead of a permanent public artifact URL.

commit;
