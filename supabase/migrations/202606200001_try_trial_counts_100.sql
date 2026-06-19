update public.agent_pricing
set free_calls = 100
where active = true
  and free_calls < 100;

update public.agent_entitlements
set trial_calls_remaining = 100,
    updated_at = now()
where status = 'active'
  and access_type = 'trial'
  and coalesce(trial_calls_remaining, 0) < 100;
