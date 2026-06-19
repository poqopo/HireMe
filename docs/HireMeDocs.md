# HireMe Docs Draft

This document is the source draft for the `/docs` page. The page should feel like a product guide first and a technical reference second.

The reader should not feel like they are opening an encyclopedia. They should understand what HireMe is, what they can do with it, and why the technical design matters.

## Writing Goal

HireMe docs should answer these questions in order:

1. What is HireMe?
2. Why would I use it?
3. What features make HireMe different?
4. How do I hire an Agent?
5. How do I publish an Agent?
6. How do I get paid when my Agent earns money?
7. What is implemented now, and what comes next?

## Web Page Grouping

Use user-facing section names. Avoid abstract labels like `Product Model` on the web page.

Recommended `/docs` navigation:

1. Meet HireMe
2. Why It Matters
3. Features
4. How to Hire an Agent
5. How to Publish an Agent
6. How to Get Paid
7. Trust, Privacy, and Roadmap

The Markdown source can keep technical details under each section, but the visible web page should read like a guided walkthrough.

## Table of Contents

### 1. Meet HireMe

HireMe is a way to hire AI Agents that already know how to do specialized work.

Instead of starting with a blank model and teaching it everything yourself, you can hire an Agent whose creator has already trained the workflow: the prompts, examples, rubrics, tool habits, review standards, and domain-specific judgment that make the Agent useful.

The experience should feel closer to hiring a skilled person than installing a generic chatbot. You are not buying raw model access. You are hiring prepared know-how.

That know-how is the creator's IP. HireMe is built so creators can share useful Agents without handing over the private Harness that makes them valuable.

The buyer hires the result of that know-how, not the raw source. A creator can keep prompts, skills, examples, rubrics, and tool habits private while still letting buyers use the Agent from Codex.

#### 1.1 What HireMe Is

HireMe is a marketplace and execution layer for protected AI Agents.

```txt
HireMe lets users hire protected AI Agents from Codex while creator private logic stays behind the gateway.
```

Creators publish Agents as paid tools. Buyers use those Agents from Codex through MCP. The private files that make the Agent valuable stay behind the HireMe gateway, and the user receives the final result, not the creator's private Harness.

#### 1.2 What Counts as an Agent

In HireMe, an Agent is not the base model itself. The model is the engine. The private Harness is the working method. The gateway is the runtime. Memory and tools define what the Agent can remember and do.

```txt
Model = engine
Harness = working method
Gateway Runtime = execution environment
Memory and Tools = continuity and action boundary
Agent = a repeatable worker for a specific job
```

This means HireMe is not selling raw model access. It is also not selling a prompt file to copy.

```txt
HireMe lets you hire protected Agents, not prompts.
```

A HireMe Agent is a model-agnostic worker packaged with private know-how, tools, memory rules, and an execution contract. The creator owns the Harness. The buyer hires the capability.

A normal prompt marketplace gives the buyer text to copy and run somewhere else. HireMe keeps the Harness protected, runs it through the gateway, and returns the result. The model can change over time, but the Agent's working method can remain valuable.

#### 1.3 The Short Version

The loop is simple:

```txt
Creators upload protected Agent know-how.
Buyers Try or Hire the Agent.
Codex calls HireMe through MCP.
HireMe runs the protected Agent and returns the result.
```

The user may pay more than they would for a generic model call, but they are paying for an Agent that has already been shaped for a job. Once the Agent fits the user's workflow, it can become much more useful than a general assistant that needs to be re-taught every time.

#### 1.4 Who It Is For

HireMe is for creators, buyers, teams, and platform operators.

Creators use HireMe to turn private Agent know-how into a paid product. Their value might live in prompts, examples, skills, rubrics, evaluation notes, launch playbooks, design rules, code review standards, or tool-routing habits. HireMe lets them expose the Agent's capability without exposing those private files.

Buyers use HireMe when they want a capable Agent without building it from scratch. They can browse public Agent cards, Try or Hire an Agent, and call it from Codex as part of their normal workflow.

Teams use HireMe when one Agent is not enough. A Team can combine research, product, design, code, evaluation, and operations Agents while using memWal to share verified project context.

Operators use HireMe to manage access, usage, payment, memory records, and protected artifact execution.

#### 1.5 Core Terms

These are the terms readers need before going deeper:

- `Agent`: a packaged AI worker with a public capability and private operating know-how.
- `Agent Harness`: the private folder that teaches the Agent how to work, including `AGENTS.md`, skills, examples, prompts, rubrics, and workflow rules.
- `Try`: limited access before a full hire.
- `Hire`: paid access to call an Agent through HireMe.
- `Team Hire`: access to multiple Agents that coordinate around one project.
- `MCP`: the protocol Codex uses to call HireMe tools.
- `Gateway`: the trusted execution layer that checks access, runs the protected Agent, and returns safe output.
- `memWal`: encrypted memory used for result records and Team project context.
- `Walrus`: storage for encrypted protected artifacts.
- `Sui receipt`: payment or access authority used to prove a hire.

### 2. Why It Matters

HireMe is useful because it creates a safer exchange between people who have valuable Agent know-how and people who need that know-how applied to their own work.

The buyer does not need to expose their project input directly to the creator. The creator does not need to hand the buyer the original prompts, skills, rubrics, examples, or workflow rules that make the Agent valuable.

HireMe sits between them as the secure execution environment: it checks access, runs the protected Agent, returns safe output, and keeps private materials on the correct side of the boundary.

Example: a buyer can ask a code-review Agent to inspect a private migration. The creator does not need to see that migration. At the same time, the buyer does not receive the creator's hidden checklist, examples, or review playbook.

#### 2.1 Benefits for Buyers

Buyers use HireMe when they want expert Agent output without building the Agent themselves.

Example:

```txt
You need a landing page for a new product.
You could spend hours teaching a general model your product, audience, layout rules, launch style, and conversion checklist.
Or you can hire a landing-page Agent that already knows that workflow.
```

The benefit is not just speed. The buyer gets an Agent that has already been shaped by someone else's practice.

Buyer benefits:

- Less setup: the Agent already has a working method.
- Better repeatability: the same Agent can apply the same standards across tasks.
- Lower context burden: the buyer does not need to explain every rule from scratch.
- Safer usage: project input goes to the HireMe gateway for execution, not directly to the creator.
- Clear comparison: buyers can inspect public Agent cards, typical outputs, pricing, and protected asset classes before hiring.
- Codex-native workflow: the Agent can be called from the same environment where the buyer already works.

#### 2.2 Benefits for Creators

Creators use HireMe when they have built an Agent that works well, but the value depends on private know-how.

Example:

```txt
You built a code-review Agent with a strong migration-risk checklist, private examples, test heuristics, and review rubrics.
You want people to pay for the review capability.
You do not want to give away the original AGENTS.md, skills, prompts, or rubric files.
```

HireMe lets the creator sell the result of the Agent without selling the raw source of the Agent.

Creator benefits:

- Monetize private Agent know-how.
- Publish a public card without exposing the private Harness.
- Keep `AGENTS.md`, `skills/**`, examples, prompts, rubrics, and eval notes behind the gateway.
- Update and improve the Agent over time.
- Track usage, pricing, and result metadata.
- Avoid receiving raw buyer project inputs directly by default.

#### 2.3 The Secure Exchange

The core exchange looks like this:

```txt
Buyer input
  -> HireMe secure execution environment
  -> protected Agent run
  -> safe result returned to buyer

Creator know-how
  -> encrypted protected artifact
  -> gateway-only execution
  -> never shipped to buyer
```

This creates a two-sided safety boundary:

- The buyer can use specialized Agent capability without revealing their input directly to the creator.
- The creator can sell specialized Agent capability without revealing the original know-how to the buyer.
- The platform can meter usage, enforce access, and store safe memory/ledger records around the execution.

#### 2.4 The HireMe Promise

The MVP promise is:

```txt
HireMe does not expose creator Agent internals to buyers.
HireMe Gateway is the trusted executor in the MVP.
```

The exact trust boundary is:

```txt
The MVP does not claim that HireMe cannot see user input or creator artifacts.
The claim is that buyers do not receive creator private Agent files.
The creator does not receive raw buyer input by default.
```

#### 2.5 Why Codex and MCP

- Codex is where many users already work.
- MCP gives HireMe a clean tool boundary.
- Users can call Agents as tools instead of copying prompts or installing private folders.

### 3. Features

HireMe is not just another Agent listing page. The product is built around four features that make protected Agent hiring practical: private Harness protection, MCP-native usage, Team memory, and creator payouts.

#### 3.1 Protected Agent Harness

Most Agent value lives outside the model itself. It lives in the creator's Harness: `AGENTS.md`, skills, prompts, examples, rubrics, evaluation notes, and workflow rules.

HireMe lets creators share the Agent without sharing the raw Harness.

```txt
Public capability outside.
Private Harness protected inside.
```

The protected Harness is stored as an encrypted artifact. Walrus provides decentralized storage for the artifact. Seal is the long-term direction for policy-based access and key release. In the MVP, the gateway is the trusted executor that loads the protected artifact, runs the Agent, and returns safe output to the buyer.

This is the core difference from a normal prompt marketplace: buyers can use the Agent's capability, but they do not receive the creator's original know-how.

#### 3.2 MCP-Native Agent Hiring

HireMe Agents are not meant to live only inside the HireMe web app.

The point is to use expert Agents where people already work: Codex, Claude, and other MCP-compatible clients.

Buyers can Try or Hire an Agent on the web, then call it from their own AI workspace through MCP. They do not need to copy prompts, download private folders, or switch into a closed HireMe-only interface.

Example:

```txt
Hire a code-review Agent on HireMe.
Open Codex.
Ask Codex to call that hired Agent on your current repo.
```

HireMe becomes the marketplace and execution layer, while Codex or Claude remains the place where the user actually works.

#### 3.3 Memory Sharing With Team Agents

Single Agents are useful, but many real projects need multiple specialists.

For example:

- a research Agent gathers evidence.
- a product Agent turns it into requirements.
- a design Agent creates a landing page direction.
- a code Agent implements the page.
- an evaluation Agent checks the result.

The hard part is memory. If every Agent starts from zero, the user has to repeat the same project context again and again.

HireMe solves this by using memWal as the shared memory layer for Agent Teams. Team Agents can share verified project memory such as goals, decisions, constraints, handoffs, risks, and artifact summaries.

The important boundary is that Team memory does not mean every Agent sees every private thing. Creator Harnesses stay private. memWal shares approved project context, not raw prompts, private skills, or execution traces.

```txt
Team Agents share project memory.
They do not share creator private Harnesses.
```

#### 3.4 Creator Payouts

Before HireMe, a creator could build a strong Agent Harness but still have no clear way to earn from it.

HireMe turns that Harness into a paid product. If a creator builds an Agent that does useful work, buyers can Try it, Hire it, and pay for continued usage.

Creator payouts make Agent quality economically meaningful:

- build a useful Harness.
- publish it as a protected Agent.
- let buyers use it without exposing the raw source.
- track usage and earnings in My Page.
- redeem available earnings to your wallet.

The goal is simple: if your Agent works well, it should be able to earn money for you.

### 4. How to Hire an Agent

Hiring an Agent should feel simple: log in, try the Agent, use it from Codex, and only commit when it feels useful.

The first interaction does not need to be a full purchase. HireMe should let buyers test an Agent's behavior before deciding whether it is worth paying for longer-term access.

![HireMe marketplace with Try and Hire buttons](/docs/how-to-hire.png)

Start from the marketplace. The card should make the decision easy: what the Agent does, what it costs, what kind of result to expect, and whether the Agent is worth trying.

#### 4.1 Log In

Start by logging in to HireMe. Your account connects the web marketplace, your wallet/payment state, and the MCP identity that Codex uses when it calls Agents.

After login, HireMe can show which Agents you have tried, hired, or created.

#### 4.2 Find an Agent You Like

Browse the marketplace and open Agents that look useful for your task.

An Agent card should help you answer:

- What does this Agent do?
- Who created it?
- What does a typical result look like?
- What does it cost?
- What private assets are protected?
- What public MCP contract does it expose?

Example:

```txt
You need help reviewing a database migration.
You find a code-review Agent with a protected migration-risk rubric.
Before hiring it, you press Try to see whether its output style is useful.
```

#### 4.3 Press Try

Press `Try` on the Agent before you fully hire it. Try access is a low-friction way to check whether the Agent fits your task and working style.

The Agent is still protected during Try. You can see the result, but you do not receive the creator's private Harness.

#### 4.4 Use It From Codex

After pressing Try, open Codex and call the HireMe MCP server. You can ask Codex to use the Agent directly.

Useful MCP tools:

- `hireme_list_my_agents`: see Agents you can currently use.
- `hireme_request`: send a natural-language request and let HireMe route it.
- `hireme_select_agent`: choose the active Agent.
- `hireme_call_agent`: call a specific Agent with structured arguments.

Example Codex request:

```txt
Use my HireMe code-review Agent to review this migration diff.
```

HireMe checks your Try/Hire access, runs the protected Agent through the gateway, and returns safe output to Codex.

#### 4.5 Add Funds When You Are Ready

If the Agent is useful and you want continued access, make sure your wallet has enough funds for the hire.

In the Sui-based flow, that means your connected wallet needs enough SUI to cover the Agent's price. The web app should make the required amount clear before you confirm the Hire.

#### 4.6 Press Hire

Press `Hire` when you are ready to pay for access.

The gateway verifies your account, wallet/payment state, and entitlement. After the Hire succeeds, Codex can call the Agent through HireMe MCP according to the Agent's access rules and pricing.

#### 4.7 Receive Results

After each call:

- You receive safe Agent output.
- `jsonOutput.responseMode` tells you whether the Agent answered directly or delegated to local Codex.
- Codex can continue local workspace work when `jsonOutput.localCodex.shouldAct` is true.
- Result memory can be saved as an encrypted memWal record.
- Usage and billing metadata are recorded by the gateway.

### 5. How to Publish an Agent

There are two ways to publish an Agent: from the web app or from Codex through HireMe MCP.

Both paths have the same privacy goal: publish the Agent's public capability without giving buyers the creator's private Harness files.

![HireMe Create Agent form](/docs/how-to-publish.png)

The public form is about explaining the Agent, while the private upload is about protecting the Harness. Buyers see the public card and sample result. They do not receive the private folder.

#### 5.1 Before You Start

Prepare the Agent Harness. This is the private working folder that makes the Agent valuable.

It can include:

- `AGENTS.md`
- `skills/**`
- private prompts
- rubrics
- examples
- eval notes
- design guides
- tool routing rules
- workflow logic

This folder should not be shipped to buyers. HireMe stores it as a protected artifact and runs it through the gateway.

#### 5.2 Method 1: Publish From the Web

Use the web flow when you want a guided publishing experience.

Steps:

1. Log in to HireMe.
2. Go to the Agent creation page.
3. Fill in the public card: name, headline, summary, category, skills summary, typical output, and public MCP contract.
4. Upload the protected Harness archive.
5. Choose the model/base execution tier.
6. Set your creator fee.
7. Review the final price shown to buyers.
8. Submit the Agent for registration.

After submission, the gateway validates the archive, encrypts the Harness, stores protected artifact references, and registers the public Agent card.

#### 5.3 Method 2: Publish From Codex Through MCP

Use the MCP flow when you prefer to work from Codex.

Typical flow:

1. Ask Codex to create a HireMe Agent template.
2. HireMe MCP calls `hireme_create_agent_template`.
3. Edit the generated folder: `AGENTS.md`, skills, examples, and private workflow files.
4. When the Harness is ready, ask Codex to publish it.
5. HireMe MCP calls `hireme_create_agent_from_folder`.
6. The gateway archives, encrypts, uploads, and registers the Agent.

Example Codex request:

```txt
Create a HireMe Agent template for a code-review Agent.
```

Later:

```txt
Publish this folder as a HireMe Agent with a 5 SUI per 1M token creator fee.
```

If the artifact is already encrypted and uploaded, advanced users can register metadata with `hireme_register_agent` instead. That path should still pass only public card data and encrypted artifact references, not plaintext private Harness content.

#### 5.4 What Buyers See

Buyers see the public card and safe outputs:

- Agent name
- creator
- category
- headline
- public summary
- skills summary
- typical output
- public MCP contract
- price
- protected asset classes

Buyers do not receive the original `AGENTS.md`, private skills, prompts, rubrics, or workflow source.

#### 5.5 Update and Version

- Creators can publish improved Harness versions over time.
- Buyers should know which version produced a result.
- Old versions should remain auditable by digest and metadata.

### 6. How to Get Paid

Creators earn when buyers use or hire their Agents.

The expected product flow is simple: check your earnings in My Page, then redeem available funds to your wallet.

![HireMe My Agents page](/docs/how-to-get-paid.png)

My Page is the creator's control room: created Agents, paid hires, usage activity, available earnings, and redeem state should all be visible from here.

#### 6.1 Check Earnings

Go to `My Page` and open the list of Agents you created.

For each Agent, the page should show earnings-related information such as:

- total usage
- paid hires
- token usage or billable calls
- gross revenue
- platform fees
- available balance
- pending settlement

This lets creators see which Agents are being used and how much each one has earned.

#### 6.2 Redeem

When earnings become available, press `Redeem`.

HireMe verifies the settlement record and sends the redeemable amount to the creator's connected wallet.

In a Sui-based flow, the redeemed funds are transferred to the creator's Sui wallet after the platform confirms the amount is available.

#### 6.3 What Happens Behind the Scenes

Each paid Agent call creates ledger metadata. The platform uses those records to calculate creator earnings and settlement amounts.

The redeem flow should use verified ledger data, not raw prompts or raw private outputs.

```txt
Agent usage
  -> gateway ledger
  -> creator earnings
  -> available balance
  -> Redeem
  -> creator wallet
```

### 7. Trust, Privacy, and Roadmap

The important trust question is simple: who can see what?

#### 7.1 What Buyers Can See

- Agent card.
- public summary.
- skills summary.
- public MCP contract.
- pricing.
- typical output.
- safe result output.
- safe metadata and ledger references.

#### 7.2 What Buyers Cannot See

- `AGENTS.md`
- `skills/**`
- private prompts
- rubrics
- eval sets
- design guides
- private workflow logic
- raw protected artifact contents

#### 7.3 MVP Trust Model

- Gateway is trusted.
- Gateway can see user task and creator artifact during execution.
- Buyer cannot see creator private files.
- Creator does not receive raw user input by default.

#### 7.4 Final Goal

The final goal is not just to build another Agent marketplace. The final goal is a platform-free, decentralized Agent hiring protocol.

In that final state, creators can publish valuable Agents, buyers can hire them from any compatible AI client, and neither side has to hand raw private data to the other. More importantly, the platform itself should not need to see sensitive buyer inputs or creator Harness contents.

The long-term direction is a fully decentralized Agent economy:

- Creator Harnesses are stored as encrypted decentralized artifacts.
- Access is controlled by on-chain receipts, policies, and verifiable execution rules.
- Agent execution moves toward environments where even the platform cannot inspect plaintext data.
- TEE, ICP blockchain, Seal, or equivalent trust-minimized systems can provide stronger execution and key-release boundaries.
- MCP-compatible clients such as Codex and Claude can call hired Agents without depending on a HireMe-only interface.
- memWal enables encrypted memory and Team coordination without exposing raw private traces.
- Creator payouts are settled from verifiable usage and payment records.

The current development stage is an intermediate step. Today, the HireMe platform and gateway still mediate execution. The gateway is trusted to check access, run protected Agents, and avoid leaking creator private files to buyers.

That is not the final destination. It is the practical bridge toward a protocol where Agent hiring, execution, memory, and payout become progressively more decentralized and less platform-dependent.

#### 7.5 Implementation Log

Latest updates are listed first and grouped by development week.

##### Week of 2026-06-17

Status: current buildout and documentation pass.

This week focuses on turning HireMe from a local protected-Agent demo into a clearer product and protocol direction.

Implemented or drafted:

- Reworked the docs into a user-friendly guide instead of an encyclopedia-style reference.
- Defined the main product story: protected Agent Harnesses, MCP-native hiring, memory sharing with memWal, and creator payouts.
- Added the Try → Codex MCP usage → wallet funds → Hire flow.
- Added two publishing paths: web publishing and Codex/MCP publishing.
- Added creator payout flow: My Page earnings, available balance, and Redeem to wallet.
- Clarified that memWal is used to solve Team Agent memory sharing; it is not a separate "team memWal" product.
- Added database and gateway direction for token-based pricing, result media, Sui payment intents, settlement records, payment verification logs, and platform encryption v1 defaults.
- Expanded protected artifact and gateway smoke-test coverage around platform encryption, Sui payment, and Agent folder creation.

Being worked on next from this week:

- Render the Markdown source into the web `/docs` page.
- Add stronger web UI for the Try/Hire flow and creator earnings.
- Connect creator Redeem UX to verified ledger and settlement records.
- Add typed memory deltas for Agent outputs.
- Add memWal-powered Team memory retrieval and write policies.

##### Week of 2026-06-10

Status: MVP foundation.

This week established the first working shape of HireMe: trusted gateway execution, protected artifacts, Codex MCP access, and marketplace metadata.

Implemented or drafted:

- Initial marketplace schema: profiles, Agents, Agent versions, protected artifacts, pricing, hires, call ledger, and payouts.
- Agent Team schema direction: Team-level access, pricing, pooled usage, and multiple Agents under one Team.
- OAuth MCP session tables and gateway OAuth flow.
- Try/Hire entitlement records.
- Enoki zkLogin wallet linking direction.
- Sui address linkage for profile/session/payment metadata.
- Walrus Agent artifact registry direction.
- Platform-managed encryption metadata for the MVP.
- Sui Seal policy metadata fields for future key-release hardening.
- User-scoped memWal result records for encrypted Agent call results.
- MVP trust model: HireMe Gateway is trusted, and buyer-facing responses must not include creator private files.

What this stage proves:

- Creators do not need to ship raw Harness files to buyers.
- Buyers can call protected Agents through Codex MCP.
- The platform can record access, usage, artifact references, and safe memory metadata.
- The architecture can evolve toward stronger decentralized execution later.

#### 7.6 Near-Term Roadmap

The near-term roadmap is about making the current platform-mediated MVP usable and legible.

Product work:

- Finish the `/docs` page from the Markdown source.
- Make Try → Codex usage → wallet funds → Hire easy to understand.
- Add creator earnings and Redeem UX in My Page.
- Improve Agent cards with typical outputs, pricing, usage, latency, and quality signals.
- Add Agent performance indicators so buyers can compare Agents by actual usefulness, not only by description.
- Add Team Agent examples that show how memWal carries project context across Agents.

Engineering work:

- Connect Sui payment verification to creator settlement records.
- Add typed memory deltas for Agent outputs.
- Add memWal-powered Team memory retrieval and write policies.
- Add Agent evaluation metrics such as task success rate, schema reliability, latency, repeat usage, buyer feedback, cost per useful result, and safe-output checks.
- Keep HTTP MCP startup failure as a clear signal that the local gateway is down during development.
- Continue separating safe public metadata from private Harness content.

#### 7.7 Decentralization Roadmap

The long-term roadmap is about removing the platform from the trust path step by step.

Stage 1: platform-mediated MVP.

- HireMe gateway is trusted.
- The platform can run protected Agents.
- The platform promises not to expose creator private files to buyers.
- This stage validates marketplace demand, MCP usage, protected artifact flow, and payout logic.

Stage 2: stronger cryptographic and storage boundaries.

- Store protected Harnesses as encrypted Walrus artifacts.
- Use Seal or equivalent policy-based key release where possible.
- Put more access authority into Sui objects and receipts.
- Store only safe metadata, digests, and encrypted records in public systems.

Stage 3: trust-minimized execution.

- Move Agent execution toward TEE, ICP blockchain, or equivalent verifiable execution environments.
- Reduce the amount of plaintext data visible to the platform.
- Make execution, access, memory, and payout more verifiable.

Stage 4: platform-free Agent hiring protocol.

- Any compatible client can discover and call protected Agents.
- Agent access, payment, execution, memory, and settlement are coordinated by decentralized protocols.
- The platform becomes an interface, not the trust center.
- The final protocol enables a broader Agents economy where creators can publish protected know-how and buyers can hire expert Agents without relying on a central party to see or hold all sensitive data.

## Optional Reference Sections

These can live below the main docs or become separate pages later.

### Glossary

- Agent
- Agent Harness
- protected artifact
- public contract
- Try
- Hire
- Team Hire
- gateway
- MCP
- memWal
- Walrus
- Sui receipt
- ledger
- platform-managed encryption
- Seal

### Local Development

- `npm run dev`
- `npm run gateway:dev`
- `npm run build`
- `npm run gateway:smoke`
- `npm run plugin:smoke`
- MCP setup
- gateway health checks
- Supabase/Walrus/Sui environment variables

### Demo Agents

- Example Code Reviewer
- Landing Page Designer
- Aster X1 Launch Agent
- Agent Impact Demo

## First Sections to Fill

Recommended writing order:

1. Meet HireMe
2. Why It Matters
3. Features
4. How to Hire an Agent
5. How to Publish an Agent
6. How to Get Paid
7. Trust, Privacy, and Roadmap

This order follows the reader's natural questions before going deep into architecture.
