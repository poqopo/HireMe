create table public.agent_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  handle text not null unique,
  status public.agent_status not null default 'draft',
  headline text not null,
  public_summary text not null,
  public_skills text[] not null default '{}',
  accent text,
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  historical_calls bigint not null default 0 check (historical_calls >= 0),
  median_latency_ms integer check (median_latency_ms is null or median_latency_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_teams_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint agent_teams_handle_format check (handle ~ '^@[a-z0-9_./-]{2,80}$')
);

create table public.agent_team_pricing (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.agent_teams(id) on delete cascade,
  currency text not null default 'USD',
  billing_unit text not null default 'team_bundle'
    check (billing_unit in ('team_bundle', 'monthly_access', 'per_agent')),
  base_price_usd numeric(12, 6) not null default 0 check (base_price_usd >= 0),
  included_calls integer not null default 0 check (included_calls >= 0),
  overage_price_per_call_usd numeric(12, 6) not null default 0
    check (overage_price_per_call_usd >= 0),
  billing_note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.agent_team_hires (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.agent_teams(id) on delete cascade,
  hirer_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status public.hire_status not null default 'active',
  sui_hire_receipt_object_id text,
  codex_installation_id text,
  included_calls_remaining integer not null default 0
    check (included_calls_remaining >= 0),
  spend_limit_usd numeric(12, 2) check (spend_limit_usd is null or spend_limit_usd >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_team_hires_not_self_hire check (hirer_id <> owner_id)
);

alter table public.agents
  add column if not exists team_id uuid references public.agent_teams(id) on delete set null,
  add column if not exists team_role text not null default 'Specialist',
  add column if not exists listed_individually boolean not null default true;

alter table public.mcp_call_ledger
  add column if not exists team_id uuid references public.agent_teams(id) on delete set null,
  add column if not exists team_hire_id uuid references public.agent_team_hires(id) on delete set null,
  add column if not exists billing_scope text not null default 'agent_direct'
    check (billing_scope in ('agent_direct', 'team_included', 'team_overage')),
  add column if not exists team_access_amount_usd numeric(12, 6) not null default 0
    check (team_access_amount_usd >= 0),
  add column if not exists agent_execution_amount_usd numeric(12, 6) not null default 0
    check (agent_execution_amount_usd >= 0);

alter table public.payouts
  add column if not exists team_id uuid references public.agent_teams(id) on delete set null;

create index agent_teams_owner_status_idx
  on public.agent_teams (owner_id, status);

create index agents_team_id_idx
  on public.agents (team_id);

create index agent_team_pricing_team_active_idx
  on public.agent_team_pricing (team_id, active);

create index agent_team_hires_hirer_status_idx
  on public.agent_team_hires (hirer_id, status);

create index agent_team_hires_owner_status_idx
  on public.agent_team_hires (owner_id, status);

create unique index agent_team_hires_active_installation_idx
  on public.agent_team_hires (team_id, hirer_id, coalesce(codex_installation_id, 'default'))
  where status = 'active';

create index mcp_call_ledger_team_created_idx
  on public.mcp_call_ledger (team_id, created_at desc);

create trigger agent_teams_set_updated_at
  before update on public.agent_teams
  for each row execute function public.set_updated_at();

create trigger agent_team_hires_set_updated_at
  before update on public.agent_team_hires
  for each row execute function public.set_updated_at();

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
  pr.max_budget_calls,
  a.team_role,
  a.listed_individually,
  t.id as team_id,
  t.slug as team_slug,
  t.name as team_name,
  t.handle as team_handle,
  t.owner_id as team_owner_id,
  tp.display_name as team_owner_name,
  t.headline as team_headline,
  t.public_summary as team_public_summary,
  t.accent as team_accent,
  tc.agent_count as team_agent_count,
  tpr.billing_unit as team_billing_unit,
  tpr.base_price_usd as team_base_price_usd,
  tpr.included_calls as team_included_calls,
  tpr.overage_price_per_call_usd as team_overage_price_per_call_usd,
  tpr.billing_note as team_billing_note
from public.agents a
join public.profiles p on p.id = a.creator_id
left join public.agent_teams t on t.id = a.team_id
left join public.profiles tp on tp.id = t.owner_id
left join lateral (
  select *
  from public.agent_pricing ap
  where ap.agent_id = a.id
    and ap.active = true
  order by ap.created_at desc
  limit 1
) pr on true
left join lateral (
  select *
  from public.agent_team_pricing atp
  where atp.team_id = t.id
    and atp.active = true
  order by atp.created_at desc
  limit 1
) tpr on true
left join lateral (
  select count(*)::integer as agent_count
  from public.agents ta
  where ta.team_id = t.id
    and ta.status in ('listed', 'private_beta')
) tc on true
where a.status in ('listed', 'private_beta')
  and (t.id is null or t.status in ('listed', 'private_beta'));

create or replace view public.agent_team_marketplace_cards
with (security_invoker = true)
as
select
  t.id,
  t.slug,
  t.name,
  t.handle,
  t.owner_id,
  p.display_name as owner_name,
  t.status,
  t.headline,
  t.public_summary,
  t.public_skills,
  t.accent,
  t.rating,
  t.historical_calls,
  t.median_latency_ms,
  count(a.id)::integer as agent_count,
  min(ap.price_per_mcp_call_usd) as min_agent_price_per_call_usd,
  max(ap.price_per_mcp_call_usd) as max_agent_price_per_call_usd,
  atp.billing_unit,
  atp.base_price_usd,
  atp.included_calls,
  atp.overage_price_per_call_usd,
  atp.billing_note
from public.agent_teams t
join public.profiles p on p.id = t.owner_id
left join public.agents a
  on a.team_id = t.id
  and a.status in ('listed', 'private_beta')
left join lateral (
  select *
  from public.agent_pricing ap
  where ap.agent_id = a.id
    and ap.active = true
  order by ap.created_at desc
  limit 1
) ap on true
left join lateral (
  select *
  from public.agent_team_pricing atp
  where atp.team_id = t.id
    and atp.active = true
  order by atp.created_at desc
  limit 1
) atp on true
where t.status in ('listed', 'private_beta')
group by
  t.id,
  p.display_name,
  atp.billing_unit,
  atp.base_price_usd,
  atp.included_calls,
  atp.overage_price_per_call_usd,
  atp.billing_note;

alter table public.agent_teams enable row level security;
alter table public.agent_team_pricing enable row level security;
alter table public.agent_team_hires enable row level security;

drop policy if exists "creators insert agents" on public.agents;
drop policy if exists "creators update own agents" on public.agents;

create policy "creators insert agents"
  on public.agents for insert
  with check (
    creator_id = auth.uid()
    and (
      team_id is null
      or exists (
        select 1
        from public.agent_teams t
        where t.id = team_id
          and t.owner_id = auth.uid()
      )
    )
  );

create policy "creators update own agents"
  on public.agents for update
  using (creator_id = auth.uid())
  with check (
    creator_id = auth.uid()
    and (
      team_id is null
      or exists (
        select 1
        from public.agent_teams t
        where t.id = team_id
          and t.owner_id = auth.uid()
      )
    )
  );

create policy "listed agent teams are readable"
  on public.agent_teams for select
  using (
    status in ('listed', 'private_beta')
    or owner_id = auth.uid()
  );

create policy "owners insert agent teams"
  on public.agent_teams for insert
  with check (owner_id = auth.uid());

create policy "owners update agent teams"
  on public.agent_teams for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "active team pricing is readable"
  on public.agent_team_pricing for select
  using (
    active = true
    and exists (
      select 1
      from public.agent_teams t
      where t.id = agent_team_pricing.team_id
        and (
          t.status in ('listed', 'private_beta')
          or t.owner_id = auth.uid()
        )
    )
  );

create policy "owners manage team pricing"
  on public.agent_team_pricing for all
  using (
    exists (
      select 1
      from public.agent_teams t
      where t.id = agent_team_pricing.team_id
        and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.agent_teams t
      where t.id = agent_team_pricing.team_id
        and t.owner_id = auth.uid()
    )
  );

create policy "users read related team hires"
  on public.agent_team_hires for select
  using (hirer_id = auth.uid() or owner_id = auth.uid());

create policy "hirers create own team hires"
  on public.agent_team_hires for insert
  with check (hirer_id = auth.uid());

create policy "hirers update own team hires"
  on public.agent_team_hires for update
  using (hirer_id = auth.uid())
  with check (hirer_id = auth.uid());

comment on table public.agent_teams is
  'Team-level marketplace product. A team can expose one hire receipt while routing calls to multiple protected Agents.';

comment on table public.agent_team_pricing is
  'Team access pricing. Agent execution pricing stays in agent_pricing so ledger rows can split team access and agent execution charges.';

comment on column public.mcp_call_ledger.team_access_amount_usd is
  'Portion attributed to the team access pass or overage pool.';

comment on column public.mcp_call_ledger.agent_execution_amount_usd is
  'Portion attributed to the executing Agent creator.';
