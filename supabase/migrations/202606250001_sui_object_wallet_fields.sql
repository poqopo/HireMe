alter table public.profiles
  add column if not exists sui_account_wallet_object_id text,
  add column if not exists sui_account_wallet_created_tx_digest text,
  add column if not exists sui_account_wallet_created_at timestamptz;

alter table public.agent_versions
  add column if not exists sui_package_id text,
  add column if not exists sui_agent_object_id text,
  add column if not exists sui_agent_version_object_id text;

create unique index if not exists profiles_sui_account_wallet_object_id_key
  on public.profiles (sui_account_wallet_object_id)
  where sui_account_wallet_object_id is not null;

create unique index if not exists agent_versions_sui_agent_version_object_id_key
  on public.agent_versions (sui_agent_version_object_id)
  where sui_agent_version_object_id is not null;

comment on column public.profiles.sui_account_wallet_object_id is
  'Shared hireme::access::AccountWallet object id for this profile.';

comment on column public.profiles.sui_account_wallet_created_tx_digest is
  'Sui transaction digest that created the AccountWallet shared object.';

comment on column public.agent_versions.sui_agent_version_object_id is
  'Shared hireme::access::AgentVersion object id used by Sui escrow settlement.';
