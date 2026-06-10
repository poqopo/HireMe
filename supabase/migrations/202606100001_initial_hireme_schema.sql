create extension if not exists pgcrypto;

create type public.agent_category as enum (
  'research',
  'code',
  'data',
  'security',
  'growth',
  'ops',
  'other'
);

create type public.agent_status as enum (
  'draft',
  'listed',
  'private_beta',
  'paused',
  'archived'
);

create type public.agent_version_status as enum (
  'draft',
  'sealed',
  'published',
  'deprecated'
);

create type public.protected_artifact_kind as enum (
  'agent_folder',
  'memory_snapshot',
  'eval_bundle',
  'adapter_bundle'
);

create type public.hire_status as enum (
  'active',
  'suspended',
  'expired',
  'canceled'
);

create type public.mcp_call_status as enum (
  'authorized',
  'completed',
  'failed',
  'refunded'
);

create type public.payout_status as enum (
  'pending',
  'processing',
  'paid',
  'failed'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  sui_address text unique,
  payout_address text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  handle text not null unique,
  category public.agent_category not null default 'other',
  status public.agent_status not null default 'draft',
  headline text not null,
  public_summary text not null,
  public_skills text[] not null default '{}',
  public_mcp_contract text not null,
  current_version_id uuid,
  accent text,
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  historical_calls bigint not null default 0 check (historical_calls >= 0),
  median_latency_ms integer check (median_latency_ms is null or median_latency_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint agents_handle_format check (handle ~ '^@[a-z0-9_./-]{2,80}$')
);

create table public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.agent_version_status not null default 'draft',
  public_mcp_contract text not null,
  release_notes text,
  artifact_manifest jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (agent_id, version_number)
);

alter table public.agents
  add constraint agents_current_version_id_fkey
  foreign key (current_version_id)
  references public.agent_versions(id)
  on delete set null;

create table public.protected_artifacts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  agent_version_id uuid not null references public.agent_versions(id) on delete cascade,
  kind public.protected_artifact_kind not null default 'agent_folder',
  network text not null default 'walrus-testnet'
    check (network in ('walrus-testnet', 'walrus-mainnet')),
  seal_policy_id text not null,
  seal_encryption_id text,
  walrus_blob_id text not null,
  walrus_sui_object_id text,
  ciphertext_digest text not null,
  ciphertext_size_bytes bigint check (
    ciphertext_size_bytes is null or ciphertext_size_bytes >= 0
  ),
  folder_manifest_digest text,
  storage_epochs integer check (storage_epochs is null or storage_epochs > 0),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (agent_version_id, kind),
  constraint protected_artifacts_no_plaintext check (
    not (metadata ? 'plaintext')
    and not (metadata ? 'agents_md')
    and not (metadata ? 'skills')
    and not (metadata ? 'harness_source')
    and not (metadata ? 'backup_key')
  )
);

create table public.agent_pricing (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  agent_version_id uuid references public.agent_versions(id) on delete set null,
  currency text not null default 'USD',
  billing_unit text not null default 'mcp_call',
  price_per_mcp_call_usd numeric(12, 6) not null check (price_per_mcp_call_usd >= 0),
  free_calls integer not null default 0 check (free_calls >= 0),
  max_budget_calls integer not null default 100 check (max_budget_calls > 0),
  volume_tiers jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.hires (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  agent_version_id uuid references public.agent_versions(id) on delete set null,
  hirer_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status public.hire_status not null default 'active',
  sui_hire_receipt_object_id text,
  seal_access_identity text,
  codex_installation_id text,
  free_calls_remaining integer not null default 0 check (free_calls_remaining >= 0),
  spend_limit_usd numeric(12, 2) check (spend_limit_usd is null or spend_limit_usd >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hires_not_self_hire check (hirer_id <> creator_id)
);

create unique index hires_active_installation_idx
  on public.hires (agent_id, hirer_id, coalesce(codex_installation_id, 'default'))
  where status = 'active';

create table public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  hirer_id uuid not null references public.profiles(id) on delete cascade,
  codex_installation_id text not null,
  active_agent_id uuid references public.agents(id) on delete set null,
  active_hire_id uuid references public.hires(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hirer_id, codex_installation_id)
);

create table public.mcp_call_ledger (
  id uuid primary key default gen_random_uuid(),
  call_id text not null unique,
  hire_id uuid references public.hires(id) on delete set null,
  agent_id uuid not null references public.agents(id) on delete restrict,
  agent_version_id uuid references public.agent_versions(id) on delete set null,
  hirer_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  status public.mcp_call_status not null default 'authorized',
  tool_name text not null,
  request_digest text,
  response_digest text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  billable_calls integer not null default 1 check (billable_calls > 0),
  amount_usd numeric(12, 6) not null default 0 check (amount_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint mcp_call_ledger_no_raw_io check (
    not (metadata ? 'raw_prompt')
    and not (metadata ? 'raw_response')
    and not (metadata ? 'agents_md')
    and not (metadata ? 'skills')
    and not (metadata ? 'harness_source')
  )
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  amount_usd numeric(12, 2) not null check (amount_usd >= 0),
  currency text not null default 'USD',
  status public.payout_status not null default 'pending',
  destination_address text,
  transaction_digest text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payouts_valid_period check (period_end > period_start)
);

create index agents_creator_id_idx on public.agents (creator_id);
create index agents_status_category_idx on public.agents (status, category);
create index agent_versions_agent_id_idx on public.agent_versions (agent_id);
create index protected_artifacts_version_idx on public.protected_artifacts (agent_version_id);
create index agent_pricing_agent_active_idx on public.agent_pricing (agent_id, active);
create index hires_hirer_status_idx on public.hires (hirer_id, status);
create index hires_creator_status_idx on public.hires (creator_id, status);
create index mcp_call_ledger_hirer_created_idx on public.mcp_call_ledger (hirer_id, created_at desc);
create index mcp_call_ledger_creator_created_idx on public.mcp_call_ledger (creator_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create trigger hires_set_updated_at
  before update on public.hires
  for each row execute function public.set_updated_at();

create trigger agent_sessions_set_updated_at
  before update on public.agent_sessions
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    null,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace view public.agent_marketplace_cards
with (security_invoker = true)
as
select
  a.id,
  a.slug,
  a.name,
  a.handle,
  a.creator_id,
  p.display_name as creator_name,
  a.category,
  a.status,
  a.headline,
  a.public_summary,
  a.public_skills,
  a.public_mcp_contract,
  a.current_version_id,
  a.accent,
  a.rating,
  a.historical_calls,
  a.median_latency_ms,
  pr.price_per_mcp_call_usd,
  pr.free_calls,
  pr.max_budget_calls
from public.agents a
join public.profiles p on p.id = a.creator_id
left join lateral (
  select *
  from public.agent_pricing ap
  where ap.agent_id = a.id
    and ap.active = true
  order by ap.created_at desc
  limit 1
) pr on true
where a.status in ('listed', 'private_beta');

alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_versions enable row level security;
alter table public.protected_artifacts enable row level security;
alter table public.agent_pricing enable row level security;
alter table public.hires enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.mcp_call_ledger enable row level security;
alter table public.payouts enable row level security;

create policy "profiles are readable"
  on public.profiles for select
  using (true);

create policy "users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "listed agents are readable"
  on public.agents for select
  using (
    status in ('listed', 'private_beta')
    or creator_id = auth.uid()
  );

create policy "creators insert agents"
  on public.agents for insert
  with check (creator_id = auth.uid());

create policy "creators update own agents"
  on public.agents for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "read published or own versions"
  on public.agent_versions for select
  using (
    status = 'published'
    or exists (
      select 1
      from public.agents a
      where a.id = agent_versions.agent_id
        and a.creator_id = auth.uid()
    )
  );

create policy "creators manage versions"
  on public.agent_versions for all
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_versions.agent_id
        and a.creator_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.agents a
      where a.id = agent_versions.agent_id
        and a.creator_id = auth.uid()
    )
  );

create policy "creators read own protected artifacts"
  on public.protected_artifacts for select
  using (
    exists (
      select 1
      from public.agents a
      where a.id = protected_artifacts.agent_id
        and a.creator_id = auth.uid()
    )
  );

create policy "creators manage own protected artifacts"
  on public.protected_artifacts for all
  using (
    exists (
      select 1
      from public.agents a
      where a.id = protected_artifacts.agent_id
        and a.creator_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.agents a
      where a.id = protected_artifacts.agent_id
        and a.creator_id = auth.uid()
    )
  );

create policy "active listed pricing is readable"
  on public.agent_pricing for select
  using (
    active = true
    and exists (
      select 1
      from public.agents a
      where a.id = agent_pricing.agent_id
        and (
          a.status in ('listed', 'private_beta')
          or a.creator_id = auth.uid()
        )
    )
  );

create policy "creators manage own pricing"
  on public.agent_pricing for all
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_pricing.agent_id
        and a.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_pricing.agent_id
        and a.creator_id = auth.uid()
    )
  );

create policy "users read related hires"
  on public.hires for select
  using (hirer_id = auth.uid() or creator_id = auth.uid());

create policy "hirers create own hires"
  on public.hires for insert
  with check (hirer_id = auth.uid());

create policy "hirers update own hires"
  on public.hires for update
  using (hirer_id = auth.uid())
  with check (hirer_id = auth.uid());

create policy "users manage own sessions"
  on public.agent_sessions for all
  using (hirer_id = auth.uid())
  with check (hirer_id = auth.uid());

create policy "users read related ledger"
  on public.mcp_call_ledger for select
  using (hirer_id = auth.uid() or creator_id = auth.uid());

create policy "creators read own payouts"
  on public.payouts for select
  using (creator_id = auth.uid());
