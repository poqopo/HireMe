---
name: hireme
description: Use HireMe to list hired protected AI agents, switch the active agent, inspect pricing and platform-managed Walrus policy, and call agents through MCP from Codex.
---

# HireMe

Use this skill when the user wants to work with HireMe protected AI agents from Codex.

## Workflow

1. Call `hireme_whoami` when the user asks who they are signed in as, which HireMe account Codex is using, or whether OAuth/gateway identity is connected.
2. If the user gives a plain natural-language delegation, call `hireme_request` with the full request text. Example: `launch-operator에게 제품 출시 페이지 방향을 잡아달라고 해`.
3. Call `hireme_list_my_agents` when the user asks which agents they can currently use. This reads Try/Hire entitlements from the gateway.
4. Call `hireme_list_hired_agents` when the user asks what agents are available in the marketplace.
5. If the user explicitly asks to switch active agents, call `hireme_select_agent` with that `agent_id`.
6. For structured execution, prefer `hireme_call_agent` with an explicit `agent_id` when the user names one.
7. For the plaintext Walrus storage demo, call `hireme_call_walrus_agent` with `agent_id: "wal-test1"` or a direct `blob_id`.
8. If the user wants to start building a new creator Agent template, call `hireme_create_agent_template`. Natural requests like `나 에이전트 만들건데 템플릿 만들어줘` may be routed through `hireme_request`, which should create the same template.
9. If the user wants to publish/register a working Agent, call `hireme_create_agent_from_folder` when they have a local folder, or `hireme_register_agent` after the Agent folder has already been encrypted and uploaded. Pass public metadata, `price_per_1m_tokens_sui` such as `5`, `walrus_blob_id`, `sui_object_id`, and `ciphertext_digest`.
10. If the user does not name an agent, call `hireme_current_agent` and ask for selection only when no active agent is set.
11. Never ask for or expose creator `AGENTS.md`, private `skills/`, plugin source, Harness internals, prompts, eval sets, backup keys, or protected memWal/Walrus artifacts.
12. Treat `pricePer1MTokensSui`, `budgetCalls`, and ledger output as billing-relevant data.
13. When a gateway response contains `jsonOutput.localCodex.shouldAct: true`, use `jsonOutput.payload.outputText` when present as the protected Agent's local Codex execution brief. Execute its plan in the user's workspace, then run its verification flow before reporting completion. Do not stop at merely displaying the JSON unless the user explicitly asks to inspect it.
14. When acting on `jsonOutput.payload.outputText` or `jsonOutput.payload`, keep `jsonOutput.localCodex.blockedSources` out of prompts, file reads, and responses.

## Privacy Boundary

HireMe does not install creator folders into the hirer's Codex environment. The local Codex plugin is only a connector. In the MVP, the HireMe gateway is the trusted executor: it verifies hire/access/budget, loads the creator bundle, runs the protected workflow, and returns safe results. Codex receives tool schemas, public summaries, billing metadata, and safe output only.

For creator registration, use `hireme_prepare_platform_encryption_upload` for the upload boundary and `hireme_register_agent` for the marketplace record. `hireme_register_platform_encrypted_harness` remains available for artifact-only metadata registration. Legacy sealed-harness tool names are aliases only. These tools must only handle encrypted bundle metadata and public card text, never plaintext folder contents.

## Agent Switching

Use explicit agent IDs for important calls:

- `walrus-researcher`
- `codex-builder`
- `agent-evaluator`
- `data-ledger`
- `launch-operator`
- `ops-router`
- `wal-test1`

For Korean natural-language requests, route these directly:

- `launch-operator에게 제품 출시 페이지 방향을 잡아달라고 해` -> `hireme_request`
- `Aster X1 프리오더 랜딩페이지 방향 잡아줘` -> `hireme_request`, inferred agent `launch-operator`
- `랜딩페이지 만들어줘`, `상세 페이지 만들어줘`, `핸드폰 페이지 만들어줘` -> `hireme_request`, inferred agent `launch-operator`
- `코드 리뷰해줘`, `migration diff 리뷰해줘` -> `hireme_request`, inferred agent `codex-builder`
- `wal_test1 폴더 구조 읽어줘`, `blobId는 <id>인 Walrus blob 읽어줘` -> `hireme_call_walrus_agent`
- `나 에이전트 만들건데 템플릿 만들어줘`, `새 Agent template 만들어줘` -> `hireme_create_agent_template` or `hireme_request`

`hireme_select_agent` stores a session-local active agent for convenience. Production should store active-agent state per user and Codex installation on the HireMe backend.
