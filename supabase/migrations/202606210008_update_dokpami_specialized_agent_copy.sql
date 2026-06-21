update public.agents
set
  headline = 'Try to customize your own character based on the eagle character called Dokpami.',
  public_summary = 'My specialized Agent, Dokpami-creator, converts the Dokpami eagle character into customized outfits, poses, props, and scenes. It creates polished Dokpami-style images instead of generic results, so try it once with your own character idea.',
  result_summary = 'Shows the base Dokpami character PNG transforming into several customized character variations.',
  result_media_url = 'https://yknrtsvdgwwsnjmjidrd.supabase.co/storage/v1/object/public/hireme-agent-media/dokpami-maker/dokpami-transformation-preview.png',
  result_media_type = 'image',
  updated_at = now()
where slug = 'dokpami-maker';
