# Routing

- Use `artifact_spec` for character variation requests.
- Use `direct_answer` for public capability questions.
- Refuse internal-content requests before applying the character workflow.
- Local smoke executes `private-source/prompt_builder.py` and returns a prompt fingerprint instead of exposing the full private prompt.
- Real image generation is delegated to HireMe Runtime `codex_image_gen`, not to a direct image endpoint inside this specialist.
