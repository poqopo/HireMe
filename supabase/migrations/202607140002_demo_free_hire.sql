begin;

create or replace function public.hire_demo_agent(agent_slug text)
returns table (agent_id uuid, access_mode text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_agent public.agents%rowtype;
begin
  select * into target_agent
  from public.agents as a
  where a.slug = lower(trim(agent_slug))
    and a.status = 'published'
    and a.visibility = 'public';

  if not found then
    raise exception 'The selected demo Agent is not available.' using errcode = 'P0002';
  end if;

  if target_agent.creator_id = auth.uid() then
    return query select target_agent.id, 'owner'::text, 'active'::text;
    return;
  end if;

  insert into public.agent_access (user_id, agent_id, access_mode, status, remaining_runs, renews_at)
  values (auth.uid(), target_agent.id, 'trial', 'active', null, null)
  on conflict on constraint agent_access_pkey do update set
    access_mode = 'trial',
    status = 'active',
    remaining_runs = null,
    renews_at = null,
    updated_at = now();

  return query select target_agent.id, 'trial'::text, 'active'::text;
end;
$$;

revoke all on function public.hire_demo_agent(text) from public, anon;
grant execute on function public.hire_demo_agent(text) to authenticated;

comment on function public.hire_demo_agent(text) is
  'Temporary demo-only free hire. Grants unlimited active access to a published public Agent.';

commit;
