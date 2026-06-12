alter table public.protected_artifacts
  add column if not exists seal_package_id text,
  add column if not exists seal_approve_target text,
  add column if not exists seal_threshold integer check (
    seal_threshold is null or seal_threshold > 0
  ),
  add column if not exists seal_key_server_ids text[] not null default '{}'::text[];

comment on column public.protected_artifacts.seal_package_id is
  'Optional future Seal provider package id. Platform-managed encryption is the MVP default.';

comment on column public.protected_artifacts.seal_approve_target is
  'Optional future Seal provider Move target, e.g. <package>::access::seal_approve.';

comment on column public.protected_artifacts.seal_threshold is
  'Optional future Seal threshold. Null for the platform-managed MVP provider.';

comment on column public.protected_artifacts.seal_key_server_ids is
  'Optional future Seal key server object ids. Empty for the platform-managed MVP provider.';
