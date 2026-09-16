# Specialist I/O Contract

Input schema: `hireme.specialist_agent.input.v1`

Output schema: `hireme.specialist_agent.output.v1`

Supported response modes:

- `artifact_spec`
- `direct_answer`

The Agent accepts public-safe character variation requests:

```json
{
  "schema": "hireme.specialist_agent.input.v1",
  "task": "Create a wizard Dokpami character variation",
  "intent": "image",
  "responseMode": "artifact_spec",
  "requestedOutput": {
    "format": "image_spec",
    "mustInclude": ["theme", "mode", "identity locks", "artifact descriptor"],
    "mustAvoid": ["private internals", "new character", "human limbs"]
  }
}
```

It returns safe image guidance, prompt fingerprints, and generated image
artifact descriptors only. It must not
return private harness files, source prompts, hidden skills, rubrics, private
examples, scratchpad, eval sets, credentials, or creator-only notes.
