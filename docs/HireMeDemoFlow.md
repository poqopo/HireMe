# HireMe Demo Flow

## Goal

Create a five-minute demo that clearly shows HireMe as a hiring platform for protected AI Agents, aligned with the Walrus and MemWal track.

Core message:

> HireMe is a hiring platform for protected AI Agents. Clients can try and hire specialized agents, creators can earn from their best agents without giving away the private workflow that makes them valuable, and Walrus plus MemWal make protected agent packages safe, verifiable, and memorable across sessions and agents.

Short version:

> The client hires the Agent's work. The creator keeps the Harness. HireMe runs the protected boundary through MCP, Walrus, and MemWal.

## What To Emphasize

- HireMe is an MCP-native hiring platform, not a prompt marketplace.
- Clients hire specialized Agent work, not raw instructions or a copyable template.
- Creators publish capabilities without exposing the private Harness behind them.
- The trusted gateway runs the protected Agent and returns the result, not the raw Harness.
- Walrus stores encrypted Agent artifacts and memory blobs as durable proof.
- MemWal lets hired Agents remember project context across MCP sessions and Agent handoffs.
- Web, MCP, Walrus, and MemWal should feel like one connected hiring flow.

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
| 0:00-0:50 | Problem and product boundary | Explain why protected Agent hiring exists |
| 0:50-1:30 | Client hires `dokpami-maker` on web | Show the client getting a character result, not the Harness |
| 1:30-2:10 | MCP calls the same Agent | Show the Agent working inside Codex or Claude |
| 2:10-2:45 | Creator publishes protected Agent | Show creator-side supply |
| 2:45-3:20 | Walrus artifact evidence | Prove protected storage |
| 3:20-4:00 | MemWal stores conversation memory | Show portable memory creation |
| 4:00-4:40 | Resume and generate a new scene version | Show continuity across sessions |
| 4:40-5:00 | Closing architecture | Tie Walrus and MemWal back to product value |

## Opening Script

Use this for the first minute.

```text
The better an Agent gets, the harder it is to share.

A useful Agent is not just a model call.
Its value lives in the private work behind it:
prompts, skills, rubrics, tools, memory rules, and review habits.

Today, creators have a bad tradeoff.
If they share the full Harness, clients can copy the know-how that makes the Agent valuable.
If they keep the Harness private, clients cannot use the Agent where they actually work.

HireMe solves that boundary problem.

The client hires the Agent's work.
The creator keeps the private Harness.
The Agent runs through HireMe's MCP gateway, so the client gets the result without receiving the raw source of the Agent.

Walrus stores the encrypted Agent artifact as durable proof.
MemWal gives hired Agents portable memory across sessions and multi-Agent workflows.
```

## Scene Details

### 1. Client Hires `dokpami-maker` On Web

Show:

- Client opens the platform.
- Selects the `dokpami-maker` Agent profile.
- Uses Try or Hire.
- Gets a generated character PNG.

Say:

```text
The client starts by hiring dokpami-maker, a specialized character creation Agent.
They are not buying a prompt or downloading a template.
They are asking a protected Agent to create the character and return the image result.
```

Use a prepared prompt:

```text
Using Dokpami Maker,
Create a Dokpami wizard eagle character.
Make it a centered character asset with a simple plain background.
```

The goal is to produce a visible first result that can become the remembered project context.

### 2. MCP Calls The Same Agent

Show:

- Codex/MCP connected to HireMe.
- `hireme_call_agent` returns an async `job_id` for the image task.
- `hireme_get_agent_result` polls the same deployed gateway until the job completes.
- The generated PNG delivered back into the MCP client.

Say:

```text
The same hired capability is also available through MCP.
So the Agent is not locked inside the website.
It can be used inside the tools where the client already works, like Codex or Claude.
For image generation, HireMe starts an async Agent job and returns a job id immediately.
Here, HireMe returns the actual generated image result, not the creator's private Harness.
```

This is where HireMe should feel like an Agent hiring platform, not only a website.

### 3. Creator Publishes Protected Agent

Show:

- Creator page or prepared upload flow.
- Agent profile fields briefly.
- Upload result with protected artifact metadata.

Say:

```text
On the creator side, a specialized Agent can include private prompts, tools, skills, examples, and evaluation rules.
HireMe packages that capability without exposing the private Harness to the client.
```

Keep it short. Use a prepared Agent rather than typing everything live.

### 4. Walrus Artifact Evidence

Show:

- The uploaded Agent has a Walrus blob or artifact reference.
- Walruscan or aggregator proof if available.
- The raw protected payload is not readable as public source.

Say:

```text
The protected Agent package is stored on Walrus.
This gives us durable, verifiable artifact storage, while the private Harness remains protected behind the execution boundary.
```

Do not spend time explaining payer wallets or upload relay setup.

### 5. MemWal Stores Conversation Memory

Show:

- First MCP conversation includes specific project context: `Dokpami`, `wizard eagle character`, and the character style.
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

Before sending the second prompt, wait about 30 seconds or read the conversation until the first turn is visible. MemWal write/index can be asynchronous, so sending the follow-up immediately after the first image result may produce `previousTurnsLoaded: 0`.

### 6. Resume Session And Recall Memory

Show:

- Start a new MCP call or resume the conversation.
- Ask for a new scene version without repeating the full character spec.
- Agent creates a new image using the remembered character concept.

Say:

```text
Now the client can come back later.
The hired Agent recalls the Dokpami character context from MemWal and creates a new scene version instead of starting from zero.
```

Use a prepared prompt:

```text
Using the Dokpami character concept from earlier,
create a new scene version set inside a dark magical library.
Keep the same wizard eagle identity.
```

This should be the strongest MemWal moment. The demo is not claiming that MemWal edits the previous PNG bytes directly. It shows the Agent remembering the prior character concept and generating a new scene version from that remembered context.

### 7. Closing Architecture

Show a simple architecture slide or screen:

```text
Creator Harness -> encrypted Walrus artifact -> HireMe gateway execution
Client task -> Try or Hire -> MCP call from Codex or Claude -> safe Agent result
MCP conversation -> MemWal remember/recall -> encrypted memory blobs on Walrus
```

Say:

```text
HireMe uses Walrus for protected Agent artifacts and MemWal for portable conversation memory.
That means creators can offer valuable private capabilities, while clients can keep using those Agents across web and MCP sessions with persistent context.
```

## Demo Proof Checklist

- A protected Agent exists on the platform.
- A client can use it from the web.
- The same capability can be called through MCP.
- `dokpami-maker` returns an actual PNG result.
- The client receives the Agent result, not the creator's private Harness.
- MemWal write is visible as `memWalStored: true` or equivalent.
- A Walrus blob ID can be shown for artifact or memory proof.
- A later MCP call recalls the `Dokpami` character concept and creates a new scene version.
- The demo never exposes private Agent harness content.

## Suggested One-Line Captions

- "The client hires the Agent's work. The creator keeps the Harness."
- "Hire specialized AI Agents without needing to be the domain expert."
- "Creators publish capabilities, not copyable prompts."
- "Protected Agent packages are stored on Walrus."
- "MCP makes hired Agents available inside the user's workflow."
- "MemWal turns hired Agent sessions into portable memory."
- "Walrus stores encrypted artifacts; MemWal makes project context recallable."

## Backup Plan

If live upload or live MCP is slow:

- Use a pre-published Agent.
- Show a prepared Walruscan blob.
- Use a short MCP call with a known `conversation_id`.
- Use `hireme_list_conversations` or `/v1/mcp-sessions/list` to show the remembered session.
- Keep the narration focused on the product flow, not infrastructure recovery.
