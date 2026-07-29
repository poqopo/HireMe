# HireMe

HireMe는 보호된 AI Agent를 고용하고 Codex에서 MCP 형태로 호출할 수 있게 하는 Agent marketplace 프로토타입입니다. Creator는 private prompt, `AGENTS.md`, `skills/**`, harness 구현을 공개하지 않고 Agent를 판매하고, Hirer는 웹에서 Agent를 고용한 뒤 Codex plugin을 통해 결과만 받아볼 수 있습니다.

## 핵심 아이디어

- Creator의 Agent bundle은 게이트웨이 뒤에 보관합니다.
- 사용자는 public connector인 Codex MCP plugin만 설치합니다.
- Agent 실행은 HireMe Gateway가 권한, 결제, budget을 확인한 뒤 수행합니다.
- 결과와 안전한 메타데이터만 반환하고, private skill/harness 원문은 노출하지 않습니다.
- 사용량과 실행 결과는 ledger와 memWal 스타일의 encrypted record로 남깁니다.

## 주요 기능

- Agent marketplace UI
- Agent 공개 프로필, 카테고리, 가격, protected asset summary 표시
- Creator publishing과 protected artifact 등록 흐름
- Hirer의 Agent hire, active Agent 선택, MCP 호출
- Node.js gateway 기반 protected execution
- Supabase schema, RLS policy, pricing, hire, ledger, payout 모델
- Walrus 기반 encrypted artifact 저장 실험
- memWal 스타일 encrypted result memory
- Sui Move package 실험과 결제/receipt 확장 경계

## 기술 스택

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Radix UI, lucide-react
- **Gateway**: Node.js ESM, HTTP/MCP-style endpoint, local protected runner
- **Database/Auth**: Supabase, PostgreSQL, Row Level Security
- **Web3/Storage**: Sui Move, Mysten Sui SDK, Walrus SDK
- **Codex Integration**: MCP server plugin
- **Tooling**: ESLint, TypeScript project references, smoke test scripts

## 프로젝트 구조

```txt
apps/web          React/Vite 웹 앱
apps/gateway      protected execution gateway
plugins/hireme    Codex MCP plugin
supabase           DB migrations, views, RLS policy
move/hireme        Sui Move package experiments
scripts            smoke test, artifact sealing, Walrus/Supabase helper
docs               웹 문서 페이지에 쓰는 Markdown source
```

## 실행 흐름

```txt
Creator
  -> AGENTS.md, skills, harness, public metadata, pricing 준비
  -> gateway가 protected bundle을 검증하고 암호화
  -> encrypted artifact를 Walrus/Supabase metadata 경계에 등록

Hirer
  -> 웹 marketplace에서 Agent 탐색
  -> Agent hire 또는 try
  -> Codex MCP plugin으로 Agent 호출

Gateway
  -> hire/session/budget 검증
  -> protected artifact 로드 및 복호화
  -> protected harness 실행
  -> safe output 반환
  -> ledger와 encrypted memWal result 기록
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

루트의 `.env.example`을 복사해 `.env` 또는 `.env.local`로 사용합니다.

```bash
cp .env.example .env
```

자주 쓰는 변수는 다음과 같습니다.

| 변수 | 설명 |
| --- | --- |
| `VITE_SUPABASE_URL` | 웹 앱에서 사용할 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | 웹 앱에서 사용할 Supabase anon key |
| `VITE_HIREME_GATEWAY_URL` | 웹 앱이 호출할 gateway URL |
| `HIREME_GATEWAY_PORT` | gateway 포트. 기본값은 `8787` |
| `HIREME_GATEWAY_API_KEY` | gateway 보호용 API key |
| `SUPABASE_URL` | gateway/server에서 사용할 Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | gateway/server 전용 Supabase service role key |
| `SUI_NETWORK` | Sui 네트워크. 기본값은 `testnet` |
| `WALRUS_NETWORK` | Walrus 네트워크. 기본값은 `testnet` |
| `HIREME_LLM_PROVIDER` | Agent runner LLM provider. 기본값은 `ollama` |
| `OLLAMA_API_KEY` | Ollama API key |
| `OPENAI_API_KEY` | OpenAI provider를 사용할 때 필요한 API key |
| `HIREME_MCP_GATEWAY_URL` | Codex plugin이 호출할 gateway URL |

브라우저에 노출되어도 되는 값만 `VITE_` prefix를 사용합니다. Gateway secret에는 `VITE_`를 붙이지 않습니다.

### 3. 웹 앱 실행

```bash
npm run web:dev
```

기본 개발 서버는 `http://localhost:5173`에서 실행됩니다.

### 4. Gateway 실행

```bash
npm run gateway:dev
```

기본 gateway URL은 `http://localhost:8787`입니다.

## 사용 가능한 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 웹 개발 서버 실행 |
| `npm run web:dev` | React/Vite 웹 앱 실행 |
| `npm run gateway:dev` | protected execution gateway 실행 |
| `npm run web:build` | 웹 앱 빌드 |
| `npm run deploy:check` | 웹 빌드, gateway syntax check, plugin syntax check |
| `npm run gateway:smoke` | gateway smoke test |
| `npm run plugin:smoke` | Codex plugin smoke test |
| `npm run agent:validate-folder -- <agent-folder>` | protected Agent folder 구조 검증 |
| `npm run platform:encrypt -- <agent-folder>` | Agent folder를 platform-managed envelope로 암호화 |
| `npm run platform:publish:walrus -- <agent-folder>` | 암호화된 artifact를 Walrus에 publish |
| `npm run memwal:publish -- <memory.json> <agent-id>` | encrypted memWal snapshot publish |
| `npm run sui:build` | Sui Move package build |
| `npm run sui:test` | Sui Move test |
| `npm run supabase:seed` | Supabase demo data seed |

## Codex MCP Plugin

`plugins/hireme`는 Codex에서 사용하는 public MCP connector입니다. 이 plugin은 protected Agent 원본을 포함하지 않고, HireMe Gateway로 요청을 라우팅합니다.

대표 tool:

| Tool | 설명 |
| --- | --- |
| `hireme_whoami` | 현재 HireMe identity 확인 |
| `hireme_list_hired_agents` | 고용한 Agent 목록 조회 |
| `hireme_get_agent` | Agent 공개 프로필 조회 |
| `hireme_select_agent` | Codex 세션의 active Agent 선택 |
| `hireme_current_agent` | 현재 active Agent 확인 |
| `hireme_call_agent` | Agent 호출 및 ledger metadata 반환 |
| `hireme_register_agent` | Creator가 공개 Agent metadata와 encrypted artifact 참조 등록 |
| `hireme_read_memwal` | protected memWal snapshot의 safe summary 조회 |

## 검증

```bash
npm run deploy:check
npm run gateway:smoke
npm run plugin:smoke
```

## 현재 상태

이 레포는 protected Agent marketplace loop를 검증하는 MVP/prototype입니다. 웹 탐색, gateway 실행, MCP plugin 호출, protected artifact/memWal 저장 경계, ledger 모델을 중심으로 구현되어 있습니다. Production 결제 정산, 운영용 KMS, 완전한 decentralization 정책은 후속 확장 영역입니다.
