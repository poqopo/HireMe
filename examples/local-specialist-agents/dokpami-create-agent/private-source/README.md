# Dokpami Prompt Builder

This private source folder contains the Dokpami identity and mode rules used to
construct image-generation prompts.

It does not contain a direct image API client. The active HireMe flow is:

```text
adapter/run.mjs
-> private-source/prompt_builder.py
-> public-safe imageSpec + prompt fingerprint
-> HireMe Runtime codex_image_gen bridge
```

`input/base.png` remains the private reference image for Dokpami identity. The
prompt text itself is private; the adapter returns only a fingerprint and a
public-safe image brief.
