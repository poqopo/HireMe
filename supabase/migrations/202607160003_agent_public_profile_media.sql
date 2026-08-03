begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-public-media',
  'agent-public-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/markdown']::text[]
)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

create policy agent_public_media_read on storage.objects
for select to public using (bucket_id = 'agent-public-media');

alter table public.agents
  add column if not exists public_examples jsonb not null default '[]'::jsonb
  check (jsonb_typeof(public_examples) = 'array');

comment on column public.agents.public_examples is
  'Public-safe output examples only. Private Harness, private source, and user artifacts are prohibited.';

commit;
