# HireMe MCP Split Notes

## What changed

HireMe now uses two MCP surfaces instead of one mixed surface.

| Surface | Name | Transport | Job |
| --- | --- | --- | --- |
| User / hirer MCP | `hireme` | Streamable HTTP + OAuth | List Try/Hire access, call hired Agents, manage payments, and read usage through the Render gateway. |
| Creator MCP | `hireme-creator` | Local stdio Codex plugin | Create local Agent templates, archive local Harness folders, and publish or update protected Agents. |

The split exists because HTTP MCP runs on the remote gateway and cannot see a user's local Codex workspace. Local template creation and folder upload must happen in the local stdio plugin. Agent calls and entitlement checks should stay on the OAuth HTTP MCP server.

## Public website setup

Users coming from the website should use the Render gateway, not localhost.

```bash
# Install the HireMe Creator plugin
codex plugin marketplace add poqopo/HireMe --ref main
codex plugin add hireme-creator --marketplace hireme-local

# Connect the hired-Agent MCP server to the Render gateway
codex mcp remove hireme || true
codex mcp add hireme --url https://hireme-gateway.onrender.com/mcp --oauth-resource https://hireme-gateway.onrender.com/mcp
codex mcp login --scopes hireme:agents,hireme:call,hireme:manage hireme
```

After restarting Codex, users can ask:

```txt
Create a HireMe Agent template for a code-review Agent.
```

## Creator flow

1. `hireme-creator` creates a local folder with `AGENTS.md`, `public.json`, `skills/`, `harness/policy.json`, and examples.
2. The creator edits the local folder.
3. `hireme-creator` archives the folder and sends it to the gateway.
4. The gateway encrypts the archive, stores protected artifact references, and registers the public Agent card.

## Hirer flow

1. The user installs or logs in to the HTTP MCP server named `hireme`.
2. `hireme_list_my_agents` shows Try/Hire access and remaining usage.
3. `hireme_call_agent` calls a hired Agent through the protected gateway.
4. Private creator files never go to the hirer's Codex workspace.

## Files touched

- `plugins/hireme/.mcp.json`: renamed the local plugin MCP server to `hireme-creator` and pinned the Render gateway URL.
- `plugins/hireme/mcp/server.mjs`: added creator profile filtering and Render gateway defaults.
- `apps/gateway/src/index.mjs`: kept HTTP MCP user-focused and routes local folder requests to creator plugin guidance.
- `README.md` and `/docs`: updated setup commands and the two-surface explanation.
- Landing page: added a copyable one-time Codex setup block under "Start with a template".
