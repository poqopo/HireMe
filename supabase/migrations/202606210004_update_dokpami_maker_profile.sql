update public.agents
set
  name = 'Dokpami Maker',
  handle = '@agents/dokpami-maker',
  category = 'image'::public.agent_category,
  status = 'listed'::public.agent_status,
  headline = 'Creates Dokpami character variation PNGs from natural-language prompts.',
  public_summary = 'Dokpami Maker turns a client prompt into a 1024x1024 PNG variation of the Dokpami character. It uses a protected base character image and image-editing harness to keep the recognizable Dokpami identity while changing outfits, props, poses, expressions, backgrounds, and scene mood.',
  public_skills = array[
    'Character variation',
    'Image editing',
    'Style preservation',
    'Prompt-to-PNG'
  ],
  public_mcp_contract = 'dokpami_character_variation(prompt, mode, character_only, conversation_id)',
  accent = 'from-[#7c3aed] to-[#facc15]',
  result_title = 'Dokpami character PNG',
  result_summary = 'Returns a generated PNG that keeps the Dokpami character identity while applying the requested outfit, prop, pose, background, or scene.',
  result_sample = 'Create a Dokpami wizard eagle character. Make it a centered character asset with a simple plain background.',
  result_media_type = 'image',
  updated_at = now()
where slug = 'dokpami-maker';

with dokpami as (
  select id, current_version_id
  from public.agents
  where slug = 'dokpami-maker'
)
update public.agent_versions av
set
  public_mcp_contract = 'dokpami_character_variation(prompt, mode, character_only, conversation_id)',
  release_notes = 'Public profile updated for the Dokpami character variation image harness.',
  artifact_manifest = av.artifact_manifest || jsonb_build_object(
    'publicSkills',
    to_jsonb(array[
      'Character variation',
      'Image editing',
      'Style preservation',
      'Prompt-to-PNG'
    ]::text[]),
    'protectedAssetClasses',
    to_jsonb(array[
      'Base character image',
      'Identity preservation rules',
      'Image-editing harness',
      'Generation modes'
    ]::text[])
  )
from dokpami
where av.id = dokpami.current_version_id;

with dokpami as (
  select id, current_version_id
  from public.agents
  where slug = 'dokpami-maker'
)
update public.protected_artifacts pa
set metadata = pa.metadata || jsonb_build_object(
  'visibility',
  'Clients receive generated PNG results. The base character image, identity rules, and image-editing harness stay protected behind the gateway.',
  'protectedAssetClasses',
  to_jsonb(array[
    'Base character image',
    'Identity preservation rules',
    'Image-editing harness',
    'Generation modes'
  ]::text[]),
  'harnessArchiveFormat',
  coalesce(pa.metadata->>'harnessArchiveFormat', pa.metadata->>'archiveFormat', 'zip')
)
from dokpami
where pa.agent_id = dokpami.id
  and pa.kind = 'agent_folder'
  and (
    dokpami.current_version_id is null
    or pa.agent_version_id = dokpami.current_version_id
  );
