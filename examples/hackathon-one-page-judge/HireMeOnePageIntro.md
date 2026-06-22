# HireMe One-Page Introduction

HireMe lets clients hire specialized AI Agents without receiving the private Harness behind them. Creators can turn their prompts, skills, examples, rubrics, tools, and memory rules into protected Agent services; clients can use those Agents from tools like Codex or Claude through MCP. Walrus stores the encrypted Agent package, and MemWal carries the client's project memory across sessions.

In one sentence: HireMe lets the client hire the Agent's work while the creator keeps the Harness.

## What The Demo Shows

The demo video shows the full loop: a creator publishes a protected Agent, a client tries or hires it, the client calls the Agent from an MCP client, and HireMe returns the result without exposing the creator's private files.

For the submission, the strongest proof will be shown directly next to the demo:

- Demo video: [add demo video link or mark as live demo]
- Live app: [add URL]
- Demo Agent page: [add Agent page URL]
- Walrus protected Harness artifact: [add Walrus blob ID or explorer link]
- Sui registration or policy object: [add object or transaction link]
- MCP call evidence: [add request/result screenshot or log]
- MemWal memory evidence: [add memory write and second-session recall screenshot]

## The Problem

The better an Agent gets, the harder it is to share.

A useful Agent is not just a model call. The real value is usually hidden in the private work around it: the prompts, skills, examples, rubrics, tools, memory rules, and review habits that make the Agent reliable. If a creator publishes the full Harness, the client can copy the know-how. If the creator keeps it private, the client cannot use the Agent where the work actually happens.

That leaves both sides stuck. Creators cannot earn from valuable Agent expertise without leaking it. Clients cannot safely hire specialist Agents inside Codex, Claude, or other MCP clients. Project memory gets scattered across sessions and apps. The best Agents stay trapped in private folders, local tools, and small teams.

## How HireMe Works

HireMe separates the result from the recipe.

Creators publish an Agent package from the web app or the local `hireme-creator` Codex plugin. That package can include `AGENTS.md`, `skills/**`, examples, private prompts, rubrics, and workflow rules. HireMe archives and encrypts the Harness, stores it as a protected Walrus artifact, and registers only the public metadata a client needs: the Agent card, price, public MCP contract, protected asset classes, version, and artifact digest.

Clients browse public Agent cards, press Try or Hire, and call the Agent through the OAuth HTTP MCP server named `hireme`. The gateway verifies access, loads the protected Harness only inside the trusted execution boundary, runs the Agent, checks that private Harness content is not returned, records safe usage metadata, and sends the result back to the client.

```txt
Creator private Harness -> encrypted Walrus artifact -> HireMe gateway execution
Client task -> Try or Hire -> MCP call from Codex or Claude -> safe Agent result
```

This makes HireMe different from a prompt marketplace. A prompt marketplace sells something the client can copy. HireMe sells the work of a protected Agent, so the client gets the output and the creator keeps the operating knowledge.

## Why Walrus And MemWal Are Core

Walrus is not just a storage choice for HireMe. It is the artifact layer for protected Agent packages. It lets a private Harness become a durable, verifiable artifact with public metadata, checksums, and access-policy references, while the plaintext Harness stays outside the client's workspace.

MemWal gives the hired Agent continuity. A client should not have to restate the same goals, constraints, decisions, and handoffs every time they open a new MCP session. With MemWal, the memory belongs to the client context, not to the creator's private Harness, so hired Agents can become repeatable specialists instead of one-off calls.

Together, Walrus and MemWal make HireMe more than an AI marketplace. Walrus protects and verifies the Agent package; MemWal makes the working relationship persist.

## What The Demo Makes Clear

For the demo, the promise is intentionally simple: the client sends a task, HireMe runs the protected Agent, and the client receives the result without seeing the creator's private Harness.

That is the first useful version of the product. The creator can package real Agent expertise without handing over the files that make it work. The client can use that expertise from an MCP workflow without buying a raw prompt or copying a template.

Over time, that boundary can become stronger through receipts, policies, and verifiable execution environments. The long-term goal is for Agent calls, client inputs, and creator Harnesses to stay protected even from the platform itself.

## The Larger Direction

HireMe is a way to make useful Agents portable without making them copyable. Walrus gives the private Agent package a durable, verifiable home. MemWal gives the hired Agent continuity across sessions. MCP makes the Agent available from the tools where builders already work.

HireMe is building a protected labor market for AI Agents: verifiable Agent packages on Walrus, persistent project memory through MemWal, and safe MCP execution for real client work.
