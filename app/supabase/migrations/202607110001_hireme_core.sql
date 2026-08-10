begin;

-- This migration is the new HireMe baseline. The linked project is intentionally
-- reset before applying it, so legacy public data, auth users, and storage rows
-- are removed once instead of carrying obsolete product tables forward.
drop schema if exists public cascade;
create schema public;

delete from auth.users;

grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  locale text not null default 'ko-KR' check (char_length(locale) between 2 and 20),
  default_provider text not null default 'codex' check (default_provider ~ '^[a-z0-9][a-z0-9._-]{1,40}$'),
  default_model text check (default_model is null or char_length(default_model) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other' check (category in ('design', 'writing', 'business', 'research', 'productivity', 'image', 'other')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'paused', 'archived')),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  headline text not null default '' check (char_length(headline) <= 240),
  public_summary text not null default '' check (char_length(public_summary) <= 4000),
  public_skills text[] not null default '{}',
  result_types text[] not null default '{text}',
  cover_image_url text,
  current_version integer check (current_version is null or current_version > 0),
  pricing jsonb not null default '{"mode":"free"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  release_notes text not null default '',
  manifest jsonb not null default '{}'::jsonb,
  package_digest text not null check (package_digest ~ '^sha256:[a-f0-9]{64}$'),
  runtime_ref text not null check (runtime_ref !~* '(agents\.md|private[-_ ]?prompt|harness[-_ ]?source)'),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (agent_id, version_number)
);

alter table public.agents
  add constraint agents_current_version_fkey
  foreign key (id, current_version)
  references public.agent_versions(agent_id, version_number)
  deferrable initially deferred;

create table public.agent_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  access_mode text not null check (access_mode in ('trial', 'purchase', 'subscription')),
  status text not null default 'active' check (status in ('active', 'past_due', 'expired', 'canceled')),
  remaining_runs integer check (remaining_runs is null or remaining_runs >= 0),
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  title text not null default '새 작업' check (char_length(title) between 1 and 200),
  provider text check (provider is null or provider ~ '^[a-z0-9][a-z0-9._-]{1,40}$'),
  model text check (model is null or char_length(model) <= 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  artifacts jsonb not null default '[]'::jsonb check (jsonb_typeof(artifacts) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid references public.profiles(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9._-]{1,40}$'),
  model text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'canceled')),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  charged_minor bigint not null default 0 check (charged_minor >= 0),
  creator_earnings_minor bigint not null default 0 check (creator_earnings_minor >= 0),
  currency text not null default 'KRW' check (currency ~ '^[A-Z]{3}$'),
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index agents_creator_idx on public.agents (creator_id, updated_at desc);
create index agents_marketplace_idx on public.agents (status, visibility, updated_at desc);
create index agent_versions_agent_idx on public.agent_versions (agent_id, version_number desc);
create index agent_access_user_idx on public.agent_access (user_id, status);
create index conversations_owner_idx on public.conversations (owner_id, updated_at desc);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index runs_user_idx on public.runs (user_id, created_at desc);
create index runs_creator_idx on public.runs (creator_id, created_at desc) where creator_id is not null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger agents_set_updated_at before update on public.agents
for each row execute function public.set_updated_at();
create trigger agent_access_set_updated_at before update on public.agent_access
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'ko-KR')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

create trigger hireme_create_profile
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_versions enable row level security;
alter table public.agent_access enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.runs enable row level security;

create policy profiles_read_authenticated on public.profiles
for select to authenticated using (true);
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy agents_read_visible on public.agents
for select to authenticated using (
  creator_id = auth.uid()
  or (status = 'published' and visibility in ('public', 'unlisted'))
);
create policy agents_create_self on public.agents
for insert to authenticated with check (creator_id = auth.uid());
create policy agents_update_self on public.agents
for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy agents_delete_self on public.agents
for delete to authenticated using (creator_id = auth.uid());

create policy agent_versions_manage_creator on public.agent_versions
for all to authenticated
using (exists (
  select 1 from public.agents a where a.id = agent_id and a.creator_id = auth.uid()
))
with check (exists (
  select 1 from public.agents a where a.id = agent_id and a.creator_id = auth.uid()
));

create policy agent_access_read_self on public.agent_access
for select to authenticated using (user_id = auth.uid());

create policy conversations_manage_self on public.conversations
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy messages_manage_from_owned_conversation on public.messages
for all to authenticated
using (exists (
  select 1 from public.conversations c where c.id = conversation_id and c.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.conversations c where c.id = conversation_id and c.owner_id = auth.uid()
));

create policy runs_read_participant on public.runs
for select to authenticated using (user_id = auth.uid() or creator_id = auth.uid());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.agents, public.agent_versions, public.agent_access,
  public.conversations, public.messages, public.runs to authenticated;
grant update (display_name, avatar_url, locale, default_provider, default_model)
  on public.profiles to authenticated;
grant insert, update, delete on public.agents, public.agent_versions,
  public.conversations, public.messages to authenticated;
grant all on all tables in schema public to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.handle_new_auth_user() to service_role;

commit;
