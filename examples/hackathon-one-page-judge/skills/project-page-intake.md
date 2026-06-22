# Project Page Intake Skill

Use this skill when the user provides a project name, project URL, hackathon portal URL, repository URL, docs URL, or demo URL instead of a full one-page description.

## Goal

Build a normalized one-page description from public project material before scoring.

The intake result should let the judge review the project without requiring the user to paste the whole application page manually.

## Supported Inputs

- Exact project URL, especially DeepSurge project pages.
- Project name plus hackathon name or track.
- Project name plus one or more links.
- Repository, docs, package, demo, explorer, or npm links.

## Retrieval Order

1. Official hackathon project page.
2. Official project docs or demo site linked from the project page.
3. Repository or package registry linked from official sources.
4. Explorer links, transaction links, package links, object links, or blob links.
5. Public search results for the exact project name.

If only a project name is provided:
- search exact quoted project name first
- add hackathon name or track terms when known
- prefer DeepSurge, official hackathon portal, project docs, GitHub, package registries, and explorer links
- if multiple candidates remain, ask the user for the project URL instead of guessing

## DeepSurge Notes

DeepSurge project pages may be client-rendered. Static HTML can show only a loading state. If that happens, use a browser-rendered page, project page data embedded in Next.js payloads, official links found on the page, or exact-search snippets.

Do not fail just because raw HTML lacks the project text. Try rendered extraction first when tools allow it.

## Extraction Schema

Produce a `Source intake` block with:

- Source used: URL, project name, and retrieval method.
- Project title.
- One-line tagline.
- Target hackathon and track if visible.
- Problem.
- Solution.
- Technical architecture.
- Sui/Walrus/DeepBook/Seal/Move usage.
- Shipped proof: demo links, docs, packages, contracts, object IDs, blob IDs, transactions, relayers, screenshots, or public endpoints.
- Monetization or user value.
- Claims that are unverified or need proof.
- Missing information.

Then produce a `Normalized one-page description` block that the judge can score.

## Normalized One-Page Structure

Use this format:

```text
Project: [name]
Tagline: [one-line description]
Track: [target track or inferred track]

Problem:
[specific problem and target user]

Solution:
[what the product does]

Why this track technology matters:
[why Sui/Walrus/DeepBook/Seal/etc. is necessary]

Technical proof:
[concrete links, IDs, shipped assets, deployed services]

User value:
[what changes for the user or ecosystem]

Open proof gaps:
[what still needs verification]
```

## Quality Rules

- Do not invent missing facts.
- Do not turn marketing copy into verified proof.
- Keep links attached to the claim they support.
- Preserve concrete numbers, IDs, package names, and deployed URLs.
- If the page says "shipped," still classify the evidence as verified only when a link, ID, package, or demo is provided.
- If source extraction is partial, say so before scoring.

## Example Intake Pattern

For a project like `WalrusStreamKit`, a good normalized description should capture:

- developer-first video SDK
- Walrus as data plane for video bytes and HLS/Quilt blobs
- Sui as control plane for Channel, VideoAsset, AccessPolicy, AccessGrant, and Subscription
- Seal-gated paid video access
- public VOD, encrypted paid VOD, and pseudo-live to durable VOD
- shipped evidence such as npm packages, hosted relayer, Move contract, demo app, docs, and explorer link

Then the review should score whether this is just infrastructure, or whether it clearly proves a reusable product loop for creators who own, price, and monetize video assets.
