alter table public.protected_artifacts
  alter column encryption_provider set default 'platform_encryption',
  alter column ciphertext_format set default 'hireme.platform_encryption.v1';

alter table public.user_memwal_results
  alter column encryption_provider set default 'platform_encryption',
  alter column ciphertext_format set default 'hireme.platform_encryption.v1';

comment on column public.protected_artifacts.encryption_provider is
  'MVP provider for creator Harness artifacts. v1 uses platform_encryption; Sui Seal is a separate future provider.';

comment on column public.protected_artifacts.ciphertext_format is
  'Envelope format for artifact ciphertext stored on Walrus or compatible storage. v1 format is hireme.platform_encryption.v1.';

comment on column public.user_memwal_results.encryption_provider is
  'MVP provider for hirer-scoped memWal result records. v1 uses platform_encryption.';

comment on column public.user_memwal_results.ciphertext_format is
  'Envelope format for encrypted memWal result records. v1 format is hireme.platform_encryption.v1.';
