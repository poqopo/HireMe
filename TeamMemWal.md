# Team Memory Strategy with memWal

## Product Thesis

HireMe가 단일 Agent 고용을 넘어 Team 단위 Hire로 확장될 때, Team memory 문제를 `memWal`로 해결하는 것이 핵심 차별점이 된다.

단일 Agent Hire에서는 memWal이 주로 실행 결과, safe summary, encrypted memory artifact를 보관하는 보호 저장소 역할을 한다. Team Hire에서는 한 단계 더 나아가 memWal을 공유 memory layer로 사용해 여러 Agent가 같은 프로젝트 맥락을 이어받고 협업하게 만든다.

핵심 메시지:

```txt
HireMe Teams do not just bundle multiple Agents.
They use encrypted memWal to share verified project context.
```

## Why Team Memory Matters

여러 Agent를 Team으로 고용하면 사용자는 보통 같은 프로젝트 안에서 역할만 다른 Agent들을 호출한다.

예:

- Research Agent가 시장/기술 근거를 수집한다.
- Product Agent가 요구사항과 포지셔닝을 정리한다.
- Design Agent가 랜딩페이지 구조와 메시지를 만든다.
- Code Agent가 실제 repo 변경을 수행한다.
- Eval Agent가 결과물의 리스크와 누락을 점검한다.

이때 각 Agent가 매번 처음부터 context를 다시 받으면 Team Hire의 가치가 약해진다. HireMe는 memWal을 사용해 이전 Agent가 만든 결정사항, 근거, 산출물 요약, open task를 안전하게 이어받게 해서 Team이 하나의 작업 단위처럼 동작하게 만든다.

## Boundary

Team memory는 모든 내부 정보를 공유하는 공간이 아니다. HireMe는 memWal을 사용해 공유 가능한 기억과 절대 공유하면 안 되는 기억을 분리한다.

| Memory Class | Scope | Shared Across Team Agents | Notes |
| --- | --- | --- | --- |
| Creator private memory | Agent creator only / gateway runner | No | `AGENTS.md`, private skills, harness, prompts, rubrics, eval sets |
| Buyer project memory | Team hire | Yes | 목표, 제약, 결정사항, safe artifact summary |
| Agent scratchpad | Single execution | No by default | 임시 reasoning, tool notes, draft state |
| Published handoff | Team hire | Yes, after validation | 다른 Agent가 이어받아도 되는 구조화된 요약 |
| Billing/audit metadata | Gateway / permitted users | Limited | call id, digests, usage, budget, settlement basis |

이 구조에서 memWal은 "공유 뇌"가 아니라, gateway가 검증한 context만 저장하고 검색하는 encrypted workspace memory다.

## Architecture

```txt
Team Hire
  -> Team entitlement / pooled budget
  -> Multiple protected Agents
  -> Shared memory through memWal

Agent Call
  -> Gateway verifies team access
  -> Gateway retrieves relevant memWal entries for the Team
  -> Gateway runs selected Agent with bounded context
  -> Agent returns safe output + proposed memory delta
  -> Gateway validates, classifies, and redacts delta
  -> Gateway writes approved entries to memWal
  -> Later Agents receive only relevant approved context
```

memWal should be queried by purpose, not dumped wholesale into every Agent call. The gateway should select a bounded working set based on Agent role, task, recency, confidence, and visibility policy.

## Memory Entry Shape

Team memory entries should be structured enough to support safe retrieval, provenance, TTL, and access control.

```json
{
  "schema": "hireme.team_memwal_entry.v1",
  "team_id": "team_growth_launch",
  "hire_id": "hire_123",
  "source_agent_id": "launch-operator",
  "source_call_id": "call_abc",
  "type": "decision",
  "visibility": "team",
  "title": "Landing page positioning",
  "summary": "Position Aster X1 around pocket cinema, battery confidence, and preorder scarcity.",
  "evidence_refs": ["call_abc:payload.positioning"],
  "confidence": 0.84,
  "ttl": "30d",
  "created_at": "2026-06-17T00:00:00Z"
}
```

Recommended memory types:

- `project_goal`
- `constraint`
- `decision`
- `fact`
- `artifact_summary`
- `handoff`
- `open_task`
- `risk`
- `evaluation_result`
- `user_preference`

## Write Policy

Agent output should not be written directly to memWal as raw transcript. Each Agent should return a proposed memory delta.

```json
{
  "proposed_memory_delta": [
    {
      "type": "decision",
      "title": "Primary launch angle",
      "summary": "Use preorder urgency only after the product proof points are established.",
      "visibility": "team",
      "confidence": 0.78
    }
  ]
}
```

The gateway then decides whether to store it.

Validation steps:

1. Remove creator-private content.
2. Remove raw chain-of-thought or scratchpad content.
3. Classify the memory type.
4. Attach source call, source Agent, digest, and timestamp.
5. Apply visibility and TTL.
6. Optionally require user approval for durable decisions.

## Read Policy

Before each Agent call, the gateway should build a compact context pack.

```txt
Context Pack
  -> current user task
  -> selected Agent public contract
  -> relevant memWal entries for the Team
  -> recent decisions
  -> open tasks assigned to this Agent role
  -> safe artifact summaries
  -> budget and policy constraints
```

The context pack should exclude:

- Other Agents' creator-private instructions
- Raw private skills or harness text
- Full unfiltered transcripts
- Low-confidence memory unless explicitly requested
- Expired entries
- Entries outside the Agent's visibility scope

## Product Positioning

Using memWal for Team memory gives HireMe a stronger story than a simple "multi-agent bundle".

Suggested messaging:

```txt
Hire an Agent Team that remembers the project together.
Each Agent keeps its private know-how protected, while the Team shares verified project memory through encrypted memWal.
```

Short version:

```txt
Team Hire = protected Agents + shared encrypted project memory.
```

Developer-facing version:

```txt
memWal lets multiple protected MCP Agents coordinate through structured, encrypted Team handoffs without exposing creator internals.
```

## MVP Scope

Phase 1 can be simple:

- Add `team_memwal_entries` or extend `user_memwal_results` with `team_id`.
- Store safe summaries from `hireme_call_agent`.
- Let `hireme_request` retrieve recent Team decisions and open tasks.
- Return visible memory provenance in safe metadata.
- Do not store raw prompts/responses as Team memory.

Phase 2:

- Add typed memory deltas to Agent output schemas.
- Add gateway validation/redaction before writes.
- Add per-entry visibility, TTL, confidence, and source call references.
- Add Team memory search by Agent role and task.

Phase 3:

- Add user approval for durable decisions.
- Add memory conflict detection.
- Add per-Agent memory read scopes.
- Add Team-level memory export/audit views with digests, not raw private content.

## Design Principle

memWal should make Team Agents feel coordinated without weakening the core HireMe privacy promise.

The rule:

```txt
Share project context, not creator internals.
Persist verified handoffs, not raw execution traces.
```
