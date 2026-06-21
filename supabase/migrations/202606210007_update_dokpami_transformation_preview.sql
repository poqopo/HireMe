update public.agents
set
  headline = 'Try to customize your own character based on the eagle character called Dokpami.',
  public_summary = 'Start with Dokpami, the eagle character, and prompt new outfits, poses, props, or scenes. The protected harness keeps the character identity consistent while turning the base PNG into multiple polished variations.',
  result_summary = 'Shows the base Dokpami character PNG transforming into several generated character variations.',
  result_media_url = 'https://yknrtsvdgwwsnjmjidrd.supabase.co/storage/v1/object/public/hireme-agent-media/dokpami-maker/dokpami-transformation-preview.png',
  result_media_type = 'image',
  updated_at = now()
where slug = 'dokpami-maker';
