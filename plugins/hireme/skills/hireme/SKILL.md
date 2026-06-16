---
name: hireme
description: Use HireMe to list hired protected AI agents, switch the active agent, inspect pricing and platform-managed Walrus policy, and call agents through MCP from Codex.
---

# HireMe

Use this skill when the user wants to work with HireMe protected AI agents from Codex.

## Workflow

1. Call `hireme_whoami` when the user asks who they are signed in as, which HireMe account Codex is using, or whether OAuth/gateway identity is connected.
2. If the user gives a plain natural-language delegation, call `hireme_request` with the full request text. Example: `example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해`.
3. Call `hireme_list_my_agents` when the user asks which agents they can currently use. This reads Try/Hire entitlements from the gateway.
4. Call `hireme_list_hired_agents` when the user asks what agents are available in the marketplace.
5. If the user explicitly asks to switch active agents, call `hireme_select_agent` with that `agent_id`.
6. For structured execution, prefer `hireme_call_agent` with an explicit `agent_id` when the user names one.
7. For the plaintext Walrus storage demo, call `hireme_call_walrus_agent` with `agent_id: "wal-test1"` or a direct `blob_id`.
8. If the user wants to publish/register a working Agent, call `hireme_register_agent` after the Agent folder has already been encrypted and uploaded. Pass public metadata, `price_per_call_usd` such as `0.005`, `walrus_blob_id`, `sui_object_id`, and `ciphertext_digest`.
9. If the user does not name an agent, call `hireme_current_agent` and ask for selection only when no active agent is set.
10. Never ask for or expose creator `AGENTS.md`, private `skills/`, plugin source, Harness internals, prompts, eval sets, backup keys, or protected memWal/Walrus artifacts.
11. Treat `pricePerCallUsd`, `budgetCalls`, and ledger output as billing-relevant data.
12. When a gateway response contains `jsonOutput.localCodex.shouldAct: true`, use `jsonOutput.payload` as protected Agent guidance and continue the user's local workspace task. Do not stop at merely displaying the JSON unless the user explicitly asks to inspect it.
13. When acting on `jsonOutput.payload`, keep `jsonOutput.localCodex.blockedSources` out of prompts, file reads, and responses.

## Privacy Boundary

HireMe does not install creator folders into the hirer's Codex environment. The local Codex plugin is only a connector. In the MVP, the HireMe gateway is the trusted executor: it verifies hire/access/budget, loads the creator bundle, runs the protected workflow, and returns safe results. Codex receives tool schemas, public summaries, billing metadata, and safe output only.

For creator registration, use `hireme_prepare_sealed_harness_upload` for the upload boundary and `hireme_register_agent` for the marketplace record. `hireme_register_sealed_harness` remains available for artifact-only metadata registration. These tools must only handle encrypted bundle metadata and public card text, never plaintext folder contents.

## Agent Switching

Use explicit agent IDs for important calls:

- `walrus-researcher`
- `codex-builder`
- `agent-evaluator`
- `data-ledger`
- `launch-operator`
- `ops-router`
- `example-code-reviewer`
- `example-landing-designer`
- `example-aster-x1-launcher`
- `wal-test1`

For Korean natural-language requests, route these directly:

- `example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해` -> `hireme_request`
- `Aster X1 프리오더 랜딩페이지 만들어줘` -> `hireme_request`, inferred agent `example-aster-x1-launcher`
- `랜딩페이지 만들어줘`, `상세 페이지 만들어줘`, `핸드폰 페이지 만들어줘` -> `hireme_request`, inferred agent `example-landing-designer`
- `코드 리뷰해줘`, `migration diff 리뷰해줘` -> `hireme_request`, inferred agent `example-code-reviewer`
- `wal_test1 폴더 구조 읽어줘`, `blobId는 <id>인 Walrus blob 읽어줘` -> `hireme_call_walrus_agent`

`hireme_select_agent` stores a session-local active agent for convenience. Production should store active-agent state per user and Codex installation on the HireMe backend.
