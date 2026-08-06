alter table public.profiles
  add column ai_setup_completed boolean not null default false;

grant update (ai_setup_completed) on public.profiles to authenticated;

comment on column public.profiles.ai_setup_completed is
  'Whether the user has completed the first-run AI connection choice.';
