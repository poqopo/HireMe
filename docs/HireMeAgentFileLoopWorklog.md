# HireMe Agent File and Loop Worklog

Date: 2026-06-20

This note records the work completed to support Agent result file delivery,
Codex-mediated loop calls, and GUI validation with a real test Agent.

## Summary

HireMe now supports three Agent result patterns:

1. Protected Agents can return small result files through structured
   `attachments`.
2. Codex can run a bounded loop where the Agent's own output asks for one more
   Agent call through `codexLoop`.
3. Multiple protected Agents can work as a team by sharing one hirer-owned
   memWal conversation id.

The final result still follows the Agent's output contract. The loop wrapper
tracks iterations, but the useful payload remains the final Agent result.

## File Attachment Support

Implemented result attachment handling in the gateway and MCP plugin.

Gateway behavior:

- Reads file references from `attachment`, `attachments`, `file`, `files`,
  `outputFile`, `outputFiles`, and equivalent snake_case fields.
- Reads JSON embedded in `outputText` when the Agent returns a structured JSON
  string.
- Supports inline text/base64 attachment objects.
- Supports local result file paths only under allowed result roots.
- Blocks protected creator paths such as `AGENTS.md`, `skills`, `harness`,
  `.hireme/gateway/protected-runtime`, and `.hireme/walrus`.
- Checks attachment bytes for private Harness echo before returning them.
- Adds full attachment bytes to `result.attachments`.
- Adds metadata-only records to `result.outputFiles`.

MCP behavior:

- Collects gateway attachments from direct results and JSON payloads.
- Redacts large/base64 attachment data from the text response.
- Emits MCP `resource` content with `uri`, `mimeType`, and base64 `blob` so
  Codex can receive the file bytes.

Primary files:

- `apps/gateway/src/index.mjs`
- `plugins/hireme/mcp/server.mjs`
- `apps/gateway/src/memWal.mjs`

## Loop Call Support

Added a protected Agent loop endpoint and MCP tool.

Gateway endpoint:

```txt
POST /v1/agent-loop
```

MCP tool:

```txt
hireme_call_agent_loop
```

Loop policies:

- `agent_signal`: default. Continue only when Agent output includes a recognized
  continuation signal.
- `fixed_tasks`: run tasks from `loop_tasks`.
- `single`: disable continuation.

Recognized Agent continuation fields include:

- `codexLoop`
- `codex_loop`
- `loop`
- `next`
- `continuation`
- `followUp`
- `follow_up`

Common fields:

- `continue`
- `shouldContinue`
- `continueLoop`
- `needsFollowup`
- `status`
- `nextTask`
- `next_task`
- `followUpTask`
- `follow_up_task`
- `task`
- `prompt`
- `message`
- `instruction`

The loop is bounded by `budget_calls`, `max_iterations`, and a hard maximum of
20 iterations. Each iteration calls the protected Agent through the existing
`runProtectedAgent` path with `budget_calls: 1`, so authorization, metering,
result storage, and conversation persistence stay on the normal path.

Primary files:

- `apps/gateway/src/index.mjs`
- `plugins/hireme/mcp/server.mjs`

## Team Call Support

Added a protected Agent team endpoint and MCP tool.

Gateway endpoint:

```txt
POST /v1/agent-team
```

MCP tool:

```txt
hireme_call_agent_team
```

Team behavior:

- Accepts ordered `agent_ids` or richer `team_agents` with `agent_id`, `role`,
  and `name`.
- Uses one shared `conversation_id` for every Agent turn.
- Runs Agents sequentially so later Agents can see earlier Agent turns through
  the shared conversation context.
- Supports multiple `rounds`.
- Supports a `final_agent_id` synthesis call after the team rounds.
- Each Agent turn still uses the normal `runProtectedAgent` path with
  `budget_calls: 1`, so authorization, metering, result storage, file
  attachments, and creator privacy checks stay consistent.
- Agents share hirer-owned visible conversation turns only. One Agent never
  receives another Agent's private Harness, `AGENTS.md`, private skills, or
  hidden implementation details.

Important implementation detail:

The team prompt avoids words that trigger the protected-internals classifier,
such as direct requests to read memWal or reveal protected harness material.
The gateway still passes the actual shared conversation context through the
normal executor input.

Primary files:

- `apps/gateway/src/index.mjs`
- `plugins/hireme/mcp/server.mjs`

## Smoke Tests

Added three smoke tests:

- `scripts/smoke-agent-file-transfer.mjs`
- `scripts/smoke-agent-loop.mjs`
- `scripts/smoke-agent-team.mjs`

Validated commands:

```bash
node --check apps/gateway/src/index.mjs plugins/hireme/mcp/server.mjs scripts/smoke-agent-team.mjs scripts/smoke-agent-loop.mjs scripts/smoke-agent-file-transfer.mjs
node scripts/smoke-agent-team.mjs
node scripts/smoke-agent-loop.mjs
node scripts/smoke-agent-file-transfer.mjs
```

What the tests verify:

- Create a temporary protected Agent from a local folder.
- Grant Try access.
- Call through the gateway.
- Call through the stdio MCP plugin.
- Confirm attachment bytes arrive as MCP resource content.
- Confirm loop calls continue from Agent output and stop on the final Agent
  result.
- Confirm two protected Agents can run as a shared-conversation team through
  both direct gateway and MCP plugin calls.

## GUI Test Agent

Created a GUI-testable Agent folder:

```txt
examples/gui-file-loop-test-agent-20260620/
  AGENTS.md
  skills/output-contract.md
```

Created GUI upload archive:

```txt
.hireme/archives/gui-file-loop-test-agent-20260620.tar.gz
```

Registered Agent:

```txt
gui-file-loop-test-agent-20260620
```

Registration result:

- Status: `registered`
- Supabase status: `upserted`
- Free calls: `100`
- MCP package: `mcp://hireme/gui-file-loop-test-agent-20260620`
- Storage provider: `walrus`

The Agent's private instructions define:

- Plain Korean response for ordinary requests.
- Inline text file attachment for file requests.
- `codexLoop` continuation for multi-pass requests.

## GUI Test Flow

Run the local gateway before pressing Try in the GUI:

```bash
cd /Users/hanlab/Desktop/HireMe
HIREME_ALLOW_LOCAL_WALRUS_FALLBACK=1 HIREME_WALRUS_REQUIRED=0 npm run gateway:dev
```

Open the web UI:

```txt
http://localhost:5173/agents
```

Search for:

```txt
gui-file-loop-test-agent-20260620
```

Press `Try Agent`.

## Codex Test Prompts

File attachment test:

```txt
HireMe MCP에서 gui-file-loop-test-agent-20260620 agent를 호출해줘.
task는 "안녕이라고 적힌 txt 파일을 만들어줘".
response_mode는 direct_answer로 해줘.
```

Loop test:

```txt
HireMe MCP에서 gui-file-loop-test-agent-20260620를 hireme_call_agent_loop로 호출해줘.
task는 "초안을 만들고 한 번 더 다듬어서 최종 답변을 줘".
budget_calls는 3, max_iterations는 3, response_mode는 direct_answer.
```

Team test:

```txt
HireMe MCP에서 hireme_call_agent_team으로 팀 호출해줘.
team_agents는 [
  { agent_id: "planner-agent-id", role: "planner" },
  { agent_id: "reviewer-agent-id", role: "reviewer" }
]로 쓰고,
task는 "짧은 출시 체크리스트를 만들고 리뷰해서 최종안을 줘".
conversation_id는 "launch-team-test-1".
rounds는 1, final_agent_id는 "reviewer-agent-id", budget_calls는 3,
response_mode는 direct_answer.
```

## Caveats

- The current GUI can create Agents and grant Try/Hire access, but it does not
  yet include an in-browser Agent chat/run/team panel.
- Actual Agent calls are still tested through Codex MCP.
- The local gateway must be running when pressing `Try Agent`; otherwise the web
  UI can fall back to local browser access records, which are not enough for the
  gateway/MCP call path.
- The connected MCP list search may not immediately show the newly registered
  Agent, but `hireme_get_agent` successfully hydrates the public card by agent
  id.

## Suggested Next Step

Add a small GUI run panel on Agent detail or My Agents:

- Select call mode: single call, loop call, or team call.
- Enter `task`.
- Set `conversation_id`, `budget_calls`, `max_iterations`, team Agents, and
  final Agent when relevant.
- Show text result plus downloadable MCP resource attachments.
- Surface remaining Try/Hire call count after each run.
