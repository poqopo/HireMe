create table if not exists public.account_wallet_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null
    check (event_type in ('top_up', 'claim', 'adjustment')),
  amount_mist numeric(40, 0) not null check (amount_mist >= 0),
  amount_sui numeric(30, 9) not null default 0 check (amount_sui >= 0),
  currency text not null default 'SUI',
  network text not null default 'sui-testnet',
  tx_digest text,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_wallet_events_no_raw_payload check (
    not (metadata ? 'raw_prompt')
    and not (metadata ? 'raw_response')
    and not (metadata ? 'agents_md')
    and not (metadata ? 'skills')
    and not (metadata ? 'harness_source')
  )
);

create index if not exists account_wallet_events_profile_created_idx
  on public.account_wallet_events (profile_id, created_at desc);

create index if not exists account_wallet_events_type_created_idx
  on public.account_wallet_events (event_type, created_at desc);

alter table public.account_wallet_events enable row level security;

drop policy if exists "users read own wallet events"
  on public.account_wallet_events;
create policy "users read own wallet events"
  on public.account_wallet_events for select
  using (auth.uid() = profile_id);

comment on table public.account_wallet_events is
  'Account-level app wallet events for top-ups, claims, and safe balance adjustments. Execution spend and creator earnings are derived from mcp_call_ledger.';

comment on column public.account_wallet_events.metadata is
  'Safe wallet metadata only. Do not store raw prompts, responses, AGENTS.md, skills, or Harness source.';
