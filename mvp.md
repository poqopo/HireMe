# HireMe MVP

## 1. MVP Goal

HireMe MVP의 목표는 다음 한 문장을 실제로 증명하는 것이다.

> **사용자는 Slush Wallet로 로그인한 뒤 GitHub Agent를 등록하고, Hosted 또는 기존 MCP를 워크플로에 넣어 실행하며, 결과·Sui 정산 트랜잭션·잔액 변화를 한 화면에서 확인할 수 있다.**

MVP는 대규모 Marketplace를 만드는 프로젝트가 아니다. 가장 중요한 End-to-End 경로 하나를 완성하는 프로젝트다.

```text
Slush Wallet 로그인
    ↓
GitHub Agent 등록 · Hosted 또는 기존 MCP URL 선택
    ↓
Registry에서 Agent 선택 · 워크플로 구성
    ↓
질문과 멘션 Agent 확인
    ↓
MCP 단계별 스트리밍 실행
    ↓
JSON · HTML 결과 확인
    ↓
Usage Receipt · Sui 정산 트랜잭션
    ↓
잔액 변화 확인
```

## 2. MVP Hypotheses

MVP는 다음 네 가지 가설을 검증한다.

### H1. Standardization

서로 다른 GitHub Agent를 공통 `run_agent` MCP Interface로 변환할 수 있다.

### H2. Setup-Free Usage

Agent 사용자는 Repository Clone, 패키지 설치, 서버 실행 없이 Agent를 사용할 수 있다.

### H3. Composition

서로 다른 제작자의 Agent를 Langflow에서 Node로 연결해 하나의 결과물을 만들 수 있다.

### H4. Monetization

성공한 Agent 호출을 식별하고, 설정된 가격에 따라 제작자에게 자동 정산할 수 있다.

## 3. Primary Demo — 90초

### Demo Name

**GitHub Agent to Paid Crypto Insight Flow**

### Demo Start State

데모는 Slush Wallet이 연결된 상태에서 시작한다. 헤더에는 지갑 주소, 잔액, 충전 버튼이 보인다. Agent Registry에는 다음 두 Hosted MCP가 이미 등록되어 있다.

| Agent | Role | Pricing |
|---|---|---:|
| Crypto News Research | 암호화폐 뉴스와 근거 수집 | Free 또는 등록 가격 |
| Crypto Market HTML | 뉴스·시장 데이터를 HTML 리포트로 시각화 | Free 또는 등록 가격 |

```text
[Slush Wallet 로그인 · 잔액]
         ↓
[GitHub Agent 등록]
         ↓
[Crypto News Research]
         ↓
[Crypto Market HTML]
         ↓
[결과 · Usage Receipt · Sui 정산 트랜잭션]
         ↓
[갱신된 잔액]
```

### 90초 Demo Sequence

| 시간 | 장면 | 화면에서 보여줄 것 | 증명하는 것 |
|---|---|---|---|
| 0–10초 | 지갑 상태 | Slush Wallet 주소, SUI 또는 Test USDC 잔액, 충전 버튼 | 사용자가 로그인했고 결제 주체가 명확함 |
| 10–25초 | GitHub로 Agent 추가 | 이름·GitHub 링크 입력, `이미 서버가 있어요` 체크, 기존 MCP URL 또는 HireMe Hosted URL 선택, 자체 MCP의 100M 토큰당 가격 입력 | GitHub Agent를 간단히 등록하고 실행 URL·가격 정책을 정할 수 있음 |
| 25–40초 | 워크플로 구성 | Registry의 MCP Agent를 추가·제거해 순서를 구성하고, 노드별 입력·출력 관계와 예상 비용 확인 | 사용자가 필요한 Agent 조합을 선택할 수 있음 |
| 40–50초 | 요청값 확인 | `@Crypto News Research 오늘 뉴스를 분석하고 @Crypto Market HTML 이걸로 시각화해줘`를 입력하고, 질문 노드에서 실제 요청 payload 확인 | 어떤 Agent에 어떤 요청이 전달되는지 투명함 |
| 50–70초 | 실행 상태 | News 노드는 `완료`, HTML 노드는 `작업 중`으로 바뀌는 스트리밍 상태. 완료 노드를 누르면 JSON 결과, 작업 중 노드를 누르면 진행 안내 표시 | 백엔드 MCP 호출이 단계별로 실행되고 UI에 즉시 반영됨 |
| 70–80초 | 결과값 확인 | HTML 결과는 격리된 미리보기와 다운로드 버튼으로, JSON 결과는 접을 수 있는 구조화된 결과 패널로 표시 | LLM 텍스트뿐 아니라 Agent artifact를 그대로 활용 가능 |
| 80–90초 | 정산과 잔액 | Usage Receipt, 실제 Sui 정산 트랜잭션 digest, Explorer 링크, 정산 전후 잔액 차이 표시 | 성공한 호출에 대해서만 결제가 발생하고 온체인 증빙을 확인할 수 있음 |

### Demo Request

```text
@Crypto News Research 오늘 뉴스를 분석하고
@Crypto Market HTML 이걸로 시각화해줘
```

### Demo Completion Criteria

1. Slush Wallet 연결 주소와 시작 잔액이 보인다.
2. GitHub URL로 등록한 Agent가 Registry 맨 위에 추가되고, Hosted URL 또는 기존 서버 URL이 상세 화면에 표시된다.
3. 워크플로에 선택한 Agent만 노드로 추가된다.
4. 스트리밍 중 완료·작업 중 노드가 동시에 보인다.
5. JSON 및 HTML artifact를 각각 확인할 수 있고 HTML을 다운로드할 수 있다.
6. 성공한 Agent 호출의 Usage Receipt에 연결된 Sui 정산 트랜잭션 링크가 보인다.
7. 정산 전후 사용자 잔액의 차이가 보인다.

## 4. Supported Scope

### 4.1 Repository Requirements

MVP에서 Import 가능한 Repository는 다음 조건을 만족해야 한다.

- Public GitHub Repository
- Repository 소유자 또는 Maintainer가 직접 등록
- 명시적인 Open-source License 존재
- Python 3.11 또는 3.12
- `requirements.txt` 또는 `pyproject.toml` 존재
- LangChain 또는 LangGraph 기반
- 하나의 명확한 Agent Entrypoint 존재
- JSON으로 변환 가능한 입력·출력
- GPU가 필요하지 않음
- 장시간 Background Job이 필요하지 않음
- 외부 API 호출 대상이 명시되어 있음

MVP에서는 임의의 모든 Repository를 지원하지 않는다.

### 4.2 Supported Entrypoints

다음 형태를 우선 지원한다.

```python
result = agent.invoke(input)
```

```python
result = await agent.ainvoke(input)
```

```python
result = graph.invoke(input)
```

```python
result = await graph.ainvoke(input)
```

Analyzer가 Entrypoint 후보를 찾지 못하면 Creator가 Module Path와 Callable을 직접 선택할 수 있다.

### 4.3 Standard MCP Contract

모든 Agent는 다음 Tool을 제공한다.

```python
run_agent(
    task: str,
    context: dict | None = None,
    config: dict | None = None,
) -> AgentResult
```

```json
{
  "status": "succeeded",
  "result": {},
  "artifacts": [],
  "usage": {
    "duration_ms": 1200
  },
  "trace_id": "trace_001"
}
```

MVP에서는 Stream Output, Bidirectional Interaction, Long-running Task Protocol을 지원하지 않는다.

## 5. MVP User Roles

### Creator

- GitHub 계정 연결
- 자신의 Repository Import
- 분석 결과 검토
- Agent 이름과 설명 수정
- 무료 또는 고정 실행 가격 설정
- Hosted MCP 배포
- 실행 수와 누적 수익 확인

### Flow Builder

- 공개 Agent 조회
- Agent를 Langflow Canvas에 추가
- Agent 간 Input·Output 연결
- 실행 전 예상 가격 확인
- Flow 실행과 Trace 확인

### End User

- 준비된 Demo Flow 실행
- 최종 결과 확인
- Agent별 비용 확인
- Testnet 결제 결과 확인

MVP에서는 Creator, Flow Builder, End User가 같은 테스트 계정을 사용할 수 있다.

## 6. Functional Requirements

### P0 — 반드시 구현

#### GitHub Import

- GitHub URL 입력 또는 GitHub OAuth Repository 선택
- 이름과 GitHub Repository 연결
- Commit SHA 고정
- License 존재 여부 확인
- Repository 기본 파일 분석

#### Agent Analysis

- Framework 탐지
- Python Version 확인
- Dependency 파일 탐지
- Entrypoint 후보 탐지
- 환경변수 후보 추출
- Input·Output Schema 초안 생성
- Creator의 최종 확인

#### MCP Conversion

- 표준 `run_agent` Adapter 생성
- FastMCP Server 생성
- JSON Schema Validation
- Health Tool 또는 Health Route
- Agent ID와 Version 부여

#### Build and Runtime

- Container Image Build
- Dependency Install
- Contract Test 실행
- Smoke Test 실행
- 격리 Container 배포
- Hosted MCP URL 생성
- Timeout과 Resource Limit 적용

#### Agent Registry

- Agent Card
- 런타임 Registry의 Agent를 목록 최상단에 표시
- Source Repository와 Commit 표시
- Creator 표시
- Input·Output Schema 표시
- 무료 또는 가격 표시
- Deployment 상태 표시
- `Try Agent` 실행
- 등록 Agent 삭제
- 기존 MCP URL 또는 HireMe Hosted URL 표시
- 자체 MCP의 100M 토큰당 가격 표시

#### Langflow

- Hosted Langflow Instance
- HireMe Agent 목록 조회
- `Add to Flow`
- MCP Node 생성
- Node 간 JSON 전달
- Flow 실행
- Node별 Trace와 상태 표시
- 단계별 `started`·`completed` 이벤트를 스트리밍으로 표시
- 완료 노드는 결과 표시, 작업 중 노드는 진행 상태 표시

#### Metering

- `run_id`와 `trace_id` 생성
- Agent 호출 시작·종료 기록
- 성공·실패 상태 기록
- 성공한 호출만 Billable 처리
- Agent Version과 Creator Wallet 기록
- Flow 종료 시 Usage Receipt 생성

#### Settlement

- Creator Wallet 등록 및 Signature 확인
- Mock USDC 또는 Test USDC 사용
- 실행 전 예상 최대 비용 표시
- 서명된 Usage Receipt 검증
- 동일 `run_id` 중복 정산 방지
- 한 Transaction으로 여러 Creator에게 배분
- Transaction Hash 표시
- Sui Explorer Transaction Link 표시
- 실행 전후 payer Wallet 잔액 표시

#### Wallet and Artifacts

- Slush Wallet 연결
- 연결 주소와 SUI 또는 Test USDC 잔액 표시
- Slush Wallet 충전 진입점
- JSON 결과를 구조화된 패널에서 표시
- HTML artifact 격리 미리보기와 다운로드

### P1 — 시간이 남으면 구현

- Creator가 새 Commit으로 Version 재배포
- Agent 일시중지와 재활성화
- Build Log UI
- Flow 저장과 재실행
- Flow Creator Fee
- Agent별 기본 Benchmark Case
- 외부 Langflow용 MCP 연결 정보 복사

## 7. Explicitly Out of Scope

MVP에서는 다음을 구현하지 않는다.

- Private GitHub Repository
- GitHub 소유권이 확인되지 않은 Repository의 유료화
- LangChain·LangGraph 외 Framework
- Node.js, Rust, Go Agent
- GPU Runtime
- Kubernetes
- 완전 자동화된 임의 코드 이해
- LLM이 생성한 Adapter의 무검토 자동 배포
- User BYOK
- Gmail·Notion 등 OAuth Connector
- Dynamic Pricing
- Token Usage 기반 가격
- Subscription
- Rating과 Review
- Search Ranking
- Public Leaderboard
- Mainnet 결제
- Fiat 결제
- Creator 출금과 세금 처리
- 완전한 탈중앙화 Metering
- Agent 결과 품질 보증
- Composite Flow Marketplace
- Mobile UI

## 8. Technical Architecture

```text
┌───────────────────────────┐
│      Minimal Web UI       │
│ Import · Card · Earnings  │
└─────────────┬─────────────┘
              │
┌─────────────▼─────────────┐
│        FastAPI API        │
│ Auth · Registry · Runs    │
└──────┬──────────────┬─────┘
       │              │
┌──────▼──────┐ ┌─────▼──────────┐
│ Build Worker│ │ Metering Service│
│ Analyze     │ │ Receipt · Price │
│ Adapter     │ └─────┬──────────┘
│ Container   │       │
└──────┬──────┘ ┌─────▼──────────┐
       │        │ Settlement      │
┌──────▼──────┐ │ Contract        │
│ Agent Runtime│ └────────────────┘
│ FastMCP      │
│ Containers   │
└──────┬──────┘
       │ MCP
┌──────▼──────┐
│ Langflow     │
└─────────────┘
```

### Recommended MVP Stack

| Layer | Choice |
|---|---|
| API | Python + FastAPI |
| Agent Protocol | MCP |
| MCP Framework | FastMCP |
| Composer | Self-hosted Langflow |
| Database | PostgreSQL |
| Build | Docker BuildKit |
| Runtime | Docker Containers on one controlled host |
| Queue | Simple database-backed build/run queue |
| Object Storage | Build logs and artifacts only if needed |
| Smart Contract | Solidity |
| Contract Tooling | Foundry or Hardhat |
| Chain | Anvil for development, Base Sepolia for demo |
| Payment | Mock USDC or Testnet ERC-20 |

Kubernetes와 복잡한 Microservice 구조는 MVP 이후로 미룬다.

## 9. Minimal Data Model

### Agent

```text
id
name
description
creator_id
creator_wallet
repository_url
source_commit
license
framework
entrypoint
status
```

### AgentVersion

```text
agent_id
version
input_schema
output_schema
container_image
mcp_endpoint
required_secrets
permissions
created_at
```

### PricingPolicy

```text
agent_version_id
type: free | per_successful_run
amount
currency
platform_fee_bps
```

### FlowRun

```text
run_id
flow_id
payer_wallet
status
estimated_amount
actual_amount
created_at
completed_at
```

### AgentInvocation

```text
invocation_id
run_id
agent_version_id
creator_wallet
status
billable
amount
trace_id
duration_ms
```

### Settlement

```text
run_id
receipt_hash
transaction_hash
status
settled_at
```

## 10. Build and Runtime Security

MVP에서도 GitHub 코드를 메인 API Process에서 직접 실행하지 않는다.

### Build Restrictions

- Build Worker를 메인 API와 분리
- Build Time Limit
- Build Log 저장
- Dependency 목록 기록
- 의심스러운 명령어 탐지
- Privileged Container 금지
- Host Volume Mount 금지

### Runtime Restrictions

- Agent별 독립 Container
- CPU와 Memory 제한
- Execution Timeout
- Read-only Root Filesystem
- 임시 작업 Directory만 쓰기 허용
- Network Allowlist
- Agent별 Secret Scope
- Container 종료 후 임시 파일 삭제
- Log에서 Secret 마스킹

### MVP Trust Policy

MVP에서는 완전히 공개된 커뮤니티 등록을 허용하지 않는다. 팀이 선정한 Repository 세 개와 인증된 Creator만 배포한다. 자동 Scan 결과와 별도로 수동 Code Review를 통과한 Agent만 `Verified` 상태로 공개한다.

## 11. Pricing and Settlement Rules

### Pricing

- 가격 유형은 `free`와 `per_successful_run`만 지원한다.
- 가격은 Agent Version 단위로 고정한다.
- Version이 변경되어도 기존 Flow의 가격은 바뀌지 않는다.
- 사용자는 실행 전에 최대 예상 비용을 확인한다.

### Billable Event

다음 조건을 모두 충족할 때만 과금한다.

```text
MCP 요청이 Agent Runtime에 도착함
AND Agent가 Timeout 전에 종료됨
AND Output Schema Validation을 통과함
AND status == succeeded
```

다음은 과금하지 않는다.

- Build 실패
- Runtime 시작 실패
- Timeout
- Schema Validation 실패
- Platform 내부 오류
- 자동 재시도
- Agent가 `failed`를 반환한 경우

### Settlement

- Flow 실행 중에는 Off-chain Ledger에 금액을 누적한다.
- Flow 종료 시 하나의 Usage Receipt를 만든다.
- Metering Signer가 Receipt에 서명한다.
- Settlement Contract는 Signature와 `run_id` 중복 여부를 검증한다.
- 한 Transaction으로 모든 유료 Agent Creator에게 배분한다.
- MVP Platform Fee는 10%로 고정한다.

예시:

| Recipient | Gross | Fee | Net |
|---|---:|---:|---:|
| Research Creator | 0.020 | 0.002 | 0.018 |
| Writer Creator | 0.010 | 0.001 | 0.009 |
| Platform |  |  | 0.003 |
| **Total** | **0.030** |  | **0.030** |

## 12. Required Screens

랜딩페이지는 MVP 완료 조건이 아니다. 다음 기능 화면만 구현한다.

### 12.1 Import Agent

- GitHub Repository 선택
- 분석 상태
- Entrypoint 후보
- Input·Output Schema
- Secret과 Network Permission
- Deploy 버튼

### 12.2 Agent Card

- 이름과 설명
- Creator
- GitHub Repository와 Commit
- Version
- Input·Output
- 가격
- Runtime 상태
- Try Agent
- Add to Flow

### 12.3 Langflow Canvas

- Agent 검색
- Node 추가
- Node 연결
- 예상 비용
- Run

### 12.4 Run Detail

- 최종 결과
- Node별 상태
- 실행 시간
- Billable 여부
- Agent별 비용
- Receipt Hash
- Transaction Hash

### 12.5 Creator Earnings

- Agent별 성공 호출 수
- Gross Revenue
- Platform Fee
- Net Earnings
- 정산 Transaction

## 13. API Surface

MVP에서 필요한 최소 API다.

```text
POST   /imports/github
GET    /imports/{import_id}
POST   /imports/{import_id}/confirm
POST   /agents/{agent_id}/deploy
GET    /agents
GET    /agents/{agent_id}
POST   /agents/{agent_id}/try
GET    /agents/{agent_id}/versions
POST   /flows/{flow_id}/estimate
POST   /flows/{flow_id}/run
GET    /runs/{run_id}
POST   /runs/{run_id}/settle
GET    /creators/me/earnings
```

MCP Endpoint:

```text
POST /mcp/agents/{agent_id}/{version}
```

## 14. Milestones

### Milestone 1 — Standard Contract

- Agent Manifest 확정
- `run_agent` Input·Output Schema 확정
- Example Repository 하나를 수동 Adapter로 실행
- FastMCP Endpoint 호출 성공

### Milestone 2 — GitHub Import

- GitHub OAuth
- Repository와 Commit 선택
- License·Dependency·Framework 분석
- Entrypoint 확인 UI
- Adapter 자동 생성

### Milestone 3 — Hosted Runtime

- Container Build
- Contract Test
- Sandbox Execution
- Hosted MCP URL
- Agent Card와 Try Agent

### Milestone 4 — Langflow Composition

- Agent 세 개 배포
- Agent 검색과 Add to Flow
- JSON I/O 연결
- End-to-End Research Flow 실행
- Node별 Trace

### Milestone 5 — Metering

- Invocation Event
- 성공·실패 판정
- 가격 계산
- Usage Receipt
- 중복 `run_id` 방지

### Milestone 6 — Settlement Demo

- Creator Wallet 연결
- Test USDC
- Batch Settlement Contract
- Creator 잔액 변화
- Earnings 화면
- 전체 Demo Recording

## 15. Acceptance Criteria

### GitHub Import

- [ ] Creator가 GitHub OAuth로 로그인할 수 있다.
- [ ] 본인이 관리하는 Public Repository를 선택할 수 있다.
- [ ] 배포 Source가 Commit SHA에 고정된다.
- [ ] Framework, Dependency, License, Entrypoint가 표시된다.
- [ ] Creator가 잘못 탐지된 Entrypoint를 수정할 수 있다.

### MCP Conversion

- [ ] 세 Repository가 동일한 `run_agent` Tool을 제공한다.
- [ ] MCP Client가 각 Agent의 Schema를 조회할 수 있다.
- [ ] 잘못된 Input은 실행 전에 거부된다.
- [ ] Output이 공통 AgentResult 형식으로 반환된다.

### Setup-Free Runtime

- [ ] Agent 사용자가 Repository를 Clone하지 않아도 된다.
- [ ] 사용자가 Python이나 Dependency를 설치하지 않아도 된다.
- [ ] 사용자가 MCP Server를 직접 실행하지 않아도 된다.
- [ ] `Try Agent`에서 실제 결과를 받을 수 있다.

### Composition

- [ ] Langflow에서 세 Agent를 Node로 추가할 수 있다.
- [ ] 이전 Node의 Output이 다음 Node Input으로 전달된다.
- [ ] 하나의 질문에서 최종 Research Brief가 생성된다.
- [ ] 각 Node의 성공·실패 상태를 확인할 수 있다.

### Metering and Settlement

- [ ] 실행 전 최대 예상 비용이 표시된다.
- [ ] 성공한 유료 Agent만 과금된다.
- [ ] 무료 Agent는 Receipt에 기록되지만 지급액은 0이다.
- [ ] 하나의 Flow 실행에서 하나의 Usage Receipt가 생성된다.
- [ ] 동일한 `run_id`는 두 번 정산할 수 없다.
- [ ] 한 Transaction으로 두 명 이상의 Creator에게 지급된다.
- [ ] Creator Earnings 화면과 On-chain 결과가 일치한다.

### Security

- [ ] Agent 코드가 메인 API Process에서 실행되지 않는다.
- [ ] Agent마다 CPU·Memory·Timeout 제한이 적용된다.
- [ ] Agent가 허용되지 않은 Domain에 접근할 수 없다.
- [ ] Secret이 Log나 Agent Output에 노출되지 않는다.

## 16. Definition of Done

다음 Demo를 중단 없이 수행할 수 있으면 MVP가 완료된 것으로 본다.

1. GitHub Repository를 선택한다.
2. 분석된 Agent Manifest와 Entrypoint를 확인한다.
3. Agent를 Hosted MCP로 배포한다.
4. Agent Card에서 별도 설치 없이 Agent를 실행한다.
5. 서로 다른 Repository의 Agent 세 개를 Langflow에서 연결한다.
6. 실제 질문으로 최종 결과물을 생성한다.
7. Node별 실행 결과와 비용을 확인한다.
8. Usage Receipt를 생성한다.
9. 하나의 Testnet Transaction으로 유료 Agent 제작자들에게 금액을 배분한다.
10. 동일한 Receipt를 다시 제출했을 때 Contract가 거부한다.

## 17. Post-MVP Backlog

MVP 이후에는 실제 사용자 반응에 따라 다음 순서로 확장한다.

1. 추가 LangChain·LangGraph 구조 지원
2. Private Repository
3. Creator BYOK와 User OAuth Connector
4. Composite Flow 공개와 Flow Creator Fee
5. Rating·Review·Benchmark
6. On-demand Runtime과 Auto Scaling
7. CrewAI·OpenAI Agents SDK·Custom Python 지원
8. External Langflow와 다른 MCP Client 연결
9. Production Stablecoin Payment
10. Organization Registry와 Private Agent Hub

## 18. MVP Summary

MVP는 다음 다섯 가지에만 집중한다.

```text
1. GitHub Agent Import
2. Standard MCP Conversion
3. Setup-Free Hosted Runtime
4. Langflow Composition
5. Successful-run-based Settlement
```

나머지 Marketplace 기능은 이 End-to-End 경로가 검증된 뒤 확장한다.
