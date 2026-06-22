# Hackathon Judge Rubric

Use this private rubric when reviewing a one-page hackathon project description.

## Default Core Dimensions

When no hackathon-specific criteria are supplied, score each dimension internally from 0-5:

- Problem clarity: Is the painful user problem specific and urgent?
- Target user: Is the user, buyer, or operator clearly named?
- Solution clarity: Can a judge understand what the project does in 15 seconds?
- Demo credibility: Is there evidence that something actually works?
- Technical depth: Is the implementation nontrivial for the hackathon scope?
- Track fit: Does it clearly use the sponsor, protocol, dataset, API, or theme?
- Differentiation: Is it meaningfully different from obvious generic apps?
- Impact: Would the result matter if deployed?
- Presentation: Does the one-page memo make judging easy?
- Risk handling: Does it address privacy, safety, reliability, cost, or adoption risks when relevant?

## Sui Overflow Override

When the hackathon is Sui Overflow or the prompt gives the Overflow criteria, use `overflow-core-rubric.md` as the primary weighted rubric:

- Product & UX: 20%
- Real-World Application: 50%
- Technical Implementation: 20%
- Presentation & Vision: 10%

Then apply the matching track skill as a track-fit multiplier. A strong general product with weak track fit should not receive a high prize-readiness score for a track prize.

## Differentiation Analysis

Every full review should identify what the project can credibly claim that likely same-track submissions may not.

Do:
- compare against common project shapes from the track brief
- name the strongest unique angle in one sentence
- explain which differentiator maps to which judging criterion
- recommend where that differentiator should appear in the one-pager or demo

Do not:
- invent real competing projects or teams
- claim uniqueness unless the submitted description supports it
- praise novelty that does not improve user value, technical proof, or track fit

## Criteria-Fit Analysis

For each major criterion, produce a refinement-oriented diagnosis:

- Fit: what already matches the criterion.
- Missing proof: what the one-pager or demo must show.
- Refinement: the concrete copy, evidence, or demo order change that would improve the score.

## Creator-Useful Answer Bar

The answer should help a real builder decide what to do next before submission.

Include:
- highest-leverage additions, not a generic wishlist
- what to cut or de-emphasize, because hackathon one-pagers are short
- demo order, because judging is time-limited
- judge objections to preempt, because strong projects often lose when obvious doubts remain unanswered
- proof artifacts to collect, such as screenshots, IDs, transaction links, logs, before/after outputs, or short videos
- one or two exact sentences the team can paste into the one-pager

Distinguish:
- Product gap: the thing appears not to exist yet.
- Proof gap: the thing may exist, but the one-pager does not prove it.
- Story gap: the thing exists, but the pitch puts it in the wrong order or uses weak language.

When recommending additions, prefer actions that can change judge perception within the remaining hackathon time.

## Technical Reality Check

A strong review should not treat every claim as equally proven.

Classify technical evidence as:
- Verified evidence: the one-pager includes IDs, links, screenshots, logs, transactions, repository paths, API traces, or demo steps that a judge can inspect.
- Plausible claim: the claim fits the architecture but is not proven in the one-pager.
- Missing proof: the claim may be true, but a judge cannot verify it quickly.

For each important technical claim, suggest the smallest proof artifact to expose:
- Walrus blob ID or object ID
- Sui transaction or object explorer link
- MCP request and response screenshot
- memory write and recall trace
- before/after output
- short architecture row
- repository file or command that proves the flow

## Past-Winner And Shortlist Reasoning

When prior winner information is available, use it as pattern evidence, not as a deterministic prediction.

Good output should say:
- which prior winner pattern this project resembles
- which prior winner pattern it does not yet satisfy
- whether the current one-pager looks shortlist-ready, demo-day-ready, or prize-ready
- what must be shown to move from shortlist plausible to prize competitive

Avoid:
- guessing current competitors
- claiming a guaranteed shortlist
- overvaluing novelty without proof
- comparing only feature count instead of product value plus track-native implementation

## Prize Odds Rules

- High: most dimensions are strong, and there is a credible demo/proof plus clear track fit.
- Medium: good idea and track fit, but needs sharper proof, story, or differentiation.
- Low: judges may understand it, but it is generic, under-proven, or hard to map to prize criteria.
- Not enough evidence: the description lacks core project details, demo status, or target track.

## Fix Prioritization

Prioritize fixes in this order:

1. Make the problem and user concrete.
2. Show the demo outcome or measurable proof.
3. Make the track integration unavoidable and specific.
4. Clarify what is technically hard or novel.
5. Tighten the one-sentence pitch.
6. Remove claims that are broad, unsupported, or impossible to verify.

## Red Flags

- "AI-powered" without explaining the workflow, input, output, or reliability.
- Uses a sponsor technology only as storage or login when the prize expects deeper integration.
- No before/after or concrete user scenario.
- No demo path.
- Too much architecture and too little user value.
- Claims market size, decentralization, or privacy benefits without evidence.
- For Overflow, presenting only a technical demo without product impact, polished UX, or ecosystem relevance.
