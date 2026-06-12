alter table public.protected_artifacts
  add column if not exists encryption_provider text not null default 'platform-managed-envelope',
  add column if not exists platform_kms_key_id text,
  add column if not exists ciphertext_format text not null default 'hireme.platform-ciphertext-envelope.v1';

comment on column public.protected_artifacts.encryption_provider is
  'Default MVP provider is platform-managed-envelope. Seal threshold provider is optional later.';

comment on column public.protected_artifacts.platform_kms_key_id is
  'Logical platform KMS key id used by the gateway to decrypt protected artifacts.';

comment on column public.protected_artifacts.ciphertext_format is
  'Envelope format for artifact ciphertext stored on Walrus or compatible storage.';
