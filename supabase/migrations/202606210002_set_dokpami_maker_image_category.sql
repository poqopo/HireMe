update public.agents
set category = 'image'::public.agent_category,
    updated_at = now()
where slug = 'dokpami-maker';
