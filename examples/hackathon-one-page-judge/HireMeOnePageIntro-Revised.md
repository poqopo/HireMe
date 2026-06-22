# HireMe One-Page Introduction

HireMe lets clients hire specialized AI Agents without receiving the private Harness behind them. Creators can turn their prompts, skills, examples, rubrics, tools, and memory rules into protected Agent services; clients can use those Agents from tools like Codex or Claude through MCP. Walrus stores the encrypted Agent package, and MemWal carries the client's project memory across sessions.

In the demo, a private hackathon-judge Agent reviews a client's one-pager from Codex while its rubric, examples, and private scoring rules remain hidden.

In one sentence: HireMe lets the client hire the Agent's work while the creator keeps the Harness.

## What The Demo Shows

The demo starts from the client side: a user calls a private hackathon-judge Agent from Codex, gets a useful review, and confirms that the Agent's private rubric, examples, and skills were never exposed. Then HireMe shows how that Agent was published as an encrypted Walrus artifact and registered with public Sui metadata.

The full loop is:

- A client opens Codex, calls the Agent through the `hireme` MCP server, and submits a one-page project description for review.
- HireMe verifies access, runs the Agent behind the gateway, returns the review, and does not expose the creator's private prompts, rubrics, examples, or skills.
- The demo shows the non-leak proof: the client receives the Agent's work, not the private Harness.
- Then the creator side is shown: a creator publishes the protected hackathon-judge Agent from HireMe.
- HireMe packages the private Harness, encrypts it, stores it on Walrus, and registers public metadata on Sui.
- MemWal writes the client's project context and recalls it in a second session.

## Technical Proof

| Proof artifact | What judges can verify | Submission link or evidence |
| --- | --- | --- |
| Demo video or live demo | End-to-end client call, protected result, and creator publish flow | [add demo video link or mark as live demo] |
| Live app | Public Agent card, Try/Hire flow, and client-facing result | [add URL] |
| MCP call evidence | Codex or Claude request to the `hireme` MCP server and returned result | [add request/result screenshot or log] |
| Private Harness non-leak check | Result includes the Agent's work but not private prompts, rubrics, examples, or skills | [add redaction test screenshot or gateway log] |
| Walrus protected Harness artifact | Encrypted Agent package, version, digest, and artifact reference | [add Walrus blob ID or explorer link] |
| Sui registration or policy object | Public Agent metadata, access reference, and transaction/object proof | [add object or transaction link] |
| MemWal memory evidence | Memory write in one session and recall in a second session | [add memory write and recall screenshot] |

## The Problem

The better an Agent gets, the harder it is to share.

A useful Agent is not just a model call. The real value is usually hidden in the private work around it: prompts, skills, examples, rubrics, tools, memory rules, and review habits that make the Agent reliable. If a creator publishes the full Harness, the client can copy the know-how. If the creator keeps it private, the client cannot use the Agent where the work actually happens.

That leaves both sides stuck. Creators cannot earn from valuable Agent expertise without leaking it. Clients cannot safely hire specialist Agents inside Codex, Claude, or other MCP clients. Project memory gets scattered across sessions and apps. The best Agents stay trapped in private folders, local tools, and small teams.

## How HireMe Works

HireMe separates the result from the recipe.

Creators publish an Agent package from the web app or the local `hireme-creator` Codex plugin. That package can include `AGENTS.md`, `skills/**`, examples, private prompts, rubrics, and workflow rules. HireMe archives and encrypts the Harness, stores it as a protected Walrus artifact, and registers only the public metadata a client needs: the Agent card, price, public MCP contract, protected asset classes, version, and artifact digest.

Clients browse public Agent cards, press Try or Hire, and call the Agent through the OAuth HTTP MCP server named `hireme`. The gateway verifies access, loads the protected Harness only inside the execution boundary, runs the Agent, checks that private Harness content is not returned, records safe usage metadata, and sends the result back to the client.

```txt
Creator private Harness -> encrypted Walrus artifact -> HireMe gateway execution
Client task -> Try or Hire -> MCP call from Codex or Claude -> safe Agent result
```

This makes HireMe different from a prompt marketplace. A prompt marketplace sells something the client can copy. HireMe sells the work of a protected Agent, so the client gets the output and the creator keeps the operating knowledge.

## Why Walrus Changes The Trust Model

Walrus is not just storage for HireMe. It turns the private Harness into a durable, versioned, verifiable artifact that can be referenced without handing plaintext files to the client.

That changes the trust model in three ways:

- The creator can prove which Agent package was published without revealing the package.
- The client can call a registered Agent through MCP without receiving the private Harness.
- HireMe can connect public metadata, artifact digests, and access-policy references to a protected execution flow.

The important point is not "decentralized storage" by itself. The important point is controlled disclosure: Walrus lets HireMe expose enough proof for trust while keeping the creator's operating knowledge private.

## Why MemWal Is Core

MemWal gives the hired Agent continuity. A client should not have to restate the same goals, constraints, decisions, and handoffs every time they open a new MCP session. With MemWal, the memory belongs to the client context, not to the creator's private Harness, so hired Agents can become repeatable specialists instead of one-off calls.

In the demo, the Agent first reviews the client's one-pager, writes the project context to memory, and then uses that memory in a second session to refine follow-up advice without exposing the creator's private scoring rules.

## Current Demo Promise And Direction

The first useful version of HireMe is intentionally simple: the client sends a task, HireMe runs the protected Agent, and the client receives the result without seeing the creator's private Harness.

That is enough to prove the core product loop. The creator can package real Agent expertise without handing over the files that make it work. The client can use that expertise from an MCP workflow without buying a raw prompt or copying a template. Walrus gives the private Agent package a durable, verifiable home; MemWal gives the hired Agent continuity across sessions; MCP makes the Agent available from the tools where builders already work.

Over time, HireMe can strengthen this boundary with richer receipts, access policies, and verifiable execution environments. The long-term goal is a protected labor market for AI Agents: verifiable Agent packages on Walrus, persistent project memory through MemWal, and safe MCP execution for real client work.
