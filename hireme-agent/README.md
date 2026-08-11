# HireMe Agent

HireMe Agent는 디자이너의 작업 방식, 시각 언어, 판단 기준을 안전하게 실행하는
Design Agent Harness다. Client Web이나 Electron UI에 종속되지 않으며,
Designer App의 Creator Worker가 고정된 revision을 실행할 때 사용한다.

Authoring Engine은 디자이너의 대화와 명시적 피드백을 typed Agent graph와 private
skill로 컴파일한다. 실행 중인 revision은 바꾸지 않으며, 개선안은 동일 사용자 요청을
기준선과 후보에 각각 실행해 observable indicator 차이를 검증한 뒤 디자이너 승인을
통과해야 다음 revision으로 적용된다.

## Structure

```text
hireme-agent/
├── cli/                    # 로컬 실행·관리 CLI
├── runtime/                # orchestration, memory, tools, provider runtime
├── design-harness-v0/      # Design 전용 Harness 기준 구현
│   ├── SOUL.md             # 정체성과 변하지 않는 원칙
│   ├── AGENTS.md           # orchestration과 delegation 규칙
│   ├── skills/             # 선언형 디자인 전문성
│   ├── tools/              # capability registry와 안전 정책
│   ├── workflows/          # 재현 가능한 작업 상태 머신
│   ├── memory/             # 브랜드·클라이언트 기억 정책
│   ├── evals/              # 결과 품질과 회귀 평가
│   └── schemas/            # Skill·Project contract
├── examples/               # 로컬 전문 Agent 예제
├── scripts/                # runtime·harness smoke tests
└── docs/                   # 구현 상세 문서
```

OpenClaw처럼 `SOUL → AGENTS → Skills → Tools → Workflows → Memory → Evals`가
분리되어 있다. 디자이너가 바꾸는 것은 주로 `skills`, `memory`, `workflows`이고,
runtime과 안전 정책은 버전으로 관리한다.

## Run

```bash
npm install
npm start -- --help
npm test
npm run test:authoring
```

대화형 작성 CLI의 시작점:

```bash
hireme agent teach my-agent --goal "반복해서 수행할 구체적인 디자인 업무"
hireme agent builtin-skills
hireme agent graph my-agent
hireme agent improve my-agent skills/critique.md --instruction "새 규칙" \
  --task "실제 사용자 요청" --expected-indicators "확인 항목,결과 형식"
```

그래프 런타임을 직접 확인하려면 model-backed provider를 선택한 상태에서 실행한다.
첫 명령은 Human Gate에서 checkpoint를 저장하며, 두 번째 명령이 같은 run을 이어간다.

```bash
hireme agent graph-run my-agent --task "검토할 디자인 요청" \
  --run-id studio-test --event-stream
hireme agent graph-resume my-agent --run-id studio-test \
  --decision approved --event-stream
```

Designer App의 Agent Studio는 이 런타임 위에 그래프 캔버스, guided settings,
변경 미리보기, 실행 이벤트, Human Gate 승인 UI를 제공한다. 노드 위치는 creator-local
layout으로만 저장되며 Agent revision에는 포함되지 않는다.
