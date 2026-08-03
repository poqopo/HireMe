begin;

create table if not exists public.platform_reviewers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'reviewer' check (role in ('reviewer', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger platform_reviewers_set_updated_at before update on public.platform_reviewers
for each row execute function public.set_updated_at();

alter table public.platform_reviewers enable row level security;

create policy platform_reviewers_read_self on public.platform_reviewers
for select to authenticated using (user_id = auth.uid() and active = true);

revoke all on public.platform_reviewers from public, anon, authenticated;
grant select on public.platform_reviewers to authenticated;
grant all on public.platform_reviewers to service_role;

comment on table public.platform_reviewers is
  'Platform-operated reviewer allowlist. Membership is provisioned only with service_role.';

commit;
