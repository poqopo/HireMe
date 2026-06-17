create table if not exists public.sui_payment_intents (
  id uuid primary key default gen_random_uuid(),
  intent_id text not null unique,
  agent_id uuid not null references public.agents(id) on delete cascade,
  hirer_identity text not null,
  hirer_sui_address text,
  creator_id uuid references public.profiles(id) on delete set null,
  creator_sui_address text,
  access_type text not null default 'hired'
    check (access_type in ('trial', 'hired')),
  status text not null default 'requires_payment'
    check (status in ('requires_payment', 'submitted', 'confirmed', 'expired', 'canceled')),
  amount_mist bigint not null check (amount_mist >= 0),
  amount_sui numeric(30, 9) not null default 0 check (amount_sui >= 0),
  currency text not null default 'SUI',
  network text not null default 'sui-testnet',
  recipient_address text not null,
  tx_digest text,
  receipt_object_id text,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sui_payment_intents_hirer_identity_length check (
    length(hirer_identity) between 1 and 128
  ),
  constraint sui_payment_intents_no_raw_payload check (
    not (metadata ? 'raw_prompt')
    and not (metadata ? 'raw_response')
    and not (metadata ? 'agents_md')
    and not (metadata ? 'skills')
    and not (metadata ? 'harness_source')
  )
);

create index if not exists sui_payment_intents_hirer_created_idx
  on public.sui_payment_intents (hirer_identity, created_at desc);

create index if not exists sui_payment_intents_agent_status_idx
  on public.sui_payment_intents (agent_id, status, created_at desc);

create index if not exists sui_payment_intents_tx_digest_idx
  on public.sui_payment_intents (tx_digest)
  where tx_digest is not null;

drop trigger if exists sui_payment_intents_set_updated_at
  on public.sui_payment_intents;
create trigger sui_payment_intents_set_updated_at
  before update on public.sui_payment_intents
  for each row execute function public.set_updated_at();

alter table public.sui_payment_intents enable row level security;

create table if not exists public.sui_settlement_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  payment_intent_id uuid references public.sui_payment_intents(id) on delete set null,
  intent_id text not null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete set null,
  hirer_identity text not null,
  amount_mist bigint not null check (amount_mist >= 0),
  platform_fee_mist bigint not null default 0 check (platform_fee_mist >= 0),
  creator_amount_mist bigint not null check (creator_amount_mist >= 0),
  currency text not null default 'SUI',
  network text not null default 'sui-testnet',
  tx_digest text not null,
  status text not null default 'settled'
    check (status in ('pending', 'settled', 'failed', 'refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sui_settlement_events_amount_split check (
    platform_fee_mist + creator_amount_mist <= amount_mist
  ),
  constraint sui_settlement_events_no_raw_payload check (
    not (metadata ? 'raw_prompt')
    and not (metadata ? 'raw_response')
    and not (metadata ? 'agents_md')
    and not (metadata ? 'skills')
    and not (metadata ? 'harness_source')
  )
);

create index if not exists sui_settlement_events_creator_created_idx
  on public.sui_settlement_events (creator_id, created_at desc);

create index if not exists sui_settlement_events_hirer_created_idx
  on public.sui_settlement_events (hirer_identity, created_at desc);

create index if not exists sui_settlement_events_agent_created_idx
  on public.sui_settlement_events (agent_id, created_at desc);

alter table public.sui_settlement_events enable row level security;

comment on table public.sui_payment_intents is
  'MVP SUI payment intents for Hire access. Gateway creates an intent, web wallet signs a SUI transfer, and gateway confirms by submitted tx digest.';

comment on table public.sui_settlement_events is
  'MVP SUI settlement ledger. Stores creator-facing SUI settlement events without raw task or Agent harness payloads.';

comment on column public.sui_payment_intents.metadata is
  'Safe payment metadata only. Do not store raw prompts, responses, AGENTS.md, skills, or Harness source.';

comment on column public.sui_settlement_events.metadata is
  'Safe settlement metadata only. Do not store raw prompts, responses, AGENTS.md, skills, or Harness source.';
