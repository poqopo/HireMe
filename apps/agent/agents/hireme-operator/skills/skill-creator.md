# Skill Creator

Use this skill when a creator wants to add, revise, or assess a reusable
private procedure inside a HireMe-native local Agent.

## Create a Focused Skill

1. Start from one or two concrete recurring requests. Identify the user-visible
   outcome, the conditions that should trigger the procedure, and the failure
   it should prevent.
2. Collect only the inputs the procedure truly needs: task, constraints,
   audience, supplied evidence or files, desired format, and any explicit
   non-goals.
3. Keep one skill focused on one repeatable decision or workflow. Split it when
   different requests need different inputs, tools, output formats, or quality
   bars.
4. Call `hireme_create_agent_skill` with `agent_id`, `skill_name`, and a clear
   `purpose`. Add trigger signals, input requirements, ordered steps, quality
   checks, and boundaries whenever they make behavior more reliable.
5. The generated private source belongs under `skills/<skill-name>.md`. Do not
   return or quote its contents to a hirer.

## Improve an Existing Skill

1. Check `hireme_get_agent_authoring_status` before changing an Agent whose
   current test, eval, or package readiness matters.
2. Use `hireme_update_agent_draft_file` for a small targeted correction, or
   call `hireme_create_agent_skill` with `overwrite=true` to replace a
   structured skill deliberately.
3. Make quality checks observable. Prefer requirements such as citing supplied
   evidence, naming assumptions, checking a format, or avoiding unsupported
   claims over vague instructions such as “be excellent.”
4. Add a creator-owned eval case when the skill prevents a high-value failure.

## Verify the Changed Agent

Changing a private skill advances the Agent revision and makes earlier test,
eval, and package evidence stale. Always follow the current workflow:

```text
validate -> representative test -> private eval -> package
```

Use `hireme_validate_agent_draft`, `hireme_test_agent_draft`, and
`hireme_evaluate_agent_draft` on the same revision before release packaging.
`--skip-eval` is only for a development package and never establishes release
readiness.

## Boundaries

- Keep `AGENTS.md`, private skills, private examples, eval cases, Bootstrap
  Memory, routing, prompts, and credentials private.
- Do not use a skill to claim external verification, tool actions, or file
  changes that did not occur.
- Final user-facing summaries may name the skill path, workflow phase, and
  pass/fail status, but must not reveal private source text.
