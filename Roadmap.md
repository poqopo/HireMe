# HireMe Roadmap

## Product Decision

HireMe MVP는 trusted gateway execution으로 간다.

핵심 가치는 다음 하나에 집중한다.

```txt
Agent creator가 AGENTS.md, skills, harness code, prompts, rubrics,
design guides 같은 private know-how를 hirer에게 넘기지 않고도
Codex에서 호출 가능한 Agent로 수익화할 수 있다.
```

MVP 실행 경로:

```txt
Hirer Codex
  -> sends plaintext task to HireMe Gateway

HireMe Gateway
  -> verifies hire/access/budget
  -> loads the creator Agent bundle
  -> runs the protected Agent workflow
  -> returns JSON output to Codex
  -> records billing/ledger metadata
```

이 모델에서 HireMe Gateway는 신뢰받는 실행자다. MVP의 보호 대상은 “creator artifact가 hirer에게 노출되지 않는 것”이며, gateway가 user input과 creator bundle을 처리할 수 있다는 점을 명확히 한다.

## Why This MVP

초기 사용자는 HireMe를 하나의 AI 서비스로 볼 가능성이 높다. OpenAI, Anthropic, Codex를 사용할 때처럼 서비스가 user input을 처리할 수 있다는 신뢰 모델이 자연스럽다.

따라서 지금 검증해야 할 것은 복잡한 privacy claim이 아니라 marketplace loop다.

- Agent를 등록할 수 있는가
- Hirer가 Agent를 고용할 수 있는가
- Codex MCP에서 간단히 호출할 수 있는가
- Creator 내부 파일이 응답으로 새지 않는가
- 결과물이 충분히 유용한가
- call 단위 ledger와 pricing을 기록할 수 있는가

정확한 MVP claim:

```txt
HireMe does not expose creator Agent internals to hirers.
HireMe Gateway is the trusted executor.
```

하지 않을 claim:

```txt
HireMe cannot see user input.
HireMe cannot see creator artifacts.
```

## MVP Architecture

```txt
Creator
  -> prepares AGENTS.md + skills/** + harness/**
  -> publishes public marketplace metadata
  -> uploads protected Agent bundle

Storage
  -> Walrus stores packaged or encrypted Agent artifacts
  -> Supabase stores searchable metadata, pricing, hires, and ledger data
  -> Sui/Seal can become the authority and key-release layer after the loop works

Hirer
  -> installs HireMe MCP connector in Codex
  -> sends normal plaintext task through MCP

Gateway
  -> checks hire receipt / subscription / budget
  -> loads creator Agent bundle
  -> executes the Agent workflow
  -> returns safe JSON output
  -> does not return AGENTS.md, skills, harness source, or private prompts
```

MVP privacy boundary:

| Data | Hirer | HireMe Gateway | Creator |
| --- | --- | --- | --- |
| User task/input | Yes | Yes | No |
| Creator AGENTS.md / skills / harness | No | Yes | Yes |
| Final JSON output | Yes | Yes | Optional |
| Billing metadata | Yes | Yes | Yes |

## Implementation Plan

1. Keep the MCP connector simple.
   - `hireme_request`
   - `hireme_call_agent`
   - `hireme_call_walrus_agent`
   - sealed artifact registration/validation helpers

2. Make Gateway the trusted executor.
   - Accept plaintext `task`.
   - Resolve selected Agent.
   - Verify hire receipt and budget.
   - Load the protected bundle.
   - Execute deterministic or LLM-backed logic.
   - Return only safe JSON output.

3. Keep creator artifacts out of hirer responses.
   - No raw `AGENTS.md`.
   - No `skills/**` content.
   - No harness source.
   - No private prompt/rubric/design guide text.

4. Add practical audit controls.
   - Request digest.
   - Response digest.
   - Artifact digest.
   - Agent version.
   - Ledger entry.
   - Access decision reason.

5. Use Walrus where it helps now.
   - Store packaged Agent artifacts.
   - Track blob IDs and digests.
   - Treat Supabase as the fast index/cache.
   - Do not claim Walrus alone provides confidentiality.

6. Add Seal/Sui after the loop works.
   - Sui object records artifact/version/payment authority.
   - Seal controls key release for encrypted bundles.
   - Gateway decrypts after access is approved.

## Milestones

### Phase 1: Local Demo

```txt
examples/* Agent folder
  -> local seal mock
  -> local gateway
  -> Codex MCP plugin
  -> JSON output + ledger metadata
```

Goal:

- Demo creator folder registration.
- Demo natural-language `hireme_request`.
- Demo `example-landing-designer` using protected `design.md`.
- Prove responses do not include private creator files.

### Phase 2: Walrus Artifact Registry

```txt
Agent folder archive
  -> Walrus blob
  -> Supabase walrus_agent_artifacts row
  -> gateway reads by agent_id/blob_id
```

Goal:

- Store and retrieve packaged Agent folders through Walrus.
- Keep Supabase as registry/index.
- Return deterministic JSON summary before adding an internal LLM runner.

### Phase 3: Real Protected Execution

```txt
Encrypted Agent bundle
  -> Walrus ciphertext
  -> Supabase/Sui metadata
  -> Gateway access check
  -> Gateway decrypt + execute
  -> JSON output
```

Goal:

- Replace local seal mock with Seal integration.
- Add Sui object references for version/payment authority.
- Record call ledger and creator payout basis.

### Phase 4: Product Hardening

Goal:

- Abuse review and rate limits.
- Per-agent budget caps.
- Version pinning.
- Creator analytics.
- Response schema validation.
- Replayable audit records with digests, not raw prompts.

## Current Direction

Default path:

```txt
Trusted Gateway MVP
```

Immediate loop:

```txt
publish protected Agent bundle
hire Agent
call Agent from Codex
gateway executes with creator instructions
return JSON output
record usage
```

This is the fastest path to validate whether people want to hire protected Agents from Codex.
