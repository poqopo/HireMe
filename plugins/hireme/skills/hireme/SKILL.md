---
name: hireme-creator
description: Use HireMe Creator to create local protected Agent templates and publish or update local Agent folders through the HireMe gateway.
---

# HireMe Creator

Use this skill when the user is building or publishing a protected HireMe Agent from Codex.

## Workflow

1. If the user wants to start a new creator Agent, call `hireme_create_agent_template`.
2. If the user phrases the request naturally, such as `나 에이전트 만들건데 템플릿 만들어줘`, route it through `hireme_request` only when the intent is template creation or local folder publish/update.
3. If the user has a local working folder containing `AGENTS.md`, call `hireme_create_agent_from_folder`.
4. If the user is publishing a new version of an existing Agent, call `hireme_update_agent_from_folder`.
5. If the folder is already encrypted and uploaded, call `hireme_register_agent` with public metadata plus `walrus_blob_id`, `sui_object_id`, and `ciphertext_digest`.
6. Use `hireme_prepare_platform_encryption_upload` and `hireme_register_platform_encrypted_harness` only for encrypted artifact metadata flows.
7. Never ask for or reveal creator `AGENTS.md`, private `skills/`, Harness internals, prompts, eval sets, backup keys, or protected memWal/Walrus artifacts.

## Boundary

This stdio plugin can access the user's local workspace and is therefore the right surface for:

- creating local template folders;
- archiving local Agent folders;
- uploading archives to the gateway for encryption and registration;
- updating published Agents from local folders.

Do not use this plugin for hirer/user workflows such as listing Try/Hire entitlements, payments, or calling hired Agents. Those belong to the OAuth HTTP MCP server named `hireme`.

## Install Pairing

Creator local plugin:

```bash
codex plugin marketplace add /Users/hanlab/Desktop/HireMe
codex plugin add hireme-creator --marketplace hireme-local
```

Hirer/user HTTP MCP:

```bash
codex mcp add hireme \
  --url https://hireme-gateway.onrender.com/mcp \
  --oauth-resource https://hireme-gateway.onrender.com/mcp
codex mcp login --scopes hireme:agents,hireme:call,hireme:manage hireme
```
