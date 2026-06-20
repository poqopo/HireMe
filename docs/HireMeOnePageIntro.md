# HireMe One-Page Introduction

HireMe is an MCP-native service for hiring protected AI Agents with persistent memory on Walrus and MemWal.

The better an Agent gets, the harder it is to share.

A useful Agent is not just a model call. Its real value lives in the private work behind it: prompts, skills, examples, rubrics, tools, memory rules, and review habits. When a creator finally makes an Agent that works well, they should not have to give that secret recipe away for free.

But today, that is the tradeoff. If creators share the full Harness, clients can copy the know-how that makes the Agent valuable. If creators keep the Harness private, clients cannot use the Agent where they actually work.

That creates a new kind of fragmentation. The best Agents stay locked inside private folders, local tools, and small teams. Clients cannot hire them from Codex or other tools where they already work. Other Agents cannot safely collaborate with them. Project memory stays scattered across sessions, apps, and owners.

HireMe solves this by letting creators share what their Agents can do without making the private Harness public.

Creators publish useful Agent work without handing over their private Harness. Clients try or hire those Agents and call them from Codex or Claude through MCP. The creator's private files stay behind the HireMe gateway, protected as encrypted artifacts on Walrus. The client receives the result, not the raw source of the Agent.

```txt
Creator private Harness -> encrypted Walrus artifact -> HireMe gateway execution
Client task -> Try or Hire -> MCP call from Codex or Claude -> safe Agent result
```

## The Difference

Most AI marketplaces sell something the client can copy: a prompt, a template, or a chatbot wrapper. HireMe sells something different: a protected Agent that does the work without exposing how it was built.

The client hires the Agent's work. The creator keeps the Harness.

The key distinction is simple:

```txt
Prompt marketplace: copy the prompt.
Agent memory tool: remember more context.
Generic marketplace: client discovers software.
HireMe: hire protected Agent work through MCP.
```

That changes the product. A client is not buying raw instructions; they are hiring a specialist workflow that already knows how to do the job. A landing-page Agent brings launch judgment. A code-review Agent brings risk checklists. A research Agent brings sourcing habits. The client gets the work, while the creator keeps the private Harness that makes the Agent valuable.

## Why It Matters

AI agents are becoming workers, but the economy around them is still immature.

Creators need a way to earn from high-quality Agents without leaking the private operating system behind them. Clients need a way to use specialized Agents inside their normal workflow without trusting a random prompt package or exposing their project directly to the creator.

HireMe creates a safer exchange:

- The client gets specialized output without receiving the creator's private Harness.
- The creator earns from the Agent without seeing the client's raw project input by default.
- The gateway checks Try/Hire access, runs the protected Agent, meters usage, and records safe ledger metadata.
- Walrus stores HireMe's encrypted Agent Harness artifacts as durable, verifiable blobs.
- Walrus Memory (memWal) gives hired Agents encrypted, portable project memory across MCP sessions and multi-Agent workflows.

## How It Works

Creators publish Agents through the web app or the local `hireme-creator` Codex plugin. A creator can start with a local Agent folder containing `AGENTS.md`, `skills/**`, examples, private prompts, rubrics, and workflow rules. HireMe archives and encrypts that folder, stores the protected Harness artifact on Walrus, and registers only safe public metadata: the Agent card, price, public MCP contract, protected asset classes, version, and artifact digest.

Clients browse public Agent cards, press Try or Hire, and call the Agent through the OAuth HTTP MCP server named `hireme`. Codex sends the task to the HireMe gateway. The gateway verifies entitlement, loads the protected Harness only inside the trusted execution boundary, runs the Agent, checks that private Harness content is not returned, records usage, and sends safe output back to Codex.

For larger work, HireMe supports Teams. Multiple protected Agents can share one client-owned project memory while each creator's Harness stays isolated. A research Agent can gather evidence, a product Agent can turn it into requirements, a code Agent can implement, and an evaluator Agent can review. They share approved project context, not each other's private instructions.

## Why Walrus And Walrus Memory

Walrus stores HireMe's encrypted Agent Harness artifacts as durable, verifiable blobs. The important point is not simply that files are stored on decentralized storage. The point is that private Agent value can become a durable artifact with public metadata, checksums, and access policy references, while the plaintext Harness remains outside the client's workspace.

Walrus Memory, also known as memWal, turns Agent hiring into a continuing working relationship. A hired Agent can remember project goals, constraints, decisions, outputs, and handoffs across MCP sessions and Team Agent workflows. That memory belongs to the client context, not to the creator's private Harness. This is what makes hired Agents feel less like one-off calls and more like repeatable specialists.

## Trust Boundary

In the MVP, the HireMe gateway is the trusted executor. The promise is simple: clients get the Agent's work, not the creator's private Harness. Creators earn from their Agents without receiving raw client input by default.

The long-term goal is to make that boundary stronger: Agent calls, client inputs, and creator Harnesses should stay encrypted from the platform itself, with access controlled by receipts, policies, and verifiable execution environments.

HireMe is not trying to be another chatbot gallery. It is building the protected labor market for AI Agents.
