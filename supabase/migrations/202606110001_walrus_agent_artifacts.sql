create table public.walrus_agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  folder_name text not null,
  walrus_blob_id text not null unique,
  walrus_sui_object_id text,
  archive_digest text not null,
  archive_size_bytes bigint not null check (archive_size_bytes > 0),
  archive_format text not null default 'tar.gz',
  storage_provider text not null default 'walrus',
  storage_network text not null default 'testnet',
  storage_epochs integer check (storage_epochs is null or storage_epochs > 0),
  source_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint walrus_agent_artifacts_no_plaintext check (
    not (metadata ? 'plaintext')
    and not (metadata ? 'agents_md')
    and not (metadata ? 'skills')
    and not (metadata ? 'harness_source')
    and not (metadata ? 'backup_key')
  )
);

create index walrus_agent_artifacts_agent_created_idx
  on public.walrus_agent_artifacts (agent_id, created_at desc);

alter table public.walrus_agent_artifacts enable row level security;

create policy "walrus agent artifact metadata is readable"
  on public.walrus_agent_artifacts for select
  using (true);

create trigger walrus_agent_artifacts_set_updated_at
  before update on public.walrus_agent_artifacts
  for each row execute function public.set_updated_at();
