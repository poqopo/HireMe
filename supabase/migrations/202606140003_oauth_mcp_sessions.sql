create table if not exists public.oauth_mcp_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null default '{}',
  token_endpoint_auth_method text not null default 'none',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oauth_mcp_clients_redirect_uris_not_empty
    check (array_length(redirect_uris, 1) > 0)
);

create table if not exists public.oauth_mcp_login_sessions (
  session_id text primary key,
  provider text not null,
  subject text not null,
  email text,
  display_name text,
  hirer_identity text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oauth_mcp_login_sessions_hirer_identity_length
    check (length(hirer_identity) between 1 and 128)
);

create table if not exists public.oauth_mcp_authorization_codes (
  code text primary key,
  client_id text not null references public.oauth_mcp_clients(client_id)
    on delete cascade,
  redirect_uri text not null,
  scope text not null,
  resource text,
  code_challenge text,
  code_challenge_method text not null default 'plain'
    check (code_challenge_method in ('plain', 'S256')),
  subject text not null,
  email text,
  hirer_identity text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint oauth_mcp_authorization_codes_hirer_identity_length
    check (length(hirer_identity) between 1 and 128)
);

create table if not exists public.oauth_mcp_access_tokens (
  token_hash text primary key,
  client_id text not null references public.oauth_mcp_clients(client_id)
    on delete cascade,
  subject text not null,
  email text,
  hirer_identity text not null,
  scope text not null,
  resource text,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_mcp_access_tokens_hirer_identity_length
    check (length(hirer_identity) between 1 and 128)
);

create index if not exists oauth_mcp_login_sessions_hirer_idx
  on public.oauth_mcp_login_sessions (hirer_identity, expires_at desc);

create index if not exists oauth_mcp_authorization_codes_expires_idx
  on public.oauth_mcp_authorization_codes (expires_at);

create index if not exists oauth_mcp_access_tokens_hirer_idx
  on public.oauth_mcp_access_tokens (hirer_identity, expires_at desc);

drop trigger if exists oauth_mcp_clients_set_updated_at
  on public.oauth_mcp_clients;
create trigger oauth_mcp_clients_set_updated_at
  before update on public.oauth_mcp_clients
  for each row execute function public.set_updated_at();

drop trigger if exists oauth_mcp_login_sessions_set_updated_at
  on public.oauth_mcp_login_sessions;
create trigger oauth_mcp_login_sessions_set_updated_at
  before update on public.oauth_mcp_login_sessions
  for each row execute function public.set_updated_at();

alter table public.oauth_mcp_clients enable row level security;
alter table public.oauth_mcp_login_sessions enable row level security;
alter table public.oauth_mcp_authorization_codes enable row level security;
alter table public.oauth_mcp_access_tokens enable row level security;

comment on table public.oauth_mcp_clients is
  'OAuth dynamic client registrations for Codex HTTP MCP connections. Gateway service role owns reads/writes.';

comment on table public.oauth_mcp_login_sessions is
  'Google/web login sessions used by the HireMe OAuth consent screen.';

comment on table public.oauth_mcp_authorization_codes is
  'Short-lived OAuth authorization codes for Codex MCP login. Gateway service role owns reads/writes.';

comment on table public.oauth_mcp_access_tokens is
  'Hashed bearer tokens for OAuth-protected HireMe HTTP MCP calls. Raw tokens are never stored.';
