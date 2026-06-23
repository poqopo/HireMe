# HireMe

**Protected Agent hiring for MCP-native work, powered by Walrus and MemWal.**

HireMe lets clients hire specialized AI Agents without receiving the private Harness behind them. Creators can turn prompts, skills, rubrics, examples, tool habits, and memory rules into paid Agent services. Clients can use those Agents from the web or from MCP clients such as Codex, while Walrus stores protected Agent packages and MemWal carries project memory across sessions.

## Submission Snapshot

| Item | Value |
| --- | --- |
| Track | Sui Overflow 2026 - Walrus Track |
| Live web app | https://hire-me-bice.vercel.app |
| MCP gateway | https://hireme-gateway.onrender.com/mcp |
| Sui network | Testnet |
| Move package | `0x7498f3ee9ce9c8ddf3a4390bb0e86565608c3baea9273194c0d96ef7b1cdd1d9` |
| Primary demo Agent | `dokpami-maker` |
| Research demo Agent | `hackathon-one-page-judge` |

## Problem

The better an Agent gets, the harder it is to share.

A useful Agent is not just a model call. Its value usually lives in the private work around it: prompts, skills, examples, rubrics, tools, memory rules, and execution habits. If a creator publishes the full Harness, clients can copy the know-how that makes the Agent valuable. If the creator keeps the Harness private, clients cannot use the Agent where they actually work.

Clients also lose context across tools and sessions. A hired Agent should not start from zero every time the client returns with the same project.

## Solution

HireMe separates the Agent result from the private recipe.

1. A creator publishes a protected Agent folder containing private Harness files such as `AGENTS.md`, `skills/**`, examples, and workflow rules.
2. HireMe archives and encrypts the Agent package.
3. The encrypted artifact is stored on Walrus.
4. Public metadata, pricing, artifact digests, and Sui/Walrus references are registered for discovery.
5. A client can Try or Hire the Agent from the web.
6. The client calls the Agent through the HireMe MCP gateway.
7. The gateway verifies access, runs the protected Harness inside the execution boundary, and returns only the safe result.
8. MemWal stores and recalls client-owned conversation memory so the same Agent, or another hired Agent, can continue the work later.

```text
Creator private Harness
  -> encrypted Walrus artifact
  -> HireMe gateway execution
  -> safe Agent result

Client MCP conversation
  -> MemWal remember
  -> later MemWal recall
  -> context-aware follow-up result
```

## Why Walrus And MemWal Are Core

HireMe is not using Walrus as decorative storage. Walrus is the artifact layer for protected Agent packages. It gives the Agent Harness a durable, verifiable home while keeping plaintext private files out of the client's workspace.

MemWal turns Agent hiring into a continuing working relationship. The client can start a conversation, call an Agent, come back in a later MCP session, and have the Agent recall project context without restating everything.

Together:

- **Walrus** protects and verifies the Agent package.
- **MemWal** makes project context persistent across MCP sessions and Agents.
- **MCP** makes hired Agents available inside the tools where builders already work.
- **Sui** provides the testnet package and policy surface for verifiable access and future stronger execution boundaries.

## What The Demo Shows

### 1. Hire A Specialized Agent

The client opens HireMe, selects `dokpami-maker`, and receives a specialized character result. The client gets the output, not the private Harness.

This is the first product proof: HireMe is not a prompt marketplace. The creator keeps the private workflow, and the client hires the result.

### 2. Verify The Protected Artifact

The `dokpami-maker` protected package is mirrored as a public artifact reference:

| Artifact | Value |
| --- | --- |
| Walrus blob ID | `e-AiHDAX2qyH4jUMfsRjKaNvGx-6euUh205VWczoqo8` |
| Sui object ID | `0xf41495316fc3094b89ffff216721c19ea71de5d769958e8b9a9f139c8c12a37a` |
| Archive digest | `sha256:a72c2af0ba82804029a8f821deca34ca2629c221e2003e18368b9781c62a1601` |
| Archive format | `zip` |
| Network | Walrus testnet |

The web app also shows artifact links from the Agent detail page so judges can inspect the public proof without receiving the protected Harness.

### 3. Use The Same Agent Through MCP

The client connects the `hireme` MCP server and calls a hired Agent from Codex:

```bash
codex mcp add hireme \
  --url https://hireme-gateway.onrender.com/mcp \
  --oauth-resource https://hireme-gateway.onrender.com/mcp

codex mcp login --scopes hireme:agents,hireme:call,hireme:manage hireme
```

Example MCP flow:

```text
hireme_list_my_agents
hireme_start_conversation(conversation_id: "dokpami-demo")
hireme_call_agent(agent_id: "dokpami-maker", conversation_id: "dokpami-demo", task: "Create a Dokpami character variation.")
hireme_resume_conversation(conversation_id: "dokpami-demo")
hireme_call_agent(agent_id: "dokpami-maker", conversation_id: "dokpami-demo", task: "Use the character from earlier and make a magical library scene.")
```

The important proof is that the second call can load prior context through MemWal:

```json
{
  "mcpConversation": {
    "stored": true,
    "provider": "memwal-sdk",
    "conversationId": "dokpami-demo",
    "previousTurnsLoaded": 1
  }
}
```

### 4. Publish A Research Agent

The repository also includes `examples/hackathon-one-page-judge`, a protected Research Agent that can:

- accept a DeepSurge project URL or project name,
- extract a normalized one-page description,
- score the project against Sui Overflow criteria,
- apply track-specific judging skills,
- compare against public prior-winner patterns,
- produce concrete fixes for the one-pager and demo.

This second Agent demonstrates that HireMe can publish knowledge-heavy Agents whose private judging rubric and research skills remain protected.

## Technical Architecture

| Layer | Role |
| --- | --- |
| `apps/web` | React/Vite web app for landing, Agent discovery, Try/Hire, creation, and result display |
| `apps/gateway` | HTTP + MCP gateway for OAuth, entitlement checks, Agent calls, Walrus, MemWal, and ledger writes |
| `plugins/hireme` | Codex plugin/MCP client surface for creator and hirer workflows |
| `examples/*` | Protected Agent folders used for demo publishing |
| `move/hireme` | Sui Move package for the access-policy surface |
| `supabase` | Database migrations for profiles, Agents, artifacts, hires, ledger, and public registry views |
| `scripts` | Smoke tests, package publish helpers, Walrus artifact helpers, and plugin export scripts |

## Sui Move Package

The current Sui testnet package is:

```text
0x7498f3ee9ce9c8ddf3a4390bb0e86565608c3baea9273194c0d96ef7b1cdd1d9
```

Useful target:

```text
0x7498f3ee9ce9c8ddf3a4390bb0e86565608c3baea9273194c0d96ef7b1cdd1d9::access::seal_approve
```

The package metadata is stored in `move/hireme/Published.toml`.

## MemWal Integration

HireMe uses the MemWal SDK through `apps/gateway/src/memWalSdk.mjs`.

The gateway stores MCP conversation turns with:

- `createMcpConversationSession`
- `appendMcpConversationTurn`
- `readMcpConversationSession`
- `listMcpConversationSessions`

The demo evidence to look for is:

- first call: `mcpConversation.stored: true`
- first call: `mcpConversation.waitForStore: true`
- later call: `previousTurnsLoaded > 0`
- same `conversation_id`
- MemWal namespace and job/blob metadata
- result that uses earlier project context without the client repeating the full prompt

## Privacy Boundary

The MVP uses a trusted gateway execution boundary.

The client never receives:

- raw `AGENTS.md`
- private `skills/**`
- private prompts
- hidden rubrics
- workflow examples
- creator-only Harness files

The client receives:

- the Agent result,
- safe summaries,
- artifact digests,
- usage metadata,
- public Walrus/Sui references.

This is the current practical boundary. The long-term direction is stronger cryptographic and policy-based execution, where access receipts, Seal-style policies, and verifiable execution reduce trust in the platform.

## Run Locally

Requirements:

- Node.js 24+
- npm
- Supabase project credentials for live data
- Walrus and Sui testnet credentials for artifact publishing
- MemWal account and delegate/private key for memory demo

Install:

```bash
npm install
```

Run the web app:

```bash
npm run web:dev
```

Run the gateway:

```bash
npm run gateway:dev
```

Build and validate:

```bash
npm run deploy:check
```

Build only the web app:

```bash
npm run web:build
```

## Important Environment Variables

Browser-facing variables use the `VITE_` prefix. Server secrets must not use `VITE_`.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Web | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Web | Supabase anon key |
| `VITE_HIREME_GATEWAY_URL` | Web | Gateway URL for web calls |
| `SUPABASE_URL` | Gateway | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Gateway | Service role key for server writes |
| `HIREME_PLATFORM_KMS_KEY` | Gateway | Platform-managed encryption root secret |
| `WALRUS_NETWORK` | Gateway | Walrus network, currently `testnet` |
| `WALRUS_UPLOAD_RELAY_URL` | Gateway | Walrus upload relay |
| `HIREME_WALRUS_PAYER_PRIVATE_KEY` | Gateway | Payer key for Walrus uploads |
| `MEMWAL_PRIVATE_KEY` | Gateway | MemWal delegate/private key |
| `MEMWAL_ACCOUNT_ID` | Gateway | MemWal account ID |
| `MEMWAL_SERVER_URL` | Gateway | MemWal relayer URL |
| `HIREME_SAVE_LOCAL_AGENT_RESULTS` | Gateway | Optional default for saving returned Agent results under `.hireme/gateway/results` |
| `HIREME_LLM_PROVIDER` | Gateway | LLM execution provider, currently `ollama` for text execution |
| `OLLAMA_BASE_URL` | Gateway | Ollama base URL, e.g. `https://ollama.com` |
| `OLLAMA_API_KEY` | Gateway | Ollama API key for Agent execution |
| `OLLAMA_MODEL` | Gateway | Ollama model name, e.g. `gemma4:31b-cloud` |
| `HIREME_IMAGE_GENERATION_PROVIDER` | Gateway | Protected Harness image provider, default `openai` |
| `OPENAI_API_KEY` | Gateway | OpenAI key used for protected Harness image-category generation |
| `HIREME_SEAL_PACKAGE_ID` | Gateway | Sui package ID for policy metadata |

See `.env.example`, `apps/gateway/.env.example`, and `render.yaml` for deployment-oriented configuration.

## Repository Highlights

```text
apps/web/                         Web app
apps/gateway/                     Protected gateway and MCP server
plugins/hireme/                   Codex MCP plugin
examples/hackathon-one-page-judge/ Research Agent Harness
examples/dokpami-create-agent.zip Demo Agent archive
move/hireme/                      Sui Move package
supabase/migrations/              Database schema and public views
docs/                             Demo flow and product notes
```

## Why This Fits The Walrus Track

The Walrus Track asks for agentic workflows where data, files, or memory are persistent, portable, and not locked into one app.

HireMe fits because:

- protected Agent packages are durable Walrus artifacts,
- public metadata can expose proof without revealing creator know-how,
- MemWal makes hired Agent sessions recallable across MCP sessions,
- MCP makes those Agents usable from existing developer tools,
- the product loop depends on protected storage and memory, not just on a storage checkbox.

## Current Limitations

- The MVP gateway is a trusted executor.
- The current demo runs on testnet infrastructure.
- Payment and settlement flows are demo-grade and should not be treated as production financial infrastructure.
- The strongest demo requires live MemWal credentials and a working MCP login session.
- Future work should reduce trust in the gateway with stronger policy-based and verifiable execution boundaries.

## One-Sentence Pitch

**HireMe lets clients hire specialized AI Agents while creators keep their private Harness protected, with Walrus storing durable Agent packages and MemWal remembering project context across sessions.**
