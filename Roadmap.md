# HireMe Roadmap

## Product Direction

HireMe의 초기 중심 도메인은 디자인입니다. 디자이너가 자신의 판단 기준과 고객
질문을 반복 가능한 디자인 서비스로 만들고, 비전문 고객이 빈 프롬프트를 작성하지
않고도 직접 작업을 맡길 수 있는 데스크톱 작업 공간을 제공합니다. CLI는 같은
runtime을 사용하는 고급 인터페이스로 유지합니다.

핵심 제품 약속:

```text
고객은 디자이너가 설계한 질문에 답하고 결과를 얻는다.
디자이너의 목적, 우선순위, 금지 규칙과 품질 기준은 비공개로 유지된다.
HireMe는 질문, 판단 시스템, 실행, 버전과 수익을 연결한다.
```

## Phase 1: Desktop Alpha

- 질문형 주문 이후 수정·추가 요청을 위한 채팅 제공
- 디자인 서비스의 첫 화면에 User Ask Questions 주문서 제공
- Purpose, Priorities, Avoid, Quality Bar를 Private Harness 스킬로 저장
- 질문 답변을 서비스 실행 입력으로 구조화
- 여러 작업을 동시에 관리
- 로컬 Agent 선택, 파일 첨부, 작업 폴더 연결
- 실행 진행 상태, 시간, 대기열, 취소
- Agent 탐색과 공개 프로필
- 내 Agent 버전, 공개 상태, 가격 UI
- 예상 수익과 정산 UI
- macOS 개발용 앱 번들

완료 기준은 디자이너나 외주 작업자가 터미널 명령을 배우지 않고도 에이전트를
고르고 파일을 첨부해 결과를 받는 것입니다.

## Phase 2: Agent Source Service

로컬 Agent와 DB Agent를 하나의 검색·실행 계약으로 통합합니다.

```text
agentId
  -> local source: 제작자 소유, 편집 가능
  -> DB source: 공개 metadata와 entitlement만 제공
  -> remote executor: 타인 소유 private package 실행
```

필수 항목:

- 로그인과 사용자 identity
- Agent 공개 카드 동기화
- version pinning과 update 알림
- trial, hire, subscription entitlement
- 타인 소유 package의 평문 local materialization 금지
- 안전한 결과 및 usage metadata만 저장

## Phase 3: Billing And Creator Revenue

두 가격 모델을 실제 결제와 연결합니다.

- 입력+출력 100만 토큰당 사용량 요금
- 월/연 구독과 포함 토큰
- hybrid 가격
- 환불, 실패 실행, 무료 trial의 billable rule
- platform fee와 creator net revenue
- 지급 가능 잔액, 보류 기간, 세금 문서
- 가격 및 버전 변경 시 기존 구독자 정책

## Phase 4: Protected Execution

타인 소유 Agent가 사용자의 로컬 장치에 private source를 남기지 않도록 remote
execution boundary를 구현합니다.

- short-lived 실행 환경
- package digest와 version 검증
- outbound network/tool allowlist
- timeout, token, storage, process budget
- prompt extraction과 tool abuse 방어
- 로그에서 raw input, private source, credential 제거
- 결과 envelope validation

## Phase 5: Distribution Quality

- macOS/Windows 서명
- 자동 업데이트와 rollback
- crash recovery와 session 복구
- 접근성 및 키보드 탐색
- 저사양 환경 성능 측정
- 한국어/영어 localization
- 실제 프리랜서 사용자 테스트

## UX Principles

- 첫 화면에서 바로 일을 맡길 수 있어야 한다.
- 기술 용어보다 작업, 결과, 비용, 상태를 먼저 보여준다.
- 실행이 길어지면 진행 단계와 시간을 숨기지 않는다.
- 여러 작업을 오갈 때 현재 실행은 중단되지 않는다.
- 비용이 발생하기 전에 사용량 또는 구독 포함 여부를 보여준다.
- Agent를 고용해도 private Harness가 전달되지 않는다는 경계를 반복해서 명시한다.
