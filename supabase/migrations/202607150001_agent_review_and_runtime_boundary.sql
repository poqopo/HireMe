begin;

-- A package can be stored before it is public, but it cannot become the
-- current public version until a trusted reviewer approves it.
alter table public.agent_versions
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewer_note text not null default ''
    check (char_length(reviewer_note) <= 2000);

create table if not exists public.agent_version_reviews (
  id uuid primary key default gen_random_uuid(),
  agent_version_id uuid not null unique references public.agent_versions(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  automated_report jsonb not null default '{}'::jsonb
    check (jsonb_typeof(automated_report) = 'object'),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text not null default '' check (char_length(reviewer_note) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists agent_version_reviews_status_idx
  on public.agent_version_reviews (status, created_at);

alter table public.agent_version_reviews enable row level security;

create policy agent_version_reviews_creator_read on public.agent_version_reviews
for select to authenticated using (
  exists (
    select 1 from public.agent_versions v
    join public.agents a on a.id = v.agent_id
    where v.id = agent_version_id and a.creator_id = auth.uid()
  )
);

-- Approval is deliberately service-role only. A desktop client, including a
-- creator's own client, cannot approve its own package.
create or replace function public.review_agent_version(
  target_version_id uuid,
  decision text,
  note text default ''
)
returns table (agent_id uuid, version_number integer, review_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent_id uuid;
  target_version_number integer;
  normalized_decision text := lower(trim(decision));
begin
  if normalized_decision not in ('approved', 'rejected') then
    raise exception 'review decision must be approved or rejected';
  end if;

  select v.agent_id, v.version_number
    into target_agent_id, target_version_number
  from public.agent_versions v
  where v.id = target_version_id
  for update;
  if target_agent_id is null then
    raise exception 'agent version not found';
  end if;

  update public.agent_versions
  set review_status = normalized_decision,
      reviewed_at = now(),
      reviewer_note = left(coalesce(note, ''), 2000),
      published_at = case when normalized_decision = 'approved' then now() else published_at end
  where id = target_version_id;

  update public.agent_version_reviews
  set status = normalized_decision,
      reviewer_note = left(coalesce(note, ''), 2000),
      reviewed_at = now()
  where agent_version_id = target_version_id;

  if normalized_decision = 'approved' then
    update public.agents
    set status = 'published', visibility = 'public', current_version = target_version_number
    where id = target_agent_id;
  end if;

  return query select target_agent_id, target_version_number, normalized_decision;
end;
$$;

revoke all on public.agent_version_reviews from public, anon, authenticated;
grant select on public.agent_version_reviews to authenticated;
grant all on public.agent_version_reviews to service_role;
revoke all on function public.review_agent_version(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_agent_version(uuid, text, text) to service_role;

-- The trusted runtime consumes finite run entitlements atomically. The desktop
-- app never receives a mutable balance or a package execution key.
create or replace function public.consume_agent_run_entitlement(
  target_user_id uuid,
  target_agent_id uuid
)
returns table (remaining_runs integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.agent_access
  set remaining_runs = case
        when remaining_runs is null then null
        else remaining_runs - 1
      end,
      updated_at = now()
  where user_id = target_user_id
    and agent_id = target_agent_id
    and status = 'active'
    and (remaining_runs is null or remaining_runs > 0)
  returning agent_access.remaining_runs into remaining_runs;

  if not found then
    raise exception 'active Agent entitlement with remaining runs is required';
  end if;
  return next;
end;
$$;

revoke all on function public.consume_agent_run_entitlement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_agent_run_entitlement(uuid, uuid) to service_role;

comment on table public.agent_version_reviews is
  'Trusted review queue. Private package bytes remain in private Storage and are never selected by client roles.';
comment on function public.review_agent_version(uuid, text, text) is
  'Service-role-only approval gate for HireMe Agent versions.';
comment on function public.consume_agent_run_entitlement(uuid, uuid) is
  'Service-role-only atomic consumption for finite Agent run access.';

commit;
