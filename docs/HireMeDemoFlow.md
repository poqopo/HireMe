# HireMe Demo Flow

## Goal

Create a five-minute demo that clearly shows HireMe as a hiring platform for protected AI Agents, aligned with the Walrus and MemWal track.

Core message:

> HireMe is a hiring platform for protected AI Agents. Clients can try and hire specialized agents, creators can earn from their best agents without giving away the private workflow that makes them valuable, and Walrus plus MemWal make protected agent packages safe, verifiable, and memorable across sessions and agents.

## What To Emphasize

- HireMe is a platform, not a generic marketplace.
- Clients need outcomes in domains where they are not experts.
- Creators need a way to offer valuable agents without exposing their private harness.
- Walrus stores protected agent artifacts and encrypted memory blobs.
- MemWal lets MCP conversations remember context across sessions and agents.
- Web and MCP usage are part of one connected hiring flow.

## What To Avoid

- Long login, callback, OAuth, Vercel, Render, or Supabase setup details.
- LLM model/provider settings.
- Wallet funding, payer private key setup, or testnet token mechanics.
- Full upload wizard walkthroughs that slow down the story.
- Database tables unless needed as a one-second supporting proof.
- Calling HireMe a "marketplace" in narration.

## Five-Minute Structure

| Time | Scene | Purpose |
| --- | --- | --- |
| 0:00-1:00 | Problem and product | Explain why HireMe exists |
| 1:00-1:35 | Creator publishes protected Agent | Show creator-side supply |
| 1:35-2:10 | Walrus artifact evidence | Prove protected storage |
| 2:10-2:45 | Client tries Agent on web | Show hiring/use flow |
| 2:45-3:25 | MCP calls the Agent | Show agent access from Codex/MCP |
| 3:25-4:05 | MemWal stores conversation memory | Show portable memory creation |
| 4:05-4:40 | Resume or new session recalls memory | Show continuity across sessions |
| 4:40-5:00 | Closing architecture | Tie Walrus and MemWal back to product value |

## Opening Script

Use this for the first minute.

```text
Have you ever spent money on AI agents and still failed to get the product you wanted?

When the work is outside your expertise, the hard part is not just asking the agent.
It is knowing what to ask, how to evaluate the result, and how to iterate until the output is actually useful.

That means you spend hours rewriting prompts, paying for repeated attempts, and switching tools,
but still do not get the result you needed.

On the other side, there are creators who know how to build agents that actually deliver:
with the right workflow, tools, prompts, and evaluation harness.

But sharing that agent publicly can expose the private know-how that makes it valuable.

HireMe connects these two sides.
It is a hiring platform for protected AI Agents.
Clients can try and hire specialized agents.
Creators can earn from their best agents without giving away the private workflow that makes it valuable.
With Walrus, protected agent packages can be stored safely and verifiably, and with MemWal, MCP conversations can remember context across sessions and agents.
```

## Scene Details

### 1. Creator Publishes Protected Agent

Show:

- Creator page or prepared upload flow.
- Agent profile fields briefly.
- Upload result with protected artifact metadata.

Say:

```text
First, a creator publishes a specialized Agent.
The Agent can include private prompts, tools, skills, and evaluation rules.
HireMe packages that capability without exposing the private harness to the client.
```

Keep it short. Use a prepared Agent rather than typing everything live.

### 2. Walrus Artifact Evidence

Show:

- The uploaded Agent has a Walrus blob or artifact reference.
- Walruscan or aggregator proof if available.
- The raw protected payload is not readable as public source.

Say:

```text
The protected Agent package is stored on Walrus.
This gives us verifiable decentralized storage, while the private harness remains protected.
```

Do not spend time explaining payer wallets or upload relay setup.

### 3. Client Tries Agent On Web

Show:

- Client opens the platform.
- Selects a specialized Agent profile.
- Uses Try or Hire.
- Gets a useful result.

Say:

```text
Now the client can try or hire the Agent from the web.
The important point is that the client uses a specialized capability without needing to know the creator's private workflow.
```

If possible, pick an Agent whose output is visibly domain-specific.

### 4. MCP Calls The Same Agent

Show:

- Codex/MCP connected to HireMe.
- `hireme_call_agent` or equivalent tool call.
- Agent response from the same deployed gateway.

Say:

```text
The same hired capability is also available through MCP.
So the Agent is not locked inside the website. It can be used inside the tools where the client already works.
```

This is where HireMe should feel like an agent hiring platform, not only a website.

### 5. MemWal Stores Conversation Memory

Show:

- First MCP conversation includes specific project context.
- Response metadata or gateway output shows `memWalStored: true`.
- Show namespace or blob ID if visible.

Say:

```text
After the MCP call, HireMe stores the conversation turn through MemWal.
MemWal encrypts the memory, stores it on Walrus, and indexes it for semantic recall.
```

Optional visible proof:

```text
namespace: hireme-mcp:<clientId>:<conversationId>
memWalStored: true
blobId: ...
```

### 6. Resume Session And Recall Memory

Show:

- Start a new MCP call or resume the conversation.
- Ask something that depends on prior context.
- Agent answers using the remembered context without re-prompting.

Say:

```text
Now the client can come back later.
The Agent recalls the project context from MemWal and continues the work instead of starting from zero.
```

This should be the strongest MemWal moment. Make the recalled detail specific and easy to recognize.

### 7. Closing Architecture

Show a simple architecture slide or screen:

```text
Creator -> Protected Agent package -> Walrus
Client -> Try/Hire -> Gateway entitlement check
MCP -> Agent call -> MemWal remember/recall
MemWal -> encrypted memory blobs on Walrus
```

Say:

```text
HireMe uses Walrus for protected Agent artifacts and MemWal for portable conversation memory.
That means creators can offer valuable private capabilities, and clients can keep using those Agents across web and MCP sessions with persistent context.
```

## Demo Proof Checklist

- A protected Agent exists on the platform.
- A client can use it from the web.
- The same capability can be called through MCP.
- MemWal write is visible as `memWalStored: true` or equivalent.
- A Walrus blob ID can be shown for artifact or memory proof.
- A later MCP call recalls prior context.
- The demo never exposes private Agent harness content.

## Suggested One-Line Captions

- "Hire specialized AI Agents without needing to be the domain expert."
- "Creators publish capabilities, not their private harness."
- "Protected Agent packages are stored on Walrus."
- "MCP makes hired Agents available inside the user's workflow."
- "MemWal turns MCP sessions into portable memory."
- "Walrus stores the encrypted memory blob; MemWal makes it recallable."

## Backup Plan

If live upload or live MCP is slow:

- Use a pre-published Agent.
- Show a prepared Walruscan blob.
- Use a short MCP call with a known `conversation_id`.
- Use `hireme_list_conversations` or `/v1/mcp-sessions/list` to show the remembered session.
- Keep the narration focused on the product flow, not infrastructure recovery.
