alter table public.profiles
  add column if not exists zklogin_provider text,
  add column if not exists zklogin_subject text,
  add column if not exists zklogin_last_connected_at timestamptz,
  add column if not exists wallet_metadata jsonb not null default '{}'::jsonb;

alter table public.oauth_mcp_login_sessions
  add column if not exists sui_address text;

alter table public.oauth_mcp_authorization_codes
  add column if not exists sui_address text;

alter table public.oauth_mcp_access_tokens
  add column if not exists sui_address text;

alter table public.agent_entitlements
  add column if not exists owner_sui_address text;

create index if not exists profiles_sui_address_idx
  on public.profiles (sui_address)
  where sui_address is not null;

create index if not exists oauth_mcp_login_sessions_sui_address_idx
  on public.oauth_mcp_login_sessions (sui_address, expires_at desc)
  where sui_address is not null;

create index if not exists oauth_mcp_access_tokens_sui_address_idx
  on public.oauth_mcp_access_tokens (sui_address, expires_at desc)
  where sui_address is not null;

create index if not exists agent_entitlements_owner_sui_address_idx
  on public.agent_entitlements (owner_sui_address, status, updated_at desc)
  where owner_sui_address is not null;

comment on column public.profiles.sui_address is
  'Primary Sui address linked through Enoki zkLogin or another wallet flow.';

comment on column public.agent_entitlements.owner_sui_address is
  'Sui address linked to the hirer at Try/Hire time. MVP keeps hirer_identity as the stable authorization key.';
