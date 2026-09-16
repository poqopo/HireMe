begin;

alter table public.agents
  add column if not exists public_design_contract jsonb not null default '{}'::jsonb
    check (jsonb_typeof(public_design_contract) = 'object');

alter table public.agent_versions
  add column if not exists display_version text;

create table public.pilot_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table public.creator_workers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  device_name text not null check (char_length(device_name) between 1 and 120),
  signing_public_key text not null,
  encryption_public_key text not null,
  key_fingerprint text not null check (key_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  platform text not null check (platform in ('darwin', 'win32', 'linux')),
  app_version text not null check (char_length(app_version) between 1 and 40),
  availability text not null default 'unavailable'
    check (availability in ('available', 'unavailable')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, key_fingerprint)
);

create table public.agent_worker_bindings (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  worker_id uuid not null references public.creator_workers(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  local_agent_id text not null check (local_agent_id ~ '^[a-z0-9][a-z0-9._-]{0,100}$'),
  harness_revision text not null check (char_length(harness_revision) between 1 and 80),
  harness_digest text not null check (harness_digest ~ '^sha256:[a-f0-9]{64}$'),
  execution_class text not null default 'creator_worker' check (execution_class = 'creator_worker'),
  status text not null default 'active' check (status in ('pending', 'active', 'incompatible', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.design_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete restrict,
  agent_version_id uuid references public.agent_versions(id) on delete restrict,
  status text not null default 'queued' check (status in (
    'draft', 'queued', 'running', 'evaluating', 'awaiting_creator_approval',
    'revision_requested', 'delivered', 'blocked', 'failed', 'canceled',
    'expired', 'approval_expired'
  )),
  brief jsonb not null check (jsonb_typeof(brief) = 'object'),
  retention_until timestamptz not null default (now() + interval '7 days'),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.design_project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.design_projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  direction text not null check (direction in ('input', 'intermediate', 'delivery')),
  kind text not null check (char_length(kind) between 1 and 80),
  storage_bucket text not null,
  storage_path text not null,
  filename text not null check (char_length(filename) between 1 and 240),
  mime_type text not null check (char_length(mime_type) between 3 and 160),
  size_bytes bigint not null check (size_bytes between 0 and 52428800),
  content_digest text not null check (content_digest ~ '^sha256:[a-f0-9]{64}$'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.creator_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.design_projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  agent_id uuid not null references public.agents(id) on delete restrict,
  agent_version_id uuid references public.agent_versions(id) on delete restrict,
  worker_id uuid not null references public.creator_workers(id) on delete restrict,
  status text not null default 'queued' check (status in (
    'awaiting_assets', 'queued', 'leased', 'running', 'evaluating', 'awaiting_creator_approval',
    'revision_requested', 'delivered', 'cancel_requested', 'canceled',
    'retryable_failed', 'failed', 'expired', 'approval_expired'
  )),
  workflow_id text not null default 'brand-social-campaign',
  workflow_revision text not null default 'v1',
  harness_revision text not null,
  harness_digest text not null check (harness_digest ~ '^sha256:[a-f0-9]{64}$'),
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  idempotency_key text not null,
  attempt_number integer not null default 0 check (attempt_number between 0 and 2),
  max_attempts integer not null default 2 check (max_attempts between 1 and 2),
  lease_token_digest text check (lease_token_digest is null or lease_token_digest ~ '^sha256:[a-f0-9]{64}$'),
  lease_expires_at timestamptz,
  lease_heartbeat_at timestamptz,
  cancel_requested_at timestamptz,
  error_code text,
  error_detail text check (error_detail is null or char_length(error_detail) <= 2000),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, idempotency_key)
);

create table public.creator_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.creator_jobs(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table public.design_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.design_projects(id) on delete cascade,
  job_id uuid not null references public.creator_jobs(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null check (kind in ('preview', 'source', 'export', 'rationale', 'evaluation_report')),
  version integer not null default 1 check (version > 0),
  filename text not null check (char_length(filename) between 1 and 240),
  mime_type text not null check (char_length(mime_type) between 3 and 160),
  size_bytes bigint not null check (size_bytes between 0 and 52428800),
  content_digest text not null check (content_digest ~ '^sha256:[a-f0-9]{64}$'),
  storage_bucket text not null default 'design-deliveries',
  storage_path text not null,
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  worker_signature text not null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, kind, version, content_digest),
  unique (storage_bucket, storage_path)
);

create table public.design_evaluations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.design_projects(id) on delete cascade,
  job_id uuid not null references public.creator_jobs(id) on delete cascade,
  evaluator text not null check (evaluator in ('worker_machine', 'design_critic', 'creator')),
  attempt_number integer not null check (attempt_number between 1 and 2),
  verdict text not null check (verdict in ('pass', 'revise', 'blocked')),
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  created_at timestamptz not null default now()
);

create table public.design_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.design_projects(id) on delete cascade,
  job_id uuid not null references public.creator_jobs(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'revision_requested', 'rejected')),
  attempt_number integer not null check (attempt_number between 1 and 2),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index creator_workers_creator_idx on public.creator_workers (creator_id, updated_at desc);
create index creator_jobs_worker_queue_idx on public.creator_jobs (worker_id, status, queued_at);
create index creator_jobs_project_idx on public.creator_jobs (project_id, created_at desc);
create index creator_job_events_job_idx on public.creator_job_events (job_id, created_at);
create index design_projects_participants_idx on public.design_projects (client_id, creator_id, updated_at desc);
create index design_artifacts_project_idx on public.design_artifacts (project_id, created_at);

create trigger creator_workers_set_updated_at before update on public.creator_workers
for each row execute function public.set_updated_at();
create trigger agent_worker_bindings_set_updated_at before update on public.agent_worker_bindings
for each row execute function public.set_updated_at();
create trigger design_projects_set_updated_at before update on public.design_projects
for each row execute function public.set_updated_at();
create trigger creator_jobs_set_updated_at before update on public.creator_jobs
for each row execute function public.set_updated_at();

alter table public.creator_workers enable row level security;
alter table public.pilot_members enable row level security;
alter table public.agent_worker_bindings enable row level security;
alter table public.design_projects enable row level security;
alter table public.design_project_assets enable row level security;
alter table public.creator_jobs enable row level security;
alter table public.creator_job_events enable row level security;
alter table public.design_artifacts enable row level security;
alter table public.design_evaluations enable row level security;
alter table public.design_approvals enable row level security;

create policy creator_workers_read_owner on public.creator_workers
for select to authenticated using (creator_id = auth.uid());
create policy pilot_members_read_self on public.pilot_members
for select to authenticated using (user_id = auth.uid());
create policy agent_worker_bindings_read_participant on public.agent_worker_bindings
for select to authenticated using (
  creator_id = auth.uid()
  or exists (select 1 from public.agent_access aa where aa.agent_id = agent_worker_bindings.agent_id and aa.user_id = auth.uid() and aa.status = 'active')
);
create policy design_projects_read_participant on public.design_projects
for select to authenticated using (client_id = auth.uid() or creator_id = auth.uid());
create policy project_assets_read_participant on public.design_project_assets
for select to authenticated using (exists (
  select 1 from public.design_projects p where p.id = project_id and (p.client_id = auth.uid() or p.creator_id = auth.uid())
));
create policy creator_jobs_read_participant on public.creator_jobs
for select to authenticated using (client_id = auth.uid() or creator_id = auth.uid());
create policy creator_job_events_read_participant on public.creator_job_events
for select to authenticated using (exists (
  select 1 from public.creator_jobs j where j.id = job_id and (j.client_id = auth.uid() or j.creator_id = auth.uid())
));
create policy design_artifacts_read_participant on public.design_artifacts
for select to authenticated using (exists (
  select 1 from public.design_projects p where p.id = project_id and (p.client_id = auth.uid() or p.creator_id = auth.uid())
));
create policy design_evaluations_read_participant on public.design_evaluations
for select to authenticated using (exists (
  select 1 from public.design_projects p where p.id = project_id and (p.client_id = auth.uid() or p.creator_id = auth.uid())
));
create policy design_approvals_read_participant on public.design_approvals
for select to authenticated using (exists (
  select 1 from public.design_projects p where p.id = project_id and (p.client_id = auth.uid() or p.creator_id = auth.uid())
));

revoke all on public.pilot_members, public.creator_workers, public.agent_worker_bindings, public.design_projects,
  public.design_project_assets, public.creator_jobs, public.creator_job_events,
  public.design_artifacts, public.design_evaluations, public.design_approvals
  from anon, authenticated;
grant select on public.pilot_members, public.creator_workers, public.agent_worker_bindings, public.design_projects,
  public.design_project_assets, public.creator_jobs, public.creator_job_events,
  public.design_artifacts, public.design_evaluations, public.design_approvals
  to authenticated;
grant all on public.pilot_members, public.creator_workers, public.agent_worker_bindings, public.design_projects,
  public.design_project_assets, public.creator_jobs, public.creator_job_events,
  public.design_artifacts, public.design_evaluations, public.design_approvals
  to service_role;
grant all on all sequences in schema public to service_role;

create view public.creator_worker_status
with (security_invoker = true)
as
select
  w.*,
  case
    when w.status = 'revoked' then 'revoked'
    when w.last_heartbeat_at is null then 'offline'
    when w.last_heartbeat_at < now() - interval '90 seconds' then 'offline'
    when w.last_heartbeat_at < now() - interval '60 seconds' then 'stale'
    else 'online'
  end as health
from public.creator_workers w;

grant select on public.creator_worker_status to authenticated, service_role;

create function public.claim_creator_job(
  p_worker_id uuid,
  p_lease_token_digest text,
  p_lease_seconds integer default 300
)
returns setof public.creator_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.creator_jobs%rowtype;
begin
  if p_lease_token_digest !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'invalid lease digest';
  end if;
  if p_lease_seconds < 60 or p_lease_seconds > 900 then
    raise exception 'invalid lease duration';
  end if;
  if not exists (
    select 1 from public.creator_workers w
    where w.id = p_worker_id
      and w.creator_id = auth.uid()
      and w.status = 'active'
      and w.availability = 'available'
      and w.last_heartbeat_at > now() - interval '90 seconds'
  ) then
    raise exception 'worker is not available';
  end if;

  with candidate as (
    select j.id
    from public.creator_jobs j
    join public.agent_worker_bindings b
      on b.agent_id = j.agent_id
      and b.worker_id = j.worker_id
      and b.status = 'active'
    where j.worker_id = p_worker_id
      and j.status = 'queued'
      and j.cancel_requested_at is null
      and j.attempt_number < j.max_attempts
      and j.queued_at > now() - interval '72 hours'
    order by j.queued_at
    for update of j skip locked
    limit 1
  )
  update public.creator_jobs j
  set status = 'leased',
      attempt_number = j.attempt_number + 1,
      lease_token_digest = p_lease_token_digest,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      lease_heartbeat_at = now(),
      error_code = null,
      error_detail = null
  from candidate
  where j.id = candidate.id
  returning j.* into claimed;

  if claimed.id is not null then
    insert into public.creator_job_events (job_id, actor_id, event_type, from_status, to_status, payload)
    values (claimed.id, auth.uid(), 'worker_claimed', 'queued', 'leased',
      jsonb_build_object('workerId', p_worker_id, 'attempt', claimed.attempt_number));
    return next claimed;
  end if;
end;
$$;

create function public.renew_creator_job_lease(
  p_job_id uuid,
  p_worker_id uuid,
  p_lease_token_digest text,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.creator_jobs j
  set lease_expires_at = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 900))),
      lease_heartbeat_at = now()
  where j.id = p_job_id
    and j.worker_id = p_worker_id
    and j.creator_id = auth.uid()
    and j.status in ('leased', 'running', 'evaluating')
    and j.lease_token_digest = p_lease_token_digest
    and j.lease_expires_at > now()
    and j.cancel_requested_at is null;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.claim_creator_job(uuid, text, integer) from public, anon;
revoke all on function public.renew_creator_job_lease(uuid, uuid, text, integer) from public, anon;
grant execute on function public.claim_creator_job(uuid, text, integer) to authenticated;
grant execute on function public.renew_creator_job_lease(uuid, uuid, text, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('design-project-inputs', 'design-project-inputs', false, 52428800,
    array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']::text[]),
  ('design-deliveries', 'design-deliveries', false, 52428800,
    array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf','application/json']::text[]),
  ('creator-harness-backups', 'creator-harness-backups', false, 104857600,
    array['application/vnd.hireme.creator-backup+json']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.creator_workers is 'Registered outbound-only HireMe desktop execution workers.';
comment on column public.creator_jobs.lease_token_digest is 'SHA-256 digest only; the raw lease capability is never stored.';
comment on column public.design_artifacts.worker_signature is 'Proves the registered device submitted the manifest, not remote attestation of correct execution.';

commit;
