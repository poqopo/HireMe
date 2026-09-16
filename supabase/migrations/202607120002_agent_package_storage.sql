begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agent-packages',
  'agent-packages',
  false,
  104857600,
  array['application/vnd.hireme.encrypted-agent+json']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.agent_versions
  add column package_ciphertext_digest text
    check (
      package_ciphertext_digest is null
      or package_ciphertext_digest ~ '^sha256:[a-f0-9]{64}$'
    ),
  add column package_size_bytes bigint
    check (package_size_bytes is null or package_size_bytes >= 0),
  add column package_encryption jsonb not null default '{}'::jsonb
    check (jsonb_typeof(package_encryption) = 'object');

do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'hireme_agent_package_master_key_v1'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'hireme_agent_package_master_key_v1',
      'AES-256 master key for encrypted HireMe Agent packages. Runtime only.'
    );
  end if;
end;
$$;

create function public.get_agent_package_runtime_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'hireme_agent_package_master_key_v1'
  limit 1;
$$;

revoke all on function public.get_agent_package_runtime_secret()
  from public, anon, authenticated;
grant execute on function public.get_agent_package_runtime_secret()
  to service_role;

comment on column public.agent_versions.runtime_ref is
  'Opaque runtime locator. Protected packages use supabase-storage://agent-packages/<object-path>.';
comment on column public.agent_versions.package_digest is
  'SHA-256 digest of the validated plaintext HireMe package document.';
comment on column public.agent_versions.package_ciphertext_digest is
  'SHA-256 digest of the encrypted package ciphertext.';
comment on column public.agent_versions.package_size_bytes is
  'Encrypted envelope size stored in the private Agent package bucket.';
comment on column public.agent_versions.package_encryption is
  'Public-safe encryption metadata only. Never contains a key or decrypted package content.';
comment on function public.get_agent_package_runtime_secret() is
  'Returns the Agent package master key to service_role only. Never expose this RPC to desktop clients.';

-- Intentionally no storage.objects policies are created for agent-packages.
-- Only service_role can publish or retrieve encrypted package objects.

commit;
