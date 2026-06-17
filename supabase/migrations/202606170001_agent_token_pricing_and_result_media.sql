alter table public.agents
  add column if not exists avg_input_tokens integer
    check (avg_input_tokens is null or avg_input_tokens >= 0),
  add column if not exists avg_output_tokens integer
    check (avg_output_tokens is null or avg_output_tokens >= 0),
  add column if not exists active_user_count integer not null default 0
    check (active_user_count >= 0),
  add column if not exists result_title text,
  add column if not exists result_summary text,
  add column if not exists result_sample text,
  add column if not exists result_media_url text,
  add column if not exists result_media_type text
    check (result_media_type is null or result_media_type in ('image', 'video'));

alter table public.agent_pricing
  add column if not exists price_per_1m_tokens_usd numeric(12, 6)
    check (price_per_1m_tokens_usd is null or price_per_1m_tokens_usd >= 0);

update public.agent_pricing
set
  price_per_1m_tokens_usd = case
    when price_per_1m_tokens_usd is not null then price_per_1m_tokens_usd
    when price_per_mcp_call_usd < 1 then price_per_mcp_call_usd * 1000
    else price_per_mcp_call_usd
  end,
  billing_unit = case
    when billing_unit = 'mcp_call' then 'token_1m'
    else billing_unit
  end;

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
  tpr.billing_note as team_billing_note,
  pr.price_per_1m_tokens_usd,
  a.avg_input_tokens,
  a.avg_output_tokens,
  a.active_user_count,
  a.result_title,
  a.result_summary,
  a.result_sample,
  a.result_media_url,
  a.result_media_type
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

comment on column public.agent_pricing.price_per_1m_tokens_usd is
  'Creator-facing execution price in USD per one million input+output tokens. price_per_mcp_call_usd remains as a legacy compatibility column.';

comment on column public.agents.avg_input_tokens is
  'Gateway-computed average input tokens from successful MCP executions.';

comment on column public.agents.avg_output_tokens is
  'Gateway-computed average output tokens from successful MCP executions.';

comment on column public.agents.active_user_count is
  'Gateway-computed distinct hirer count for recent successful executions.';

comment on column public.agents.result_media_url is
  'Public Supabase Storage URL for an optional result preview image or video.';
