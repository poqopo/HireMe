# HireMe Demo Canva Edit Plan

## Purpose

Create a polished five-minute Canva demo video from the flow in `docs/HireMeDemoFlow.md`.

The video should feel like a connected product proof, not a live debugging walkthrough.
Use prepared clips, short zoomed evidence shots, clean captions, and a simple closing architecture slide.

Core message:

> The client hires the Agent's work. The creator keeps the Harness. HireMe runs the protected boundary through MCP, Walrus, and MemWal.

## Canva Setup

- Format: 16:9 video
- Target length: 5:00
- Export: 1080p MP4
- Style: clean product demo, restrained motion, no decorative effects
- Fonts: use one heading font and one body font only
- Captions: short, high-contrast, bottom-left or lower-third
- Transitions: simple cuts or short dissolve only
- Music: optional, very low volume, no vocals

## Asset Checklist

Prepare these before editing in Canva:

- `clip-01-platform-home.mp4`: Client opens HireMe platform
- `clip-02-dokpami-web-result.mp4`: Client tries or hires `dokpami-maker` and receives PNG
- `clip-03-mcp-job-call.mp4`: MCP call returns async `job_id`
- `clip-04-mcp-result-poll.mp4`: MCP result polling returns generated PNG
- `clip-05-creator-publish.mp4`: Creator publishes protected Agent
- `clip-06-walrus-proof.mp4`: Walrus blob/artifact proof
- `clip-07-memwal-store.mp4`: MemWal storage proof
- `clip-08-memwal-recall.mp4`: Later prompt recalls Dokpami context
- `image-dokpami-first.png`: First generated Dokpami character result
- `image-dokpami-library.png`: New scene version using recalled memory
- `slide-architecture.png` or Canva-native architecture slide

## Naming Rules

Use predictable names so the Canva timeline stays easy to manage:

- Screen recordings: `clip-##-short-name.mp4`
- Generated images: `image-dokpami-variant-name.png`
- Slides: `slide-short-name.png`
- Audio: `voiceover-hireme-demo.wav`

## Timeline

| Time | Scene | Primary Visual | Narration Goal | On-Screen Caption |
| --- | --- | --- | --- | --- |
| 0:00-0:12 | Opening statement | HireMe platform or simple product screen | Establish the sharing problem for valuable Agents | The better an Agent gets, the harder it is to share. |
| 0:12-0:30 | Private Harness problem | Creator/Agent profile, blurred private details if needed | Explain that value lives in prompts, skills, tools, memory rules, and review habits | Clients need the Agent. Creators need to protect the Harness. |
| 0:30-0:50 | Product boundary | HireMe web flow | Position HireMe as protected Agent hiring through a trusted boundary | HireMe lets clients hire Agent work, not copy private workflows. |
| 0:50-1:08 | Client selects Agent | `dokpami-maker` profile | Show a specialized Agent being selected | Hire a specialized Agent. |
| 1:08-1:30 | Web result | Generated Dokpami PNG | Prove the client receives the result, not the Harness | The client receives the output, not the private Harness. |
| 1:30-1:45 | MCP setup | Codex or Claude MCP tool list | Show the same hired capability outside the website | The same capability is available through MCP. |
| 1:45-2:00 | MCP async call | `hireme_call_agent` returns `job_id` | Explain async job creation for image generation | HireMe starts an Agent job and returns a job id. |
| 2:00-2:10 | MCP result | `hireme_get_agent_result` returns PNG | Show the result arriving in the MCP workflow | The Agent result returns to the user's tool. |
| 2:10-2:30 | Creator publishing | Prepared creator upload flow | Show creator-side supply without long setup | Creators publish capabilities, not copyable prompts. |
| 2:30-2:45 | Protected metadata | Artifact metadata or protected package status | Reinforce protected packaging | The Harness stays behind the execution boundary. |
| 2:45-3:05 | Walrus artifact proof | Blob ID, Walruscan, or aggregator proof | Prove durable protected artifact storage | Protected Agent packages are stored on Walrus. |
| 3:05-3:20 | Walrus boundary | Show raw payload is not public source | Avoid implying public prompt disclosure | Durable proof without exposing private source. |
| 3:20-3:40 | MemWal write | `memWalStored: true`, namespace, blob ID | Show memory creation after the MCP turn | MemWal stores encrypted conversation memory. |
| 3:40-4:00 | Session evidence | Conversation or session list | Show portable memory context exists outside one UI session | Project context becomes recallable. |
| 4:00-4:20 | Recall prompt | New MCP prompt referencing earlier concept | Show the user does not repeat the full spec | The Agent remembers the Dokpami concept. |
| 4:20-4:40 | New scene result | Dark magical library image | Prove continuity across sessions | A new scene uses remembered project context. |
| 4:40-5:00 | Closing architecture | Simple architecture slide | Tie Web, MCP, Walrus, and MemWal into one product value | Web + MCP + Walrus + MemWal create protected Agent hiring. |

## Voiceover Script

Use this as the main recording script. Keep pacing calm and leave short pauses for visual proof.

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

Here, the client hires dokpami-maker, a specialized character creation Agent.
They are not buying a prompt or downloading a template.
They are asking a protected Agent to create the character and return the image result.

The same hired capability is also available through MCP.
So the Agent is not locked inside the website.
It can be used inside the tools where the client already works, like Codex or Claude.

For image generation, HireMe starts an async Agent job and returns a job id immediately.
Then the MCP client polls the gateway and receives the generated PNG.
Again, HireMe returns the actual Agent result, not the creator's private Harness.

On the creator side, a specialized Agent can include private prompts, tools, skills, examples, and evaluation rules.
HireMe packages that capability without exposing the private Harness to the client.

The protected Agent package is stored on Walrus.
This gives HireMe durable, verifiable artifact storage, while the private Harness remains protected behind the execution boundary.

After the MCP call, HireMe stores the conversation turn through MemWal.
MemWal encrypts the memory, stores it on Walrus, and indexes it for semantic recall.

Now the client can come back later.
The hired Agent recalls the Dokpami character context from MemWal and creates a new scene version instead of starting from zero.

HireMe uses Walrus for protected Agent artifacts and MemWal for portable conversation memory.
That means creators can offer valuable private capabilities, while clients can keep using those Agents across web and MCP sessions with persistent context.
```

## Lower-Third Caption List

Use these as short Canva text overlays:

- The client hires the Agent's work. The creator keeps the Harness.
- HireMe is MCP-native Agent hiring, not a prompt marketplace.
- Clients receive results, not private workflows.
- Creators publish capabilities, not copyable prompts.
- Protected Agent packages are stored on Walrus.
- MCP makes hired Agents available inside the user's workflow.
- MemWal turns hired Agent sessions into portable memory.
- Walrus stores encrypted artifacts; MemWal makes project context recallable.

## Clip Editing Notes

### Web Product Clips

- Crop out browser chrome unless the URL is useful proof.
- Keep pointer movement slow and intentional.
- Use 1.1x to 1.25x speed if the UI waits feel long.
- Add a zoom crop on the generated PNG result.

### MCP Clips

- Increase terminal/editor zoom before recording.
- In Canva, crop tightly around the command output.
- Highlight only the important evidence:
  - `hireme_call_agent`
  - `job_id`
  - `hireme_get_agent_result`
  - generated PNG URL or returned image
  - `memWalStored: true`
  - `previousTurnsLoaded`
  - `blobId`

### Walrus Clips

- Show the blob/artifact reference clearly.
- Do not linger on wallet, payer, testnet token, relay, or infrastructure setup.
- Keep this section proof-oriented and short.

### MemWal Clips

- Show the first project context:
  - `Dokpami`
  - `wizard eagle character`
  - character style
- Show memory storage proof.
- Show a later prompt that reuses the concept without restating every detail.
- The strongest visual is the before/after image pair.

## Architecture Slide

Build the closing slide directly in Canva with three clean horizontal flows:

```text
Creator Harness -> encrypted Walrus artifact -> HireMe gateway execution

Client task -> Try or Hire -> MCP call from Codex or Claude -> safe Agent result

MCP conversation -> MemWal remember/recall -> encrypted memory blobs on Walrus
```

Keep this slide simple:

- One title: `Protected Agent Hiring`
- Three horizontal rows
- Use arrows, not paragraph blocks
- Put Walrus and MemWal in distinct colors
- Avoid dense architecture labels

## Demo Prompts

First prompt:

```text
Create a Dokpami wizard eagle character.
Make it a centered character asset with a simple plain background.
```

Recall prompt:

```text
Using the Dokpami character concept from earlier,
create a new scene version set inside a dark magical library.
Keep the same wizard eagle identity.
```

## Backup Plan

If live upload or live MCP is slow:

- Use a pre-published Agent.
- Show a prepared Walruscan blob.
- Use a short MCP call with a known `conversation_id`.
- Use `hireme_list_conversations` or `/v1/mcp-sessions/list` to show remembered sessions.
- Keep narration focused on product value, not recovery.

## Final QA Checklist

- The video is close to five minutes.
- Every terminal or MCP shot is readable at 1080p.
- The first generated PNG is visible before MemWal storage is discussed.
- Walrus appears as artifact proof, not wallet setup.
- MemWal appears as memory proof, not a vague claim.
- The demo never exposes private Harness contents.
- The video never calls HireMe a marketplace.
- The final slide clearly connects Web, MCP, Walrus, and MemWal.
