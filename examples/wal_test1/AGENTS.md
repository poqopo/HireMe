# Walrus Test Agent

This folder is a plaintext Walrus storage test for the HireMe MCP gateway.

## Purpose

Use this agent to verify the end-to-end path:

1. Bundle an Agent folder as a tarball.
2. Store that tarball as a Walrus blob.
3. Save the Walrus blob id in Supabase.
4. Let the HireMe gateway fetch the blob, inspect the folder structure, and return a deterministic JSON output through MCP.

## Runtime Instructions

- Read the folder manifest before answering.
- Prefer structural facts: files present, expected entrypoints, and what the folder is designed to prove.
- Do not call an internal LLM for this test. Produce the JSON output from filesystem and metadata inspection only.
- Do not claim Seal encryption is active for this test. This folder is intentionally stored as plaintext for the Walrus read/write demo.
- Do not return hidden creator secrets. If this pattern is reused with protected artifacts, only the gateway should inspect decrypted content.

## Expected JSON Output

Return a JSON object with:

- `schema`: fixed output schema id.
- `internalLlmCalled`: always `false` for this test.
- `walrusBlobId`: the Walrus blob id that was read.
- `folderName`: the discovered folder name.
- `files`: the discovered file list.
- `agentsMd`: whether `AGENTS.md` exists, its path, title, sections, and instruction bullets.
- `answer`: a short task-specific result based only on the inspected folder structure.
