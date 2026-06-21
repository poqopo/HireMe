update public.agents
set
  headline = 'Turn one prompt into a ready-to-use Dokpami character image.',
  public_summary = 'Describe the Dokpami you want and get a polished PNG variation that keeps the original character identity while changing the outfit, pose, props, expression, and background. The protected harness handles the style rules behind the scenes, so Clients get the result without seeing the private recipe.',
  how_to_use = 'Describe the Dokpami character variation you want. Include the outfit, prop, pose, expression, background, and whether the result should be a character asset or a full scene.',
  result_summary = 'Returns a polished PNG variation that keeps the Dokpami identity while applying the requested outfit, prop, pose, background, or scene.',
  result_sample = 'Create a Dokpami wizard eagle character.',
  result_media_url = 'https://yknrtsvdgwwsnjmjidrd.supabase.co/storage/v1/object/public/hireme-agent-media/dokpami-maker/dokpami-result-preview.png',
  result_media_type = 'image',
  updated_at = now()
where slug = 'dokpami-maker';
