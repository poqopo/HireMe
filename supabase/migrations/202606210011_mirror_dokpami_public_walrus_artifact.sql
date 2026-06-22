insert into public.walrus_agent_artifacts (
  agent_id,
  folder_name,
  walrus_blob_id,
  walrus_sui_object_id,
  archive_digest,
  archive_size_bytes,
  archive_format,
  storage_provider,
  storage_network,
  metadata
)
values (
  'dokpami-maker',
  'dokpami-maker',
  'e-AiHDAX2qyH4jUMfsRjKaNvGx-6euUh205VWczoqo8',
  '0xf41495316fc3094b89ffff216721c19ea71de5d769958e8b9a9f139c8c12a37a',
  'sha256:a72c2af0ba82804029a8f821deca34ca2629c221e2003e18368b9781c62a1601',
  5881895,
  'zip',
  'walrus',
  'testnet',
  jsonb_build_object(
    'source', 'protected_artifacts_public_registry',
    'agentSlug', 'dokpami-maker',
    'ciphertextDigest', 'sha256:a72c2af0ba82804029a8f821deca34ca2629c221e2003e18368b9781c62a1601',
    'folderManifestDigest', 'sha256:9d8735c0acae948c9c930576bd9eb66d4b82c0a06851c579b5895e573341c50b',
    'archiveFormat', 'zip'
  )
)
on conflict (walrus_blob_id) do update
set
  agent_id = excluded.agent_id,
  folder_name = excluded.folder_name,
  walrus_sui_object_id = excluded.walrus_sui_object_id,
  archive_digest = excluded.archive_digest,
  archive_size_bytes = excluded.archive_size_bytes,
  archive_format = excluded.archive_format,
  storage_provider = excluded.storage_provider,
  storage_network = excluded.storage_network,
  metadata = public.walrus_agent_artifacts.metadata || excluded.metadata,
  updated_at = now();
