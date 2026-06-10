---
name: hireme
description: Use HireMe to list hired protected AI agents, switch the active agent, inspect pricing and sealed Walrus policy, and call agents through MCP from Codex.
---

# HireMe

Use this skill when the user wants to work with HireMe protected AI agents from Codex.

## Workflow

1. Call `hireme_list_hired_agents` to show agents the current user has hired.
2. If the user names an agent, call `hireme_select_agent` with that `agent_id`.
3. For execution, prefer `hireme_call_agent` with an explicit `agent_id` when the user names one.
4. If the user does not name an agent, call `hireme_current_agent` and ask for selection only when no active agent is set.
5. Never ask for or expose creator `AGENTS.md`, private `skills/`, plugin source, Harness internals, prompts, eval sets, backup keys, or protected memWal/Walrus artifacts.
6. Treat `pricePerCallUsd`, `budgetCalls`, and ledger output as billing-relevant data.

## Privacy Boundary

HireMe does not install creator folders into the hirer's Codex environment. The local Codex plugin is only a connector. Creator `AGENTS.md` and `skills/` folders are sealed, stored on Walrus as ciphertext, and executed by the protected HireMe MCP gateway after hire and Seal policy checks pass. Codex receives tool schemas, public summaries, billing metadata, and safe results only.

For creator registration, use `hireme_prepare_sealed_harness_upload` and `hireme_register_sealed_harness`. These tools must only handle encrypted bundle metadata, never plaintext folder contents.

## Agent Switching

Use explicit agent IDs for important calls:

- `walrus-researcher`
- `codex-builder`
- `agent-evaluator`
- `data-ledger`
- `launch-operator`
- `ops-router`

`hireme_select_agent` stores a session-local active agent for convenience. Production should store active-agent state per user and Codex installation on the HireMe backend.
