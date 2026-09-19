# HireMe

> **From GitHub to a hosted, composable, monetizable MCP Agent—without setup.**

## 1. Project Summary

HireMe는 GitHub에 공개된 AI Agent를 분석해 **표준 MCP Agent로 변환하고 호스팅**하는 플랫폼이다. Agent 사용자는 Repository를 Clone하거나 실행 환경을 설정하지 않고, HireMe에서 Agent를 바로 실행하거나 Langflow에 추가해 다른 Agent와 조립할 수 있다.

Agent 제작자는 자신의 GitHub Repository를 인증해 등록하고, 무료 공개 또는 실행당 과금을 선택할 수 있다. 유료 Agent가 Flow 안에서 사용되면 실제 성공한 호출을 기준으로 제작자에게 수익을 정산한다.

HireMe가 해결하려는 핵심 문제는 다음과 같다.

```text
GitHub에 존재하는 Agent
        ↓
설치·환경설정·의존성·실행 방식이 모두 다름
        ↓
다른 사람이 사용하거나 조립하기 어려움
        ↓
HireMe가 표준 MCP로 변환·배포
        ↓
설치 없이 실행·조립·수익화
```

## 2. Product Definition

HireMe는 단순한 Agent 목록이나 Prompt Marketplace가 아니다. 다음 네 기능을 하나로 묶은 **Hosted Agent Hub**다.

1. **GitHub-to-MCP Compiler**\
   GitHub Repository를 분석해 표준 MCP Adapter와 Agent Manifest를 생성한다.
2. **Hosted Agent Runtime**\
   Agent를 격리된 실행 환경에 배포하고 관리형 MCP Endpoint를 제공한다.
3. **Agent Composer**\
   등록된 Agent를 Langflow에서 Node처럼 선택하고 연결할 수 있게 한다.
4. **Agent Monetization**\
   제작자가 무료 또는 유료 정책을 선택하고, 성공한 실행에 대해 수익을 받을 수 있게 한다.

가장 가까운 비유는 **실행 가능한 AI Agent를 위한 Hugging Face**다.

| Hugging Face | HireMe |
|---|---|
| Model Repository | Agent Repository |
| Model Card | Agent Card |
| Model Weights | Prompt·Tool·Workflow·Code |
| Inference Endpoint | Hosted MCP Endpoint |
| 모델을 코드로 불러오기 | Langflow에서 Add to Flow |
| Hosted Inference 과금 | Agent 실행당 과금 |
| Spaces | 공개된 Composite Flow |
| Model Creator | Agent Creator |

HireMe에는 여기에 **Agent 조립과 다자간 정산**이 추가된다.

## 3. Product Thesis

AI Agent의 수는 빠르게 늘고 있지만, 현재 대부분은 다음 중 하나의 형태로 흩어져 있다.

- GitHub Repository
- 실행되지 않는 Demo
- 특정 Framework에 종속된 코드
- 로컬 설정이 필요한 MCP Server
- API Key와 환경변수를 직접 구성해야 하는 프로젝트
- 사용 방법이 README에만 적힌 연구용 Prototype

좋은 Agent가 공개되어 있어도 사용자가 직접 설치하고 문제를 해결해야 한다면 실제 재사용은 제한된다. HireMe는 Agent의 내부 Framework를 통일하는 대신, 외부 실행 인터페이스를 MCP로 표준화하고 호스팅한다.

핵심 가설은 다음과 같다.

> Agent의 재사용을 막는 가장 큰 장벽은 발견이 아니라 실행 환경과 인터페이스의 차이다. GitHub Agent를 설치 없이 실행 가능한 표준 MCP로 제공하면 더 많은 사람이 Agent를 사용하고 조합할 수 있으며, 제작자에게도 지속적인 배포와 수익화 수단을 제공할 수 있다.

## 4. Target Users

### 4.1 Agent Creator

GitHub에 LangChain, LangGraph 또는 자체 Python 기반 Agent를 공개한 개발자다.

원하는 것:

- 별도 서버 운영 없이 Agent 공개
- 사용자가 쉽게 Agent를 체험하게 만들기
- 버전별 배포와 실행 로그 확인
- 무료 또는 유료 공개 선택
- 다른 Flow에서 사용된 만큼 수익 받기

### 4.2 Flow Creator

직접 모든 Agent를 개발하지 않고, 여러 전문 Agent를 연결해 새로운 Workflow를 만드는 사용자다.

원하는 것:

- 검증된 Agent 검색
- Input과 Output을 확인하고 Node 연결
- 설치 없이 Flow 실행
- Agent별 비용과 전체 예상 비용 확인
- 완성된 Flow를 다시 공유하거나 배포

### 4.3 End User

Agent의 구현 방식보다 최종 결과가 필요한 사용자다.

원하는 것:

- Agent를 바로 체험
- 복잡한 설정 없이 작업 실행
- 실행 전 비용 확인
- 결과와 비용 내역 확인
- 실패한 작업에 불필요한 비용을 지불하지 않기

## 5. Core User Journeys

### 5.1 GitHub Agent 등록

```text
GitHub 로그인
    ↓
Repository 선택 또는 URL 입력
    ↓
Repository 소유권·License 확인
    ↓
Framework·Entrypoint·Tool·Dependency 분석
    ↓
Agent Manifest와 MCP Adapter 생성
    ↓
제작자가 Schema와 권한 검토
    ↓
Build·Test·Deploy
    ↓
Agent Card 공개
```

### 5.2 설치 없는 Agent 사용

```text
Agent 검색
    ↓
Agent Card에서 입력·출력·가격 확인
    ↓
Try Agent
    ↓
Hosted MCP Endpoint 실행
    ↓
결과·Trace·비용 확인
```

### 5.3 Langflow에서 Agent 조립

```text
Agent 선택
    ↓
Add to Flow
    ↓
Langflow Canvas에 MCP Node 추가
    ↓
다른 Agent의 Input·Output 연결
    ↓
예상 비용 확인
    ↓
Flow 실행
```

### 5.4 유료 Agent 수익화

```text
제작자가 가격 설정
    ↓
사용자가 비용 확인·승인
    ↓
Agent 실행
    ↓
성공한 호출만 Usage Receipt에 기록
    ↓
Flow 종료 후 Batch Settlement
    ↓
Agent Creator에게 수익 지급
```

## 6. Product Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                       HireMe Hub                         │
│ Agent Search · Agent Card · Try Agent · Creator Console │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                  GitHub Import Pipeline                  │
│ OAuth · License · Analyzer · Manifest · Adapter · Tests │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                   Hosted Agent Runtime                   │
│ Container · FastMCP · Secrets · Limits · Health Check   │
└───────────────────────────┬──────────────────────────────┘
                            │ MCP
┌───────────────────────────▼──────────────────────────────┐
│                    Langflow Composer                     │
│ Agent Nodes · Data Mapping · Flow Run · Result · Trace  │
└───────────────────────────┬──────────────────────────────┘
                            │ usage events
┌───────────────────────────▼──────────────────────────────┐
│                Metering & Settlement Layer               │
│ Pricing · Receipt · Replay Protection · Payout · Ledger │
└──────────────────────────────────────────────────────────┘
```

## 7. GitHub-to-MCP Pipeline

### 7.1 Repository Resolution

Repository를 등록할 때 다음 정보를 고정한다.

- GitHub Repository URL
- Owner와 Maintainer
- Default Branch
- 배포할 Commit SHA
- License
- Release 또는 Tag

배포 버전은 변경 가능한 Branch가 아니라 Commit SHA에 고정한다. 기존 Flow는 새로운 Commit이 올라와도 동일한 Agent Version을 계속 사용할 수 있어야 한다.

### 7.2 Repository Analysis

Analyzer는 다음 파일과 구조를 검사한다.

```text
README.md
pyproject.toml
requirements.txt
Dockerfile
.env.example
langgraph.json
Python entrypoints
Prompt files
Tool definitions
Tests
License
```

분석 결과로 다음을 생성한다.

- Framework와 Runtime
- Agent Entrypoint 후보
- 입력·출력 Schema 후보
- 필요한 환경변수와 Secret
- 외부 Network 접근 대상
- Filesystem 필요 여부
- 예상 실행 명령어
- MCP Tool 이름과 설명
- 위험 요소와 수동 검토 항목

### 7.3 Agent Manifest

HireMe는 MCP Protocol 정보 외에 Marketplace와 Runtime에 필요한 정보를 별도 Manifest로 관리한다.

```yaml
id: paper-research-agent
name: Paper Research Agent
version: 1.0.0

source:
  repository: https://github.com/example/paper-agent
  commit: abc123
  license: MIT

creator:
  github: example
  wallet: "0xCreator"

runtime:
  language: python
  version: "3.12"
  framework: langgraph
  entrypoint: src.agent:graph

interface:
  tool: run_agent
  input_schema: schemas/input.json
  output_schema: schemas/output.json

secrets:
  - OPENAI_API_KEY

permissions:
  network:
    - api.openai.com
  filesystem: temporary

pricing:
  type: per_successful_run
  amount: "0.02"
  currency: USDC
```

### 7.4 MCP Adapter

각 Agent는 외부에서 최소한 하나의 공통 Tool을 제공한다.

```text
run_agent

Input
- task: string
- context: object | null
- config: object | null

Output
- status: succeeded | failed
- result: object
- artifacts: array
- usage: object
- trace_id: string
```

Repository의 고유 기능은 추가 MCP Tool로 노출할 수 있지만, Langflow에서 조립하는 기본 단위는 `run_agent`로 통일한다.

### 7.5 Build and Deployment

```text
Manifest 확정
    ↓
MCP Adapter 생성
    ↓
Dependency Lock
    ↓
Container Image Build
    ↓
Static·Security Scan
    ↓
Contract Test
    ↓
Sandbox Smoke Test
    ↓
Hosted MCP Endpoint 배포
```

Endpoint 예시:

```text
https://mcp.hireme.ai/agents/paper-research-agent/1.0.0
```

## 8. Setup-Free Experience

### Creator가 하지 않아도 되는 일

- FastMCP Server 직접 작성
- Dockerfile 직접 구성
- Cloud Server 배포
- HTTPS와 Domain 설정
- Health Check 구성
- 실행 로그 수집
- 결제와 정산 구현

### Agent 사용자가 하지 않아도 되는 일

- Repository Clone
- Python Version 설정
- Package 설치
- MCP JSON 직접 작성
- Agent Server 실행
- Agent별 실행 명령어 학습

외부 계정 권한이 필요한 Agent는 설치가 아니라 **최초 1회 연결**만 요구한다.

## 9. Secrets and External Accounts

Agent가 외부 서비스에 접근하는 방식은 세 종류로 나눈다.

| Mode | Credential Owner | Example |
|---|---|---|
| Platform Managed | HireMe | 기본 LLM, 공용 검색 API |
| Creator Managed | Agent Creator | 제작자 전용 데이터/API |
| User Connected | End User | Gmail, Drive, Notion, 개인 API Key |

Secret은 Agent 코드나 Manifest에 저장하지 않는다. 실행 시 Agent별 권한에 맞춰 주입하고, 로그와 출력에서는 마스킹한다.

## 10. Langflow Composition

HireMe에 배포된 Agent는 Langflow의 MCP Node로 불러온다.

```text
[User Input]
      ↓
[Paper Research Agent · 0.02]
      ↓
[Evidence Structurer · Free]
      ↓
[Report Writer · 0.01]
      ↓
[Final Output]
```

각 Node에는 다음 정보가 표시된다.

- Agent 이름과 Version
- Creator
- Input·Output Schema
- 가격
- 필요한 Account Connection
- 예상 Timeout
- 검증 상태

완성된 Flow는 이후 하나의 MCP Tool 또는 Composite Agent로 다시 공개할 수 있다. 이 기능은 개별 Agent뿐 아니라 유용한 조합 자체도 재사용할 수 있게 한다.

## 11. Monetization Model

### 11.1 Pricing Options

초기 가격 정책은 단순하게 유지한다.

```yaml
pricing:
  type: free
```

또는:

```yaml
pricing:
  type: per_successful_run
  amount: "0.02"
  currency: USDC
```

향후 다음 방식으로 확장할 수 있다.

- Token Usage 기반
- 실행 시간 기반
- Subscription
- Success-based Pricing
- Private Organization License
- Flow Creator Fee

### 11.2 Settlement Principle

Agent 실행은 Off-chain에서 수행하고 결제와 정산만 On-chain에 기록한다.

| Off-chain | On-chain |
|---|---|
| Agent 실행 | Creator Wallet |
| Tool 호출 | 정산 금액 |
| 성공·실패 판정 | Receipt Hash |
| 상세 Trace | 중복 정산 방지 |
| 비용 계산 | 지급과 출금 |

호출마다 Transaction을 발생시키지 않고, 하나의 Flow가 끝난 뒤 성공한 Agent 호출을 모아 Batch Settlement한다.

### 11.3 Usage Receipt

```json
{
  "run_id": "run_001",
  "flow_id": "research-flow",
  "payer": "0xUser",
  "nodes": [
    {
      "agent_id": "paper-research-agent",
      "version": "1.0.0",
      "creator": "0xCreatorA",
      "status": "succeeded",
      "amount": "0.02"
    },
    {
      "agent_id": "report-writer",
      "version": "1.1.0",
      "creator": "0xCreatorB",
      "status": "succeeded",
      "amount": "0.01"
    }
  ],
  "total": "0.03",
  "receipt_hash": "0x..."
}
```

## 12. Ownership, License, and Attribution

유료화는 Repository를 등록한 사람의 주장만으로 허용하지 않는다.

### Creator Verification

- GitHub OAuth로 Owner 또는 Maintainer 확인
- GitHub App 설치 또는 Verification File 확인
- Wallet Signature로 지급 주소 확인
- Fork인 경우 원본 Repository 표시

### License Policy

- License가 없는 Repository는 자동 호스팅하지 않는다.
- 상업적 사용과 Hosted Service 허용 여부를 확인한다.
- Attribution과 Source 공개 의무를 Agent Card에 반영한다.
- 원저작자 확인 전에는 제3자가 Agent 가격을 설정할 수 없다.

### Unclaimed Agent

공개 License 범위에서 소개만 제공하고 아직 제작자가 인증하지 않은 Agent는 `Unclaimed`로 표시할 수 있다. Unclaimed Agent의 호스팅과 유료화 여부는 License와 운영 정책에 따라 제한한다.

## 13. Security Model

커뮤니티 Repository는 신뢰할 수 없는 코드로 취급한다.

각 Agent Runtime에는 다음 제한을 적용한다.

- Agent별 격리 Container
- CPU·Memory·Execution Time 제한
- Read-only Root Filesystem
- 실행별 임시 Workspace
- Network Egress Allowlist
- Agent별 최소 Secret만 주입
- Shell과 Subprocess 사용 탐지
- Log Secret Redaction
- Build Image 및 Dependency Scan
- 비정상 호출 Rate Limit

Agent 상태는 다음처럼 관리한다.

```text
Imported
  → Analyzed
  → Needs Review
  → Build Passed
  → Verified
  → Published
  → Suspended
```

## 14. Business Model

HireMe의 초기 수익원은 유료 Agent 실행에 대한 Platform Fee다.

```text
Agent Price   0.02 USDC
Platform Fee  10%
Creator Earns 0.018 USDC
Platform      0.002 USDC
```

향후 가능한 수익원:

- Hosted Runtime 사용료
- Private Agent와 Organization Registry
- GPU·고성능 Runtime
- Flow 판매 및 Composition Fee
- Enterprise Security·Audit
- Managed Secret과 Account Connector
- Agent Benchmark와 Verified Badge

## 15. Competitive Differentiation

### GitHub와의 차이

GitHub는 코드를 저장하지만 실행 가능한 표준 Agent Endpoint를 제공하지 않는다.

### MCP Registry와의 차이

Registry는 발견을 돕지만, 모든 Server의 Build·Hosting·과금·정산을 대신하지 않는다.

### Langflow와의 차이

Langflow는 Workflow를 조립하지만, GitHub Agent를 자동 분석해 Hosted MCP로 배포하고 원작자에게 정산하는 Agent Economy를 제공하지 않는다.

### 일반 Agent Marketplace와의 차이

HireMe는 Prompt를 다운로드하거나 Agent 하나를 구매하는 구조가 아니라, 실행 가능한 Agent Endpoint를 조립하고 실제 사용량에 따라 수익을 배분한다.

## 16. Product Boundaries

HireMe가 직접 하지 않는 일:

- LLM Model 자체 개발
- 모든 Agent Framework 통일
- Agent 코드를 Blockchain에서 실행
- GitHub License를 대체하는 새로운 License 발급
- 검증되지 않은 코드를 메인 서버에서 직접 실행
- Agent 결과가 항상 정확하다고 보증

HireMe의 역할은 **표준화, 배포, 실행, 조립, Metering, 정산**이다.

## 17. Success Metrics

### Supply

- 등록된 Agent 수
- 배포 성공률
- Verified Agent 비율
- Creator 재배포율

### Usage

- Agent 실행 수
- 성공한 실행 비율
- Flow에 재사용된 Agent 비율
- Agent당 고유 사용자 수

### Composition

- 생성된 Multi-agent Flow 수
- Flow당 평균 Agent 수
- 다른 Flow에 재사용된 Composite Flow 수

### Economy

- 유료 Agent 비율
- Gross Agent Volume
- Creator Earnings
- Settlement 성공률
- 무료 사용자에서 유료 실행으로의 전환율

## 18. Roadmap

### Phase 1 — GitHub-to-MCP

- 제한된 Python Agent Repository 지원
- Manifest와 Adapter 생성
- Hosted MCP 배포
- Agent Card와 Try Agent

### Phase 2 — Composition

- Langflow Agent 검색
- Add to Flow
- Schema 기반 연결 검증
- Flow 실행 Trace

### Phase 3 — Monetization

- 무료·실행당 가격
- Usage Receipt
- Testnet Batch Settlement
- Creator Earnings Dashboard

### Phase 4 — Community Hub

- 공개 검색과 Category
- Rating과 Benchmark
- Composite Flow 공개
- Private Agent
- Organization Registry

### Phase 5 — Open Ecosystem

- 추가 Framework 지원
- A2A와 다양한 Agent Protocol
- External Langflow·Codex·Claude 연결
- Enterprise Deployment
- Production Payment

## 19. Canonical Product Statements

### One-liner

> HireMe turns GitHub Agents into hosted MCP services that anyone can use, compose, and monetize without setup.

### Korean One-liner

> HireMe는 GitHub Agent를 설치 없이 사용할 수 있는 Hosted MCP로 변환하고, 여러 Agent를 조립하거나 실행당 수익을 받을 수 있게 해주는 플랫폼입니다.

### Short Pitch

> GitHub에는 좋은 Agent가 많지만 대부분 직접 Clone하고 환경을 설정해야 사용할 수 있습니다. HireMe는 Repository를 분석해 표준 MCP Agent로 변환하고 안전한 실행 환경에 배포합니다. 사용자는 Langflow에서 Agent를 바로 가져와 조립할 수 있고, 제작자는 원한다면 성공한 실행마다 수익을 받을 수 있습니다.

## 20. References

- MCP Server Concepts: <https://modelcontextprotocol.io/docs/learn/server-concepts>
- FastMCP Server: <https://gofastmcp.com/servers/server>
- FastMCP Tools: <https://gofastmcp.com/servers/tools>
- Langflow MCP Server: <https://docs.langflow.org/mcp-server>
- Langflow Security: <https://docs.langflow.org/security>
