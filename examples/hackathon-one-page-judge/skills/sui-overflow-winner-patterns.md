# Sui Overflow Winner Patterns Skill

Use this skill for Sui Overflow reviews. It turns public prior-winner information into reusable judging heuristics.

## Public Sources

- Sui Overflow 2025 winners announcement: https://blog.sui.io/2025-sui-overflow-hackathon-winners/
- Sui Overflow 2024 winners announcement: https://blog.sui.io/2024-sui-overflow-hackathon-winners/
- Sui Overflow 2026 overview and tracks: https://overflow.sui.io/

## Source-Based Observations

### Competition Density

Sui Overflow 2025 had 599 project submissions and 36 winners across nine tracks. The process included shortlisting, demo days, judging, and community voting.

Sui Overflow 2024 had 352 project submissions, 65 shortlisted projects, and 32 track winners across eight tracks. Public descriptions emphasized both product and technology categories, Demo Days, and judges from domain experts, investors, and established builders.

Heuristic:
- A shortlist-quality submission needs to be understandable quickly.
- A prize-quality submission needs a working product surface, visible technical proof, and a story that maps directly to a track.

### AI Winner Pattern

Public 2025 AI winners were not described as generic LLM wrappers. They connected AI to structured data, verifiable datasets, model deployment, DeFAI trading layers, or data marketplaces.

Heuristic:
- AI projects score better when the AI output depends on verifiable data, Sui-native execution, safety, market structure, or a reusable data workflow.
- If the one-pager only says "AI agent" or "LLM-powered," downgrade the shortlist likelihood unless there is a concrete track-native proof.

### Storage, Walrus, And Encrypted Data Pattern

Public 2025 winner descriptions mention Walrus and Seal in contexts such as decentralized data management, encrypted document workflows, and verifiable or privacy-preserving data products.

Heuristic:
- Walrus should change the product loop, not merely store a file.
- Strong storage projects show what storage enables: verifiability, portability, encrypted sharing, app deployment, durable artifacts, or cross-session/cross-tool use.
- For agentic projects, the strongest Walrus angle is durable agent artifacts, persistent memory, inspectable proof, and controlled disclosure.

### Product Winner Pattern

Public 2024 and 2025 winners were usually described through a concrete product loop: prediction markets, donations, wallets, developer tools, games, DeFi vaults, dashboards, document sharing, or data marketplaces.

Heuristic:
- A submission should avoid sounding like infrastructure with no user.
- The one-pager should show a named user, a repeated workflow, and a visible outcome.

### Sui-Native Implementation Pattern

Winning descriptions often call out Sui-specific primitives or ecosystem integrations: Move, object model, onchain order books, vaults, wallets, Seal, Walrus, zkLogin, Kiosk, smart-contract logic, randomness, and composability.

Heuristic:
- A project should explain why Sui or Walrus makes the experience better than a normal web app.
- The strongest answer exposes object IDs, transactions, blob IDs, explorer links, contract calls, PTBs, or SDK/API traces.

## Shortlist Likelihood Rubric

### Strong Shortlist Candidate

Use this when:
- the core loop works end to end
- the demo can show user value in under one minute
- technical proof is visible and inspectable
- the project is clearly track-native
- the one-pager has a concrete product user and a reason to exist beyond the hackathon

### Plausible Shortlist Candidate

Use this when:
- the product story is compelling
- the track fit is real
- the implementation seems plausible
- proof artifacts are missing, buried, or hard to inspect
- the demo order currently leads with explanation instead of evidence

### Weak Shortlist Candidate

Use this when:
- the idea could describe many generic projects
- Sui, Walrus, DeepBook, or the track sponsor is not necessary to the product loop
- the project has no visible user result
- the technical proof is mostly claimed
- the one-pager reads like a feature list rather than a judged submission

## How To Use In Output

Include a section called `Past-winner pattern and shortlist likelihood`.

That section should:
- compare the project against public prior-winner patterns
- explain what pattern it matches
- explain what pattern it does not yet satisfy
- give a conditional shortlist read
- state what would move it from plausible shortlist to prize competitive

Do not:
- invent specific current competitors
- claim guaranteed shortlisting
- cite private judging preferences
- overfocus on feature count

## Required Ending

End every full Sui Overflow review with `How to fix it`.

This final section should be a practical edit plan:
- first, what to rewrite in the one-pager
- second, what proof to add
- third, what demo order to use
- fourth, what to cut
- fifth, what sentence or headline to use
