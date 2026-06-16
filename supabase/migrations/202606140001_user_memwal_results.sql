create table public.user_memwal_results (
  id uuid primary key default gen_random_uuid(),
  call_id text not null unique,
  hirer_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  agent_version_id uuid references public.agent_versions(id) on delete set null,
  team_id uuid references public.agent_teams(id) on delete set null,
  hire_id uuid references public.hires(id) on delete set null,
  team_hire_id uuid references public.agent_team_hires(id) on delete set null,
  request_digest text,
  response_digest text,
  encryption_provider text not null default 'platform-managed-envelope',
  platform_kms_key_id text,
  encryption_id text not null,
  policy_id text not null,
  ciphertext_format text not null default 'hireme.platform-ciphertext-envelope.v1',
  ciphertext_digest text not null,
  ciphertext_size_bytes bigint check (
    ciphertext_size_bytes is null or ciphertext_size_bytes >= 0
  ),
  storage_provider text not null default 'walrus',
  storage_network text,
  walrus_blob_id text,
  walrus_sui_object_id text,
  local_ciphertext_path text,
  safe_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_memwal_results_no_plaintext check (
    not (metadata ? 'raw_prompt')
    and not (metadata ? 'raw_response')
    and not (metadata ? 'plaintext')
    and not (metadata ? 'result')
    and not (metadata ? 'json_output')
    and not (safe_summary ? 'raw_prompt')
    and not (safe_summary ? 'raw_response')
    and not (safe_summary ? 'plaintext')
  )
);

alter table public.mcp_call_ledger
  add column if not exists user_memwal_result_id uuid
  references public.user_memwal_results(id)
  on delete set null;

create index user_memwal_results_hirer_created_idx
  on public.user_memwal_results (hirer_id, created_at desc);

create index user_memwal_results_agent_created_idx
  on public.user_memwal_results (agent_id, created_at desc);

alter table public.user_memwal_results enable row level security;

create policy "hirers read own memwal results"
  on public.user_memwal_results for select
  using (hirer_id = auth.uid());

create policy "hirers insert own memwal result metadata"
  on public.user_memwal_results for insert
  with check (hirer_id = auth.uid());

comment on table public.user_memwal_results is
  'User-scoped encrypted memWal result records. Raw agent outputs live only in ciphertext and are readable only by the owning hirer through the gateway.';

comment on column public.user_memwal_results.safe_summary is
  'Safe non-plaintext metadata for listing a user result. Must not contain raw prompt or raw response.';
