begin;

-- Keep the output column separate from the table column. The previous function
-- used `remaining_runs` for both, which PostgreSQL rejected as ambiguous.
create or replace function public.consume_agent_run_entitlement(
  target_user_id uuid,
  target_agent_id uuid
)
returns table (remaining_runs integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_remaining_runs integer;
begin
  update public.agent_access as access_record
  set remaining_runs = case
        when access_record.remaining_runs is null then null
        else access_record.remaining_runs - 1
      end,
      updated_at = now()
  where access_record.user_id = target_user_id
    and access_record.agent_id = target_agent_id
    and access_record.status = 'active'
    and (access_record.remaining_runs is null or access_record.remaining_runs > 0)
  returning access_record.remaining_runs into updated_remaining_runs;

  if not found then
    raise exception 'active Agent entitlement with remaining runs is required';
  end if;

  return query select updated_remaining_runs;
end;
$$;

revoke all on function public.consume_agent_run_entitlement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_agent_run_entitlement(uuid, uuid) to service_role;

-- A reviewed package becomes the public version, so approval must enforce the
-- same execution boundary required by the device-license Edge Function.
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
  target_execution_class text;
  target_package_digest text;
  target_runtime_ref text;
  normalized_decision text := lower(trim(decision));
begin
  if normalized_decision not in ('approved', 'rejected') then
    raise exception 'review decision must be approved or rejected';
  end if;

  select
    version_record.agent_id,
    version_record.version_number,
    version_record.package_encryption ->> 'executionClass',
    version_record.package_digest,
    version_record.runtime_ref
  into
    target_agent_id,
    target_version_number,
    target_execution_class,
    target_package_digest,
    target_runtime_ref
  from public.agent_versions as version_record
  where version_record.id = target_version_id
  for update;

  if target_agent_id is null then
    raise exception 'agent version not found';
  end if;

  if normalized_decision = 'approved' and (
    target_execution_class is distinct from 'local_protected'
    or target_package_digest is null
    or target_runtime_ref is null
  ) then
    raise exception 'approved Agent versions require a local_protected package';
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

revoke all on function public.review_agent_version(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_agent_version(uuid, text, text) to service_role;

commit;
