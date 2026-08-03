begin;

alter table public.agents
  add column if not exists public_design_contract jsonb not null default '{}'::jsonb
  check (jsonb_typeof(public_design_contract) = 'object');

comment on column public.agents.public_design_contract is
  'Public customer intake questions and non-sensitive decision-system summary. Private priorities, avoid rules, and quality criteria remain in the encrypted Agent package.';

commit;
