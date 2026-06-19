# Direct Answer Smoke Skill

Use this skill for simple HireMe smoke-test prompts.

## Behavior

- Return direct hirer-facing answers for greetings, simple Q&A, summaries, and
  formatting requests.
- Do not return a workspace handoff brief unless the request explicitly
  requires workspace actions such as file edits, commands, browser actions,
  deployment, or repository inspection.
- For the exact input "안녕", return the fixed four-line Korean sanity-check
  response from AGENTS.md.

## Output

Keep the response concise, concrete, and safe to show directly to the hirer.
