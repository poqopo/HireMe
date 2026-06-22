# Agentic Web Track Skill

Use this skill when the target track is Agentic Web.

## Core Track Thesis

The project should use Sui as a meaningful part of the AI stack, not as a payment rail added at the end. The submission must explain why Sui specifically makes the AI component better, safer, more autonomous, or more composable.

Strong Sui reasons can include Move objects, zkLogin, Programmable Transaction Blocks, DeepBook, Walrus, Seal, policy objects, capped authority, or on-chain logs.

Generic LLM wrappers that merely hold SUI or accept payments should score low.

## Track-Fit Checks

High track fit requires:
- an AI component that acts, evaluates, plans, or guards
- Sui primitives that materially change what the AI system can do
- visible autonomous or semi-autonomous action
- clear safety controls, logs, revocation, or human confirmation
- proof through on-chain activity, policy objects, PTBs, or real protocol calls

## Preferred Sub-Tracks

### Autonomous Risk Guardian

Wanted submission:
Build a live risk monitor for a Sui lending or perpetuals protocol. It should ingest oracle price feeds, run an AI risk model, and autonomously execute a parameter adjustment or market pause through a Move policy object. Actions should be logged on-chain and reversible by DAO or human override.

Must-have evidence:
- live price feed
- visible AI risk score
- at least one autonomous on-chain action
- human override mechanism

### Autonomous Agent Wallet

Wanted submission:
Build an agent wallet on Sui using zkLogin or a Move policy object. The owner grants the AI agent a capped budget, protocol scope, and expiry. The agent executes autonomously while enforcing its limits.

Must-have evidence:
- real DeepBook orders
- self-enforced budget ceiling
- on-chain activity log
- owner revocation demo

### Intent Engine

Wanted submission:
Build an engine that parses a plain-English financial goal, compiles it into a Sui PTB, previews the transaction in human language, runs a guardian check, and asks the user to explicitly confirm before execution.

Must-have evidence:
- text to PTB to execution flow
- human-readable PTB preview
- guardian catching at least two risk classes such as slippage, concentration, or stale pools
- explicit confirmation step

## Red Flags

- chatbot with no Sui action
- payment rail only
- no policy, permission, PTB, or on-chain proof
- autonomous action without revocation or safety boundaries
- risk scoring that never affects execution
