# HireMe

HireMe는 디자이너의 작업 방식을 Design Agent로 만들고, 클라이언트가 웹에서 해당
Agent에게 프로젝트를 의뢰할 수 있게 하는 플랫폼이다.

## Repository map

```text
HireMe/
├── app/
│   ├── client-web/       # 클라이언트 의뢰 웹 · React, Vite, Tailwind, shadcn/ui
│   ├── designer-app/     # 디자이너 작업공간 · Electron + modular React renderer
│   └── supabase/         # 인증, catalog, queue, storage, Edge Functions
├── hireme-agent/         # Design Agent Harness, runtime, skills, tools, evals
├── docs/                 # 제품 전체 구조와 의사결정
└── package.json          # 하위 모듈 명령만 라우팅
```

- Client Web은 공개 Agent 정보와 프로젝트 Control Plane만 사용한다.
- Designer App은 디자이너의 Mac에서 Private Harness와 Creator Worker를 실행한다.
- Supabase는 입력과 Job을 중계하지만 Private Harness나 AI credential을 소유하지 않는다.
- HireMe Agent는 UI와 분리된 Design 실행·평가 시스템이다.

## Install

각 모듈은 자신의 `package.json`, lockfile, `node_modules`를 가진다.

```bash
npm run install:all
```

## Run

```bash
npm run client:dev
npm run designer:dev
npm run supabase:start
npm run agent:start -- --help
```

## Verify

```bash
npm run check
```

세부 구조는 [docs/HireMeArchitecture.md](docs/HireMeArchitecture.md), Agent Harness는
[hireme-agent/README.md](hireme-agent/README.md)를 참고한다.
