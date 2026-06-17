create table if not exists public.sui_payment_verification_logs (
  id uuid primary key default gen_random_uuid(),
  verification_id text not null unique,
  payment_intent_id uuid references public.sui_payment_intents(id) on delete set null,
  intent_id text not null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  hirer_identity text not null,
  tx_digest text not null,
  status text not null
    check (status in ('verified', 'failed', 'skipped')),
  verification_mode text not null default 'sui_rpc',
  network text not null default 'sui-testnet',
  expected_sender text,
  expected_recipient text not null,
  expected_amount_mist bigint not null check (expected_amount_mist >= 0),
  observed_sender text,
  observed_recipient_amount_mist bigint check (
    observed_recipient_amount_mist is null or observed_recipient_amount_mist >= 0
  ),
  observed_sender_amount_mist bigint,
  effect_status text,
  checkpoint text,
  timestamp_ms text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sui_payment_verification_logs_hirer_identity_length check (
    length(hirer_identity) between 1 and 128
  ),
  constraint sui_payment_verification_logs_no_raw_payload check (
    not (metadata ? 'raw_prompt')
    and not (metadata ? 'raw_response')
    and not (metadata ? 'raw_transaction')
    and not (metadata ? 'raw_sui_response')
    and not (metadata ? 'agents_md')
    and not (metadata ? 'skills')
    and not (metadata ? 'harness_source')
  )
);

create index if not exists sui_payment_verification_logs_hirer_created_idx
  on public.sui_payment_verification_logs (hirer_identity, created_at desc);

create index if not exists sui_payment_verification_logs_agent_created_idx
  on public.sui_payment_verification_logs (agent_id, created_at desc);

create index if not exists sui_payment_verification_logs_tx_digest_idx
  on public.sui_payment_verification_logs (tx_digest, created_at desc);

alter table public.sui_payment_verification_logs enable row level security;

comment on table public.sui_payment_verification_logs is
  'Sui RPC payment verification attempts for Hire payments. Gateway stores safe expected/observed facts, not raw transaction payloads.';

comment on column public.sui_payment_verification_logs.metadata is
  'Safe verification metadata only. Do not store raw Sui RPC responses, prompts, responses, AGENTS.md, skills, or Harness source.';
