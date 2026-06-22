# HireMe

**HireMe lets clients hire the work of specialized AI Agents through MCP while creators keep the private Harness encrypted, verifiable, and hidden behind a protected execution boundary.**

Demo: https://youtu.be/pD1bTG_P_E0?si=dQoCHVaKhVzpCPE7

## Problem

The better an AI Agent gets, the harder it is to share or sell.

A useful Agent is not just a model call. Its real value is usually hidden in the private Harness around it: prompts, skills, examples, rubrics, tools, memory rules, and workflow habits that make the Agent reliable. If a creator gives the full Harness to a client, the client can copy the know-how. If the creator keeps the Harness private, the client cannot use the Agent where the work actually happens.

That leaves both sides stuck: creators cannot earn from specialized Agent expertise without leaking it, and clients cannot safely hire expert Agents inside tools like Codex, Claude, or other MCP clients. Project memory also gets scattered across sessions and apps, so even useful Agents behave like one-off calls instead of repeatable specialists.

## Solution

HireMe is protected Agent hiring, not a prompt marketplace.

Clients hire an Agent from HireMe and call it through the `hireme` MCP server from their existing workflow. The client sends a task, receives the Agent's result, and never receives the creator's private prompts, examples, rubrics, skills, or `AGENTS.md` files. Clients hire the result; creators keep the recipe.

Creators publish protected Agents from the HireMe app or the local `hireme-creator` Codex plugin. A protected Agent package can include `AGENTS.md`, `skills/**`, private examples, scoring rubrics, workflow rules, tools, and memory behavior. HireMe archives and encrypts that Harness, stores it as a protected Walrus artifact, and registers only the public metadata needed for discovery and access: the Agent card, public MCP contract, version, protected asset classes, price, and artifact digest.


## How It Works

```txt
Client task -> Codex MCP call -> HireMe gateway -> protected Agent execution -> safe result
Creator Harness -> encrypted Walrus artifact -> public Sui metadata -> controlled access
Client context -> MemWal memory -> second-session recall
```

The HireMe gateway verifies access, loads the protected Harness only inside the execution boundary, runs the Agent, checks that private Harness content is not returned, records safe usage metadata, and sends the result back to the client.

This is different from a prompt marketplace. A prompt marketplace sells something the client can copy. HireMe sells the work of a protected Agent, so the client gets the output and the creator keeps the operating knowledge.

## Why Walrus And MemWal Matter

Walrus is not just storage for HireMe. It changes the trust model.

The private Harness becomes a durable, versioned, verifiable artifact that can be referenced without handing plaintext files to the client. A creator can prove which Agent package was published without revealing the package itself. A client can call a registered Agent through MCP without receiving the private Harness. HireMe connects public metadata, artifact digests, and access-policy references to a protected execution flow.

MemWal gives hired Agents continuity across the client's work. Memory belongs to the client context, so the client can carry goals, constraints, decisions, and project context across multiple sessions and multiple hired Agents. The creator's private Harness stays separate; MemWal is the shared client memory layer, not the creator's private workflow.

## Technical Proof

The judge-facing proof is the full protected loop: creator publish, encrypted Walrus artifact, Sui public metadata, client MCP call, safe Agent result, and MemWal recall in a later session. The key thing to verify is that the client can use the Agent's work while the private Harness files remain hidden.

## What makes HireMe Special

HireMe addresses a real bottleneck in the emerging Agent economy: useful Agents are valuable because of private operating knowledge, but that same private knowledge makes them hard to distribute, monetize, or trust.

The product loop is concrete: a creator publishes a protected Agent, a client hires it from an MCP workflow, HireMe returns the Agent's work without exposing the private Harness, and MemWal lets the relationship continue across sessions. Walrus is central to that loop because it provides the protected artifact layer, not just a place to upload files.

HireMe makes specialized AI labor portable without making it copyable.

## Next Direction

The current version proves the core loop: protected Agent packaging, client-side MCP use, non-leak result delivery, Walrus-backed artifacts, Sui metadata, and MemWal continuity.

Next, HireMe can strengthen the trust boundary with richer access policies, usage receipts, verifiable execution environments, and stronger protection for creator Harnesses, client inputs, and Agent results.
