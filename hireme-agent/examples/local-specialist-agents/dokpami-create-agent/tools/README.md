# Tools

The original `dokpami-create-agent.zip` included a Python CLI with prompt
construction and an image-edit call. The local specialist wrapper keeps only the
prompt construction path in `private-source/prompt_builder.py` and calls it
through `adapter/run.mjs`. It does not call a direct image endpoint.

The adapter returns both a public-safe `image_spec` and a self-contained
`svg_preview` artifact. HireMe Runtime then validates and materializes the
returned image artifact with `hireme_materialize_specialist_image_artifact`.
This keeps the specialist work in the model loop until a safe result exists,
then moves the result back to Runtime for file validation.

Use `provider=auto` to materialize the local SVG preview without external image
generation. When a Codex host exposes image generation through a bridge command,
use `provider=codex_image_gen`. The bridge receives the public-safe Dokpami image
brief and an `outputPath`, then writes the generated PNG for Runtime validation.
