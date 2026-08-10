# HireMe Agent

HireMe Agent는 디자이너의 작업 방식, 시각 언어, 판단 기준을 안전하게 실행하는
Design Agent Harness다. Client Web이나 Electron UI에 종속되지 않으며,
Designer App의 Creator Worker가 고정된 revision을 실행할 때 사용한다.

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
```
