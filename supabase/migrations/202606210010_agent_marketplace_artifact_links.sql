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
  a.creator_info_url,
  a.category,
  a.status,
  a.headline,
  a.public_summary,
  a.how_to_use,
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
  a.result_media_type,
  pr.price_per_1m_tokens_sui,
  a.created_at,
  a.updated_at,
  coalesce(
    pa.network,
    case
      when waa.storage_network in ('mainnet', 'walrus-mainnet') then 'walrus-mainnet'
      when waa.storage_network in ('testnet', 'walrus-testnet') then 'walrus-testnet'
      else null
    end
  ) as artifact_network,
  coalesce(pa.walrus_blob_id, waa.walrus_blob_id) as walrus_blob_id,
  coalesce(pa.walrus_sui_object_id, waa.walrus_sui_object_id) as walrus_sui_object_id
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
left join lateral (
  select *
  from public.protected_artifacts artifact
  where artifact.agent_id = a.id
    and artifact.kind = 'agent_folder'
  order by
    (artifact.agent_version_id = a.current_version_id) desc,
    artifact.created_at desc
  limit 1
) pa on true
left join lateral (
  select *
  from public.walrus_agent_artifacts artifact
  where artifact.agent_id in (a.slug, a.id::text)
  order by artifact.created_at desc
  limit 1
) waa on true
where a.status in ('listed', 'private_beta')
  and (t.id is null or t.status in ('listed', 'private_beta'));
