# HireMe 발표 슬라이드 구성안

## 발표의 한 문장

GitHub와 여러 MCP 서버에 흩어진 Agent를 표준 MCP 인터페이스로 연결하고, 누구나 워크플로로 조합·실행·정산할 수 있게 만든다.

## 청중이 가져갈 메시지

AI Agent의 문제는 Agent 부족이 아니라 재사용 가능한 실행 방식과 조합 가능한 인터페이스의 부재다. HireMe는 Agent를 발견하는 곳을 넘어, 실제로 실행하고 조합하며 비용을 정산하는 런타임이 된다.

---

## 1. Title — HireMe

**제목**

> HireMe: 흩어진 AI Agent를 조합 가능한 실행 단위로

**부제**

> GitHub Agent부터 Hosted MCP까지, 설치 없이 연결하고 실행하고 정산한다.

**슬라이드 구성**

- 중앙: `GitHub → MCP → Workflow → Result` 흐름
- 하단: 발표자 이름 / 날짜 / 행사명
- 텍스트는 최소화

---

## 2. Agenda — 오늘 이야기할 것

1. Agent 생태계가 커지며 생긴 단절
2. 조합과 비용 정산이 어려운 이유
3. HireMe의 표준화·실행·정산 접근
4. 제품 데모와 아키텍처
5. 기대효과와 다음 단계

**시각 제안**

- 5개 구간을 하나의 가는 진행선으로 배치

---

## 3. Background — Agent는 빠르게 늘고 있다

**핵심 메시지**

> 새로운 Agent는 계속 등장하지만, 발견과 활용 사이의 간격도 함께 커지고 있다.

**넣을 내용**

- GitHub의 Agent/agentic workflow 저장소 증가 추이
- Hugging Face Spaces 및 MCP-compatible Space 증가 추이
- LangChain, LangGraph, CrewAI, 자체 코드 기반 Agent의 공존

**데이터 자리**

| 지표 | 발표 전 채울 값 | 권장 출처 |
| --- | --- | --- |
| 최근 30일 새 Agent 관련 저장소 수 | `[검증된 수치]` | GitHub Search / GH Archive |
| MCP-compatible Space 수 | `[검증된 수치]` | Hugging Face Hub |
| 일 평균 신규 Agent/도구 등록 추정 | `[검증된 수치]` | 위 데이터 기반 계산 |

**발표 멘트**

“정확한 하루 신규 Agent 수는 플랫폼마다 정의가 다릅니다. 그래서 하나의 과장된 숫자보다, GitHub·Hugging Face·MCP 생태계의 증가 추이를 함께 보여주는 편이 신뢰를 줍니다.”

---

## 4. Background — Agent는 서로 다른 방식으로 공유된다

**핵심 메시지**

> 같은 ‘Agent’라도 사용자는 매번 다른 설치·인증·실행 방식을 배워야 한다.

| 공유 방식 | 사용자가 해야 하는 일 | 조합 난이도 |
| --- | --- | --- |
| GitHub 저장소 | Clone, 의존성 설치, 환경변수 설정, 실행법 파악 | 높음 |
| 외부 MCP 서버 | URL, 인증, Tool schema 연결 | 중간 |
| 자체 API/서버 | API 문서 해석, 요청 포맷 구현, 비용 관리 | 높음 |
| Hosted Space | UI 또는 endpoint 호출 | 중간 |

**시각 제안**

- 네 가지 출발점이 서로 다른 화살표와 포맷으로 흩어져 있는 그림

---

## 5. Problem 1 — 좋은 Agent도 연결되지 않으면 활용되지 않는다

**핵심 메시지**

> 각 Agent는 잘 작동해도, 결과를 다음 Agent의 입력으로 넘기는 순간 조합 비용이 발생한다.

**대표적인 충돌**

- Python/Node, LangChain/LangGraph/자체 프레임워크 차이
- 입력·출력 schema 불일치
- API Key와 환경변수 이름의 차이
- 파일·이미지·JSON·스트림 결과 처리 차이
- 실행 시간, 실패 방식, 재시도 방식의 차이

**시각 제안**

```text
Research Agent ── JSON A ──X── Visual Agent ── Image URL ──X── Writer Agent
                    schema            auth                 context
```

---

## 6. Problem 2 — 비용은 워크플로를 따라 움직이지 않는다

**핵심 메시지**

> 무료와 유료 Agent가 섞인 워크플로에서, 누가 무엇을 얼마나 사용했고 누구에게 지급할지 추적하기 어렵다.

**문제 상황**

- Agent A는 무료, Agent B는 호출당 과금, Agent C는 GPU 시간 과금
- 실패한 호출까지 과금할지 판단하기 어려움
- Flow 제작자와 원 Agent 제작자의 수익 배분이 불명확함
- 사용자에게 실행 전 예상 비용을 보여주기 어려움

**시각 제안**

- 하나의 워크플로 아래에 서로 다른 가격 정책이 흩어진 모습

---

## 7. Insight — 필요한 것은 Agent Marketplace가 아니라 실행 표준이다

**핵심 메시지**

> Agent를 나열하는 것만으로는 부족하다. 조합 가능한 계약과 실행 기록이 필요하다.

| 필요한 것 | HireMe의 답 |
| --- | --- |
| 공통 호출 방식 | 표준 `run_agent(task, context, config)` MCP 계약 |
| 도구와 프롬프트 이해 | 분석 결과의 tools / prompts / resources 저장 |
| 안전한 실행 대상 선택 | 서버 측 Agent Registry |
| 워크플로 추적 | 단계별 input, output, duration, error trace |
| 비용 정산 근거 | 성공한 호출의 usage receipt |

---

## 8. Solution 1 — Dependency를 표준 MCP 계약으로 감싼다

**핵심 메시지**

> 내부 구현은 달라도 외부에서는 같은 계약으로 호출한다.

```text
GitHub Agent / External MCP / HireMe-hosted Agent
                    ↓
          Standard MCP Agent Contract
                    ↓
run_agent(task, context, config) → AgentResult
```

**표준 결과 예시**

```json
{
  "status": "succeeded",
  "result": {},
  "artifacts": [],
  "usage": { "durationMs": 1200 },
  "trace": []
}
```

---

## 9. Solution 2 — 비용은 성공한 실행 기록을 기준으로 정산한다

**핵심 메시지**

> 실행 전에는 예상 비용을, 실행 후에는 성공한 Agent 호출의 usage receipt를 남긴다.

```text
Workflow 실행
→ Agent별 성공/실패와 usage 기록
→ Flow 완료 확인
→ 정산 가능한 receipt 묶음 생성
→ 블록체인 settlement 또는 지급 시스템 반영
```

**발표 시 강조할 점**

- 블록체인은 Agent를 실행하는 기술이 아니라 정산 기록과 지급 신뢰를 위한 레이어
- 실패한 호출과 성공한 호출을 구분하는 것이 핵심

---

## 10. Product — GitHub 링크 하나로 Agent를 추가한다

**핵심 메시지**

> 사용자는 저장소를 clone하지 않고, GitHub 링크와 실행 방식을 등록한다.

**데모 흐름**

1. Agent 이름과 GitHub URL 입력
2. 이미 있는 MCP URL을 연결하거나 HireMe 데모 호스팅 선택
3. GitHub MCP Analyzer가 tools, prompts, resources를 추출
4. Agent Registry에 저장
5. Agent Library와 워크플로 캔버스에 즉시 추가

**시각 제안**

- 실제 등록 모달 화면 캡처

---

## 11. Product — 자연어 요청을 워크플로 실행으로 바꾼다

**핵심 메시지**

> n8n처럼 흐름을 눈으로 구성하고, 채팅으로 실행하며, 각 단계를 실시간으로 확인한다.

**예시 요청**

> “오늘의 암호화폐 뉴스를 분석하고 시장 데이터를 HTML 보고서로 만들어줘.”

```text
Crypto News Research
→ Crypto Market HTML
→ Interactive HTML Report
```

**실시간 상태**

- `step.started`
- `step.completed`
- `step.failed`
- `workflow.completed`

---

## 12. Demo — Crypto News to HTML Report

**핵심 메시지**

> 서로 다른 두 전문 Agent가 표준 MCP를 통해 순차 실행되고, 첫 결과가 두 번째 Agent의 입력이 된다.

| 단계 | Agent | 입력 | 출력 |
| --- | --- | --- | --- |
| 1 | Crypto News Research | 오늘의 뉴스 요청 | 기사 근거·인사이트 JSON |
| 2 | Crypto Market HTML | 뉴스 인사이트 + 시장 데이터 | 인터랙티브 HTML artifact |

**발표 데모에서 보여줄 것**

- 캔버스의 두 Agent 연결
- 채팅 요청 입력
- 실행 trace
- 최종 HTML 결과

---

## 13. Architecture — GitHub에서 실행 가능한 Agent 정보로

```text
GitHub Repository
   ↓
GitHub MCP Analyzer
   ├─ manifest: commit, framework, secrets, coverage
   ├─ tools: name, schema, source
   └─ contents: instructions, prompts, resources
   ↓
Agent Registry
   ├─ Agent ID / version
   ├─ execution target
   └─ tool & prompt metadata
```

**발표 포인트**

- 분석은 코드를 실행하지 않고 정적 정보를 추출
- 실제 실행 대상은 Registry에서 검토·선택
- 요청 본문에서 임의 URL이나 실행 명령을 받지 않음

---

## 14. Architecture — 요청부터 결과까지

```text
Web Demo
  ↓ POST /api/runs/stream
HireMe Orchestrator
  ├─ Agent Registry에서 local / remote MCP 선택
  ├─ MCP initialize + run_agent 호출
  ├─ 이전 Agent output을 다음 Agent context로 전달
  └─ OpenAI 모델로 단계별 결과 정리
  ↓ SSE events
Web Demo: running / completed / failed / final result
```

**시각 제안**

- 좌측 Web Demo, 중앙 Orchestrator, 우측 MCP Agent 2~3개를 둔 수평 구조

---

## 15. Architecture — Local과 Remote Agent를 같은 방식으로 다룬다

| 실행 대상 | Registry가 저장하는 것 | Orchestrator 동작 |
| --- | --- | --- |
| HireMe local runtime | 검토된 runtime ID | 내부 stdio 또는 내부 MCP endpoint 호출 |
| Existing remote MCP | 검증된 MCP URL | Streamable HTTP MCP 연결 |
| HireMe demo hosted | GitHub 분석 결과 | 도구·프롬프트 컨텍스트 기반 모델 실행 |

**핵심 원칙**

> 브라우저는 Agent ID만 보낸다. URL, 인증, 실행 방식은 서버 Registry가 결정한다.

---

## 16. Expected Impact — Agent 제작자에게

**핵심 메시지**

> 좋은 Agent가 설치 문서에 머무르지 않고, 다른 사람의 워크플로에서 실제로 사용된다.

- 별도 onboarding 문서 부담 감소
- 기존 GitHub 프로젝트의 재사용성 증가
- 사용량·성공률·수익을 확인할 수 있는 기반
- 다른 Agent와 결합되며 새로운 사용 사례 발생

---

## 17. Expected Impact — Flow 제작자와 사용자에게

**핵심 메시지**

> 직접 모든 Agent를 만들지 않아도, 검증된 전문 기능을 조합해 결과를 만들 수 있다.

- 설치와 환경설정 없이 실행
- 입력·출력·비용·실행 상태를 한 화면에서 확인
- 작은 워크플로부터 실험하고 확장
- 결과뿐 아니라 결과가 만들어진 trace를 함께 확인

---

## 18. Roadmap — 데모에서 플랫폼으로

| 단계 | 목표 |
| --- | --- |
| 현재 | GitHub 분석, Registry, local/remote MCP, SSE 실행 trace |
| 다음 | 자연어 Planner가 적절한 Agent와 순서를 추천 |
| 이후 | GitHub Agent의 컨테이너 build·deploy·health check |
| 이후 | usage receipt 기반 settlement 및 creator payout |
| 장기 | 공개 Flow 공유, Agent 평가, 버전 관리, 권한 모델 |

---

## 19. Closing — Agent를 만드는 시대에서, Agent를 쓰는 시대로

**마무리 메시지**

> Agent의 가치는 코드가 공개되는 순간이 아니라, 다른 사람의 작업 안에서 다시 실행될 때 커진다.

**마지막 질문**

> “좋은 Agent를 발견한 뒤, 정말 바로 조합하고 실행할 수 있는가?”

HireMe는 그 질문에 “예”라고 답하기 위한 실행 인프라다.

---

## 발표 준비 체크리스트

- [ ] Slide 3의 시장 데이터와 출처 확정
- [ ] GitHub 등록 모달 캡처
- [ ] Workflow canvas와 SSE trace 캡처
- [ ] Crypto HTML 결과 화면 캡처
- [ ] Agent별 비용/정산 화면이 있다면 Slide 9 또는 12에 추가
- [ ] 발표 환경에서 `OPENAI_API_KEY`가 설정된 런타임과 웹 데모 기동 확인
