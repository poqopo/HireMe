# Core Workflow

1. Parse the requested theme, mode, and whether the output should be character-only.
2. Route execution through the original private Dokpami harness adapter.
3. Let `private-source/prompt_builder.py` construct the private prompt.
4. Avoid human limbs, species changes, photorealism, text, logos, watermarks, unrelated characters, and full redesigns.
5. Return only public-safe image specs, prompt fingerprints, generated image artifacts, assumptions, and risks.
