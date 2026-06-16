create table if not exists public.agent_entitlements (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  hirer_identity text not null,
  access_type text not null check (access_type in ('trial', 'hired')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'canceled', 'suspended')),
  source text not null default 'gateway',
  receipt_object_id text not null,
  trial_calls_remaining integer check (
    trial_calls_remaining is null or trial_calls_remaining >= 0
  ),
  price_per_call_usd numeric(12, 6) not null default 0
    check (price_per_call_usd >= 0),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_entitlements_hirer_identity_length check (
    length(hirer_identity) between 1 and 128
  ),
  unique (agent_id, hirer_identity)
);

create index if not exists agent_entitlements_hirer_status_idx
  on public.agent_entitlements (hirer_identity, status, updated_at desc);

create index if not exists agent_entitlements_agent_status_idx
  on public.agent_entitlements (agent_id, status);

drop trigger if exists agent_entitlements_set_updated_at on public.agent_entitlements;
create trigger agent_entitlements_set_updated_at
  before update on public.agent_entitlements
  for each row execute function public.set_updated_at();

alter table public.agent_entitlements enable row level security;

comment on table public.agent_entitlements is
  'MVP Try/Hire access records keyed by normalized hirer identity. Gateway service role owns writes and reads.';
