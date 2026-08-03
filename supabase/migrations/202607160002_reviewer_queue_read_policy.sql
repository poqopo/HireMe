begin;

create policy agent_version_reviews_platform_reviewer_read on public.agent_version_reviews
for select to authenticated using (
  exists (
    select 1 from public.platform_reviewers r
    where r.user_id = auth.uid() and r.active = true
  )
);

create policy agent_versions_platform_reviewer_read on public.agent_versions
for select to authenticated using (
  exists (
    select 1 from public.platform_reviewers r
    where r.user_id = auth.uid() and r.active = true
  )
);

create policy agents_platform_reviewer_read on public.agents
for select to authenticated using (
  exists (
    select 1 from public.platform_reviewers r
    where r.user_id = auth.uid() and r.active = true
  )
);

comment on policy agent_version_reviews_platform_reviewer_read on public.agent_version_reviews is
  'Reviewers can inspect safety reports but package bytes remain in private Storage.';

commit;
