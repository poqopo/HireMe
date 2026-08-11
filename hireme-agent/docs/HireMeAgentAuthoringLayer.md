# HireMe Agent Authoring Layer

## Purpose

The Agent Source Layer answers where an Agent comes from. The Agent Authoring
Layer owns how a creator turns a local Agent from a template into a tested,
portable package.

This layer is local-first. It does not require a remote service or a DB. A future
DB publish operation can accept the package produced at the end of this flow.

## Workflow

```text
template
  -> draft
  -> Bootstrap Memory calibrated
  -> valid
  -> tested
  -> evaluated
  -> packaged
  -> future DB publish
```

Each local Agent has an integer revision. Creating or changing an Agent advances
the revision. Validation, test, evaluation, and package records are valid only for the exact
revision that produced them.

Direct workspace edits are supported. The layer fingerprints the Agent's file
index using paths, file sizes, and sha256 digests. When the fingerprint changes
outside an authoring tool, the next status, validation, test, or package request
advances the revision and marks older results as stale.

## Phase Rules

| Phase | Requirement | Next action |
| --- | --- | --- |
| `draft` | Current revision has not passed validation. | Validate the Agent. |
| `valid` | Required files, manifest, and I/O contract are valid. | Run a representative test. |
| `tested` | The same revision returned a completed safe output. | Run the private eval suite. |
| `evaluated` | Functional and privacy cases passed for the same revision. | Build a package. |
| `packaged` | The same revision was exported with integrity metadata. | Publish to the future DB source. |

Packaging requires a current successful test and eval by default. `--skip-test`
and `--skip-eval` are explicit development exceptions; a package created that
way is not `publishReady`. The low-level `agent export` command also remains
available for compatibility, but it does not represent workflow readiness.

## Effective Agent Defaults

`basic` and `artifact` templates use the `prompt-v1` runner. At runtime it
compiles creator-owned `AGENTS.md`, private skills, policy/routing material, and
resolved memory into the selected Codex, OpenAI, or Ollama model call, then
accepts only a validated public specialist output envelope. It blocks malformed
or protected-source-like output. The fixture provider produces a local preview
only, so it cannot pass a functional release eval.

The selected provider is part of the creator's trust boundary: choose a local
Ollama endpoint or a remote provider according to the privacy policy for that
Agent's private Harness.

Use `agent init` when starting from a job description rather than a folder
shape. It turns a brief into a template choice, protected Bootstrap Memory,
private creator brief/checklist, and an executable representative-task plus
privacy-boundary eval suite. The brief itself remains in protected Agent files;
authoring state stores only its hash and size.

The private `evals/cases.json` supports functional/privacy cases with status,
response-mode, minimum-output, summary, artifact, required-term, and
forbidden-term assertions. Add task-specific acceptance criteria there as the
Agent matures.

## Runtime Tools

- `hireme_list_agent_authoring_templates`
- `hireme_create_agent_draft`
- `hireme_initialize_agent_draft`
- `hireme_get_agent_authoring_status`
- `hireme_update_agent_draft_file`
- `hireme_create_agent_skill`
- `hireme_validate_agent_draft`
- `hireme_get_agent_bootstrap_memory_status`
- `hireme_add_agent_bootstrap_memory`
- `hireme_test_agent_draft`
- `hireme_evaluate_agent_draft`
- `hireme_package_agent_draft`

These tools compose the existing local specialist creator and runner functions.
The older low-level tools remain available for compatibility and focused internal
operations.

## CLI

```bash
hireme agent init review-agent \
  --brief "Review proposals with concrete evidence and practical next steps" \
  --success-criteria "Cite evidence | State assumptions" \
  --example-task "Review this public-safe proposal"
hireme agent skill add review-agent evidence-check \
  --purpose "Compare claims with evidence and return verifiable improvements" \
  --triggers "proposal review | evidence check" \
  --steps "Separate claims from evidence | Flag unsupported claims | Recommend concrete fixes"
hireme agent test review-agent "Review this public-safe proposal"
hireme agent eval review-agent
hireme agent read review-agent AGENTS.md
hireme agent manage review-agent "Inspect the existing rules and strengthen failure checks"
hireme agent package review-agent --overwrite
hireme agent status review-agent
```

`agent package` is the workflow-aware command. `agent export` is the ungated
compatibility command.

Normal `hireme` conversation is always a work runtime. A prompt that claims to
enter admin, creator, developer, debug, or management mode does not grant access
to Agent source and is rejected before model or tool execution. Private Harness
access uses the explicit local control plane (`hireme agent read|edit|manage`).
Model-driven `agent manage` exposes only its narrow authoring allowlist and binds
every target-scoped tool to the Agent id in that command.

## Reusable Private Skills

`hireme_create_agent_skill` and `hireme agent skill add` turn a narrow repeated
procedure into `skills/<skill-name>.md`. The generated private source has
purpose, trigger signals, inputs to collect, ordered procedure, quality checks,
and boundaries. It returns only metadata, advances the Agent revision, and
invalidates prior test/eval/package evidence. Use one skill per repeatable
decision or procedure; verify the changed revision with the normal test and
eval gates before packaging.

## Conversation-first graph authoring

The Authoring Engine collects a creator's job, audience, desired outputs,
success criteria, non-goals, labeled examples, and explicit feedback without
requiring direct file editing. It compiles those decisions into
`workflow/graph.json` using `hireme.agent_graph.v1`.

The graph uses typed `intake`, `analyze`, `decide`, `explore`, `produce`,
`evaluate`, `human_gate`, and `deliver` nodes. Creative revision cycles are
allowed only through bounded revision edges. A graph revision is pinned for the
entire run.

Skill learning uses explicit creator evidence only. It creates a private
`hireme.skill_change_proposal.v1` candidate, validates a copy of the Agent,
and requires creator approval. Approval advances the revision and invalidates
stale test, eval, and package evidence. Rollback restores the old source as
another revision.

Approval additionally requires a behavioral comparison. Pass the real user
request with `--task` and the observable acceptance indicators with
`--expected-indicators`. HireMe runs the base and isolated candidate with the
same request and a clean memory context. The candidate must be model-backed,
contain every requested indicator, differ from the base output, and match more
indicators than the base. Only then does comparison report `improved` and allow
approval. Output text is never saved in authoring state; the comparison keeps
only digests, lengths, statuses, and indicator matches.

## Memory Authoring

Every template starts with two protected Bootstrap Memory records. They provide
a usable first-run baseline, but production Agents should replace or extend
them with the creator's domain-specific principles, preferences, failure cases,
and calibration examples.

Bootstrap Memory is part of the Agent revision. Adding or replacing a record
invalidates prior test and package results, then automatically validates the new
revision. Authoring status reports `memoryReady` and `memoryCustomized` without
returning memory text.

The runtime precedence is:

```text
current request > Session Memory > User Memory > Bootstrap Memory
```

Harness constraints remain non-overridable. Bootstrap Memory is included only
in a full protected package. User and Session Memory belong to the hirer and are
never included in export, import, or DB publication.

## State Contract

Workflow state is stored at:

```text
.hireme/standalone-agent/<runtime-id>/authoring/agents/<agent-id>.json
```

The state contains:

- Agent id, template, phase inputs, revision, and file-index digest
- validation status and missing required paths
- test status, response mode, artifact kinds, task sha256, and task length
- eval suite source, case hashes, assertion metadata, aggregate pass/fail, and runner readiness
- package path, package digest, archive digest, and package revision
- Bootstrap Memory validity, item counts, and digest
- a bounded metadata-only operation history

It must not contain:

- private Harness file contents
- raw test tasks
- raw eval tasks or outputs
- model prompts or scratchpads
- package payloads or `archiveBase64`
- credentials or OAuth tokens

Writes use a temporary file followed by an atomic rename so interrupted writes
do not leave a partially written workflow document.

Conversation sessions, explicit feedback records, and proposal state are kept
separately under the creator-local `authoring/` state directory. Proposal state
may contain the private base and candidate source needed for approval and
rollback. Public tool results expose only hashes and metadata; this local state
is not copied into Agent packages or DB publication payloads.

## DB Boundary

Only creator-owned local Agents enter the Authoring Layer. Third-party DB Agents
remain non-editable through the Agent Source Layer. Publication produces a
Local Protected bundle for ordinary licensed-device execution and a Hosted
Secure bundle for sensitive operations. The Supabase publisher encrypts the
Hosted Secure package with AES-256-GCM, uploads only the encrypted envelope to
the private `agent-packages` bucket, and registers public metadata, digests, and
an opaque `runtime_ref` in the DB Agent Source. Protected bundles may include
creator Bootstrap Memory; each hirer's User and Session Memory remains in
isolated runtime storage.

Only a service-role trusted runtime can call the Vault key RPC or download the
Storage object. It verifies the registry digests, decrypts and imports into a
temporary directory, runs the Agent, sanitizes the result, and removes the
plaintext directory. The service role and Hosted Secure package key must never
be shipped in the desktop application. Local Protected uses a separate random
package key wrapped to a signed, short-lived device license and never includes
secure-only paths.
