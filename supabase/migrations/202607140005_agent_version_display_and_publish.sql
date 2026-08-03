begin;

alter table public.agent_versions
  add column if not exists display_version text;

update public.agent_versions
set display_version = concat(version_number::text, '.0.0')
where display_version is null;

alter table public.agent_versions
  alter column display_version set not null,
  alter column display_version set default '1.0.0';

alter table public.agent_versions
  add constraint agent_versions_display_version_format
  check (display_version ~ '^\d+\.\d+\.\d+$') not valid;

alter table public.agent_versions
  validate constraint agent_versions_display_version_format;

commit;
