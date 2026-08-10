# HireMe Product And Runtime Specification

## 1. Product Definition

HireMe는 사람의 전문성을 비공개 Agent로 구조화하고, 다른 사용자가 그 Agent를
고용해 결과를 받을 수 있게 하는 작업 플랫폼입니다.

```text
Model = 범용 추론 엔진
Harness = 전문가의 작업 방식과 품질 기준
Agent = 특정 업무를 반복해서 수행하는 실행 단위
HireMe Runtime = Agent를 찾고 실행하고 결과를 검증하는 환경
```

사용자는 Harness 파일을 구매하지 않습니다. Agent를 일정 기간 구독하거나 실제
사용량만큼 지불하고, 실행 결과를 받습니다. 제작자는 Harness의 소유권과 통제를
유지합니다.

## 2. Primary Users

### Hirer

전문 Agent를 찾아 반복 업무를 맡기는 사용자입니다. 디자인 외주, 브랜드 문구,
제안서, 리서치, 계약 범위 검수처럼 결과가 명확한 작업을 중심으로 합니다.

### Creator

자신의 노하우를 Agent로 만든 사용자입니다. local template으로 Agent를 만들고,
테스트하고, version을 공개하고, 가격과 수익을 관리합니다.

### Operator Runtime

사용자 요청을 직접 처리할지 전문 Agent에 위임할지 판단하고, 필요한 도구와
provider를 호출한 뒤 최종 결과를 검증합니다.

## 3. Desktop Information Architecture

### Chat

- 첫 화면이자 실제 작업 공간
- Agent 선택, 파일 첨부, 작업 폴더 연결
- 여러 conversation 생성·전환·보관
- 실행 단계, elapsed time, queue, cancel
- text와 artifact 결과 표시

### Discover

- category와 작업명으로 Agent 검색
- creator, rating, usage count, 결과 유형, 가격 표시
- 사용량, 구독, hybrid 가격 비교
- 고용 후 바로 새 작업 시작

### My Agents

- status와 current version
- 공개, pause, 새 version 배포
- 사용량/구독 가격
- 최근 실행, 구독자, 예상 수익

### Earnings

- 사용량 수익과 구독 수익 분리
- gross, fee, net, available 상태
- 지급 가능 금액과 정산 기록
- 실제 billing 연동 전에는 demo임을 표시

## 4. Agent Source Contract

Agent Source는 `agentId`가 어디에서 왔는지 결정합니다.

### Local Source

- 현재 사용자가 소유
- private files를 로컬에서 편집 가능
- validation, test, package 가능
- package cache 허용

### DB Source

- 공개 card와 entitlement만 조회
- 타인 소유 package의 unrestricted local import 금지
- 일반 call은 기기 라이선스가 있는 Local Protected Runtime 사용 가능
- 민감 operation은 package를 기기로 보내지 않는 Hosted Secure Runtime 강제
- result와 safe metadata만 local 저장

## 5. Specialist I/O

Specialist input은 task에 필요한 공개 가능한 정보만 포함합니다.

```json
{
  "schema": "hireme.specialist_agent.input.v1",
  "task": "구체적인 사용자 목표",
  "intent": "design | writing | business | research | other",
  "responseMode": "direct_answer | local_workspace_execution_brief | artifact_spec",
  "userVisibleContext": {
    "summary": "필요한 맥락",
    "constraints": ["납기, 형식, 스타일, 예산"]
  },
  "requestedOutput": {
    "format": "markdown | json | image_spec | file_plan"
  }
}
```

Specialist output은 Operator가 그대로 검증할 수 있는 safe envelope입니다.

```json
{
  "schema": "hireme.specialist_agent.output.v1",
  "status": "completed | needs_input | blocked | refused",
  "responseMode": "direct_answer | local_workspace_execution_brief | artifact_spec",
  "outputText": "사용자에게 전달 가능한 결과",
  "artifacts": [],
  "assumptions": [],
  "risks": []
}
```

## 6. Privacy Boundary

공개 가능:

- Agent name, creator, category
- headline, summary, public skills
- public contract와 input/output 형식
- version, release note, rating, usage count
- 가격, entitlement, safe execution status
- final result와 사용자가 요청한 artifact

비공개:

- `AGENTS.md`, `SOUL.md`, private prompts
- hidden skills, rubric, private examples
- evaluation set, internal routing, scratchpad
- credential, private file path, environment secret
- 다른 제작자의 package content

비공개 내용 요청은 단순한 일반 질문으로 처리하지 않습니다. 명확히 거절하고
공개 프로필을 설명하거나 Agent를 실제 실행하는 대안을 제시합니다.

## 7. Authoring Workflow

```text
template -> draft -> valid -> tested -> packaged -> publish
```

- filesystem fingerprint가 바뀌면 revision 증가
- 이전 validation/test/package는 stale 처리
- package 전 같은 revision의 successful test 요구
- package에는 archive와 sha256 integrity metadata 포함
- sha256은 encryption이 아닌 integrity 확인

## 8. Pricing

### Per Run

토큰 수와 관계없이 완료된 Agent 실행 1회에 고정 가격을 적용합니다. 모델 사용료는
사용자가 선택한 Provider 계정에서 별도로 부담합니다. failed, canceled, free trial
execution의 billable rule은 서버 원장에서 명시적으로 기록해야 합니다.

### Subscription

월 또는 연 단위로 실행 권한과 포함 실행 횟수를 제공합니다. 포함량을 넘으면 추가
실행을 막거나 실행당 가격을 적용할 수 있습니다.

### Hybrid

구독 사용자에게 기본 실행 횟수를 제공하고 초과분을 실행당 가격으로 계산합니다.

어떤 방식이든 사용자가 얻는 것은 실행 권한과 결과이며 private Harness source가
아닙니다.

## 9. Database Boundary

현재 baseline schema:

- `profiles`
- `agents`
- `agent_versions`
- `agent_pricing`
- `agent_entitlements`
- `conversations`
- `messages`
- `agent_executions`
- `creator_earnings`
- `payouts`

실행 원장의 `safe_metadata`에는 raw prompt, raw response, private source를 넣지
않습니다. 사용자의 conversation content와 billing/audit metadata는 분리합니다.

## 10. Desktop Security

- renderer에서 Node integration 비활성화
- context isolation과 sandbox 사용
- preload는 allowlisted function만 노출
- arbitrary command IPC 금지
- Agent id, conversation id, message size validation
- 실행 취소 시 child process에 terminate 후 timeout 뒤 force kill
- 외부 navigation과 새 window 차단
- workspace 안의 첨부 경로만 Agent context에 전달

## 11. Alpha Acceptance Criteria

- 앱을 열면 바로 채팅을 시작할 수 있다.
- 사용자는 Agent를 검색하고 고용한 뒤 새 작업으로 이동할 수 있다.
- local Agent 채팅은 기존 runtime 결과를 앱에 표시한다.
- 여러 채팅의 상태와 실행이 서로 섞이지 않는다.
- 실행 중 추가 메시지는 FIFO queue에 들어간다.
- Creator는 Agent 초안을 만들고 version과 가격을 관리할 수 있다.
- 수익 화면은 usage/subscription을 구분하고 demo 상태를 숨기지 않는다.
- 어느 화면에서도 private internals 열람 기능을 제공하지 않는다.
