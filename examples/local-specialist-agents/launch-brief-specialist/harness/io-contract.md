# Specialist I/O Contract

Input schema: `hireme.specialist_agent.input.v1`

Output schema: `hireme.specialist_agent.output.v1`

Supported response modes:

- `direct_answer`
- `artifact_spec`
- `local_workspace_execution_brief`

The Agent accepts only public-safe task context. It must not receive or return
private harness files, prompts, hidden skills, rubrics, private examples, memory,
scratchpad, eval sets, credentials, or creator-only notes.
