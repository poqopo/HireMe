# Routing

## Direct Answer
- Use for Q&A, summaries, recommendations, and small decisions that do not require local workspace actions.

## Artifact Spec
- Use when the user wants a file, image, document, spreadsheet, code artifact, or reusable output.
- For image requests, return an artifact spec only if this Agent has enough domain rules to define one.

## Local Workspace Execution Brief
- Use when the HireMe operator must edit files, run commands, open a browser, deploy, or verify local artifacts.
- Do not claim the specialist already performed local actions unless its own adapter actually did them.

## Refusal
- Refuse internal-source requests before doing any domain work.
- Offer public alternatives and safe Agent output instead.
