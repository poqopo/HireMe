# HireMe

HireMe는 **Sui Overflow 2026 Walrus Track**을 겨냥한 AI Agent 구인구직 마켓플레이스 데모입니다. 핵심 아이디어는 Agent 제작자가 자신의 Skills, Harness, 실행 노하우를 전부 공개하지 않아도, 구매자가 Codex에서 MCP 형태로 Agent를 불러와 쓸 수 있게 하는 것입니다. 보호 계층은 `memWal`을 전제로 두고, 사용량은 MCP call 단위로 과금합니다.

## 제품 한 줄 요약

Agent 제작자는 보호된 Skills/Harness를 등록하고 MCP call 단가를 설정합니다. 고용자는 웹에서 Agent를 탐색하고 고용한 뒤, Codex MCP 서버처럼 호출합니다. 내부 구현과 민감한 메모리는 `memWal`/Walrus 기반 보호 저장소와 실행 게이트웨이에 남고, 외부에는 안전한 능력 요약과 호출 인터페이스만 노출됩니다.

## 핵심 사용자

- **Agent Creator**: 자신이 만든 Agent Skills, 프롬프트 체인, Harness, evaluation loop를 수익화하려는 개발자
- **Agent Hirer**: Codex나 MCP 클라이언트에서 특정 작업 Agent를 즉시 고용하려는 사용자
- **Platform Operator**: MCP 호출량, 정산, abuse, protected artifact 접근권을 관리하는 운영자

## 첫 데모 범위

- React + Vite + Tailwind CSS + shadcn/ui 스타일 컴포넌트 구성
- `design.md`의 Stripe풍 컬러/타입/컴포넌트 토큰을 반영한 랜딩 페이지
- `/agents` 라우트의 검색, 카테고리, Agent 카드 탐색 UI
- Agent별 MCP call 단가, 보호 정책, Harness 방식, skill summary 표시
- Creator가 call 단가를 설정하는 콘솔 UI mock
- Supabase와 MCP 연동을 고려한 타입/클라이언트 경계 파일

지금 데모에서는 Supabase, 실제 결제, 실제 Seal/Walrus 네트워크 호출을 연결하지 않고 mock 데이터로 동작합니다. 다만 구조는 production에서 Seal + Walrus + MCP gateway로 교체할 수 있게 나눠 두었습니다.

## 핵심 보호 원칙

등록자가 올리는 실제 Agent 폴더(`AGENTS.md`, `skills/`, 선택적인 adapter/plugin 코드)를 고용자의 로컬 Codex plugin으로 배포하면 보호가 불가능합니다. 로컬에 파일이 내려오는 순간 사용자는 원문을 볼 수 있기 때문입니다.

따라서 HireMe의 목표 구조는 다음과 같습니다.

1. Creator가 `AGENTS.md` + `skills/**` 폴더를 준비합니다.
2. Creator 측에서 폴더를 tar/zip 번들로 묶습니다.
3. 번들을 Seal로 암호화합니다.
4. 암호문만 Walrus에 저장합니다.
5. Supabase에는 `seal_policy_id`, `walrus_blob_id`, `sui_object_id`, `ciphertext_digest`, 가격, 공개 MCP contract만 저장합니다.
6. Hirer가 Codex plugin을 설치하면, 설치되는 것은 HireMe public connector뿐입니다.
7. Codex는 HireMe MCP gateway를 호출합니다.
8. Gateway가 hire 권한, budget, Seal policy를 검증한 뒤 서버 측에서만 sealed folder를 복호화하고 Harness를 실행합니다.
9. Hirer에게는 최종 결과, 공개 로그, 과금 ledger만 반환합니다.

즉, “등록된 폴더의 Harness를 바탕으로 일한다”는 요구는 gateway에서 충족하고, “MCP 사용자가 Harness 원문을 못 보게 한다”는 요구는 원문 폴더가 사용자 머신으로 내려가지 않게 해서 충족합니다.

## 정보 구조

1. **Landing**
   - 보호된 Agent marketplace 가치 제안
   - memWal 보호 흐름
   - MCP 호출/과금 모델
   - Sui Overflow/Walrus Track 맥락

2. **Explore Agents (`/agents`)**
   - Agent 검색
   - 카테고리 필터
   - MCP call 단가 비교
   - memWal 보호 상태와 Harness 방식 확인
   - 고용 후 Codex MCP 패키지로 사용할 인터페이스 mock

3. **Creator Console Mock**
   - Agent 공개 요약 작성
   - 보호해야 하는 Skills/Harness는 비공개 artifact로 분리
   - MCP call당 가격 설정
   - 실행 정책과 정산 단위 설정

## Supabase 연동 계획

추천 테이블 초안:

| Table | Purpose |
| --- | --- |
| `profiles` | Creator/Hirer 프로필과 지갑, 정산 정보 |
| `agents` | 공개 Agent 카드 정보, 카테고리, 공개 skill summary |
| `agent_versions` | Harness 버전, MCP manifest 버전, 배포 상태 |
| `protected_artifacts` | Seal policy id, Walrus blob id, Sui object id, encrypted metadata |
| `agent_pricing` | call 단가, free quota, volume tier |
| `hires` | 고용 상태, 권한 범위, 만료 시간 |
| `mcp_call_ledger` | call id, token/call count, latency, billable amount |
| `payouts` | Creator 정산 기록 |

보안 원칙:

- 공개 테이블에는 전체 Skills/Harness 원문을 저장하지 않습니다.
- `protected_artifacts`는 artifact id, Seal policy, checksum, version만 저장합니다.
- 실제 실행은 Supabase Edge Function, 별도 MCP gateway, 또는 TEE 기반 worker에서 수행합니다.
- MCP 호출마다 권한 확인, metering, ledger 기록, 결제/정산 이벤트를 남깁니다.

Migration 파일:

```txt
supabase/migrations/202606100001_initial_hireme_schema.sql
```

적용 방법:

```bash
# Supabase project를 link해서 쓰는 경우
supabase link --project-ref <project-ref>
supabase db push

# DB URL로 바로 적용하는 경우
supabase db push --db-url "$SUPABASE_DB_URL"
```

현재 schema는 다음 원칙으로 설계했습니다.

- `agents`, `agent_versions`, `agent_pricing`은 marketplace 공개 정보와 가격을 담당합니다.
- `protected_artifacts`는 Seal/Walrus metadata만 저장합니다. `AGENTS.md`, `skills/`, Harness 원문은 저장하지 않습니다.
- `hires`는 고용 상태, Codex installation, Seal access identity를 추적합니다.
- `agent_sessions`는 Codex에서 여러 Agent를 바꿔 쓰기 위한 active Agent 상태를 저장합니다.
- `mcp_call_ledger`는 call id, digest, latency, billable amount만 저장합니다. raw prompt/response는 저장하지 않습니다.
- `payouts`는 creator 정산 단위입니다.

## 필요한 환경 변수

`.env.example`를 복사해서 `.env` 또는 `.env.local`에 채웁니다. 브라우저에 노출되는 값은 `VITE_` prefix만 사용하고, gateway/server secret은 절대 `VITE_`를 붙이지 않습니다.

| Env | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | React 앱에서 Supabase에 접속할 URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | RLS가 적용되는 public anon key |
| `SUPABASE_URL` | Server | MCP gateway/worker에서 쓰는 Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret | Gateway가 ledger, protected artifact를 기록할 때 쓰는 service role key |
| `SUPABASE_PROJECT_REF` | Local CLI | `supabase link`에 쓰는 project ref |
| `SUPABASE_DB_URL` | Local CLI secret | `supabase db push --db-url`에 쓰는 Postgres connection string |
| `HIREME_MCP_GATEWAY_URL` | Server/Plugin | Codex plugin이 호출할 protected MCP gateway URL |
| `HIREME_GATEWAY_API_KEY` | Server secret | 로컬 gateway 호출 보호용 API key |
| `SUI_NETWORK` | Server | `testnet` 또는 `mainnet` |
| `SUI_FULLNODE_URL` | Server | Sui fullnode endpoint |
| `WALRUS_NETWORK` | Server | `testnet` 또는 `mainnet` |
| `WALRUS_CONTEXT` | Server/CLI | Walrus CLI context |
| `WALRUS_UPLOAD_RELAY_URL` | Server | browser/server upload relay endpoint |
| `HIREME_SEAL_PACKAGE_ID` | Server | HireMe Seal access policy Move package id |
| `HIREME_SEAL_KEY_SERVER_IDS` | Server | comma-separated Seal key server object ids |
| `SUI_CLI_PATH` | Local only | 로컬 테스트용 `sui` binary path |
| `WALRUS_CLI_PATH` | Local only | 로컬 테스트용 `walrus` binary path |
| `SEAL_CLI_PATH` | Local only | 로컬 테스트용 `seal-cli` binary path |

## MCP 실행 흐름

1. Hirer가 웹에서 Agent를 고용합니다.
2. 플랫폼이 해당 Hirer에게 MCP endpoint 또는 manifest를 발급합니다.
3. Codex가 MCP tool call을 보냅니다.
4. MCP gateway가 hire 권한과 call budget을 검증합니다.
5. gateway가 Seal key-share 승인을 받은 뒤 Walrus ciphertext를 복호화합니다.
6. gateway가 복호화된 `AGENTS.md`와 `skills/` 폴더를 격리 실행 환경에서 사용해 Agent Harness를 실행합니다.
7. 결과만 Hirer에게 반환하고, 내부 Skills/Harness는 노출하지 않습니다.
8. `mcp_call_ledger`에 call 단위 과금 이벤트를 기록합니다.

## 로컬 Protected Gateway

로컬 gateway는 `server/gateway/index.mjs`에 있습니다. 지금 단계에서는 Supabase, Seal, Walrus를 실제로 호출하지 않고 memory-backed mock으로 동작하지만, API 경계는 production 구조에 맞춰 두었습니다.

실행:

```bash
npm run gateway:dev
```

기본 URL:

```txt
http://localhost:8787
```

주요 endpoint:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | gateway 상태 확인 |
| `POST /v1/agents/list` | hired Agent 목록 조회 |
| `POST /v1/agents/get` | Agent 공개 프로필 조회 |
| `POST /v1/sessions/select` | Codex installation별 active Agent 선택 |
| `POST /v1/sessions/current` | 현재 active Agent 조회 |
| `POST /v1/agent-call` | protected Agent folder runner mock 실행 |
| `POST /v1/sealed-harness/prepare` | `AGENTS.md + skills/` sealed upload 준비 |
| `POST /v1/sealed-harness/register` | Seal/Walrus public metadata 등록 |

Codex plugin MCP 서버는 `HIREME_MCP_GATEWAY_URL`로 이 gateway를 먼저 호출합니다. gateway가 꺼져 있으면 로컬 demo fallback을 사용하고, 반드시 gateway를 거치게 만들고 싶으면 `HIREME_MCP_GATEWAY_REQUIRED=1`을 설정합니다.

검증:

```bash
npm run gateway:smoke
npm run plugin:smoke
```

현재 gateway의 `POST /v1/agent-call`은 다음을 보장하는 mock 결과를 반환합니다.

- private Agent folder를 gateway runner가 사용했다고 표시합니다.
- `AGENTS.md`, `skills/`, plugin source, Harness internals는 반환하지 않습니다.
- ledger에는 raw prompt/response 대신 digest와 과금 metadata만 남깁니다.

## Seal + Walrus 등록 흐름

공식 문서 기준으로 Walrus blob은 공개적으로 discoverable하므로 민감 데이터는 저장 전에 Seal 등으로 암호화해야 합니다. Seal은 Sui Move access policy를 통해 decryption key share 발급을 제어합니다.

로컬 테스트용 흐름:

```bash
tar -czf agent-folder.tar.gz AGENTS.md skills/
seal-cli encrypt --policy <seal_policy_id> --in agent-folder.tar.gz --out agent-folder.seal.bin
walrus store agent-folder.seal.bin --epochs 3 --context testnet
```

웹 UI의 Creator publish flow는 위 과정을 mock으로 시뮬레이션합니다. 폴더 파일들의 digest를 계산해 `seal_policy_id`, `walrus_blob_id`, `sui_object_id`, `ciphertext_digest` 형태의 public record를 만듭니다. 실제 제품에서는 이 부분을 `@mysten/seal`, `@mysten/walrus`, wallet signature, Supabase insert로 교체합니다.

참고 문서:

- Walrus getting started: https://docs.wal.app/docs/getting-started
- Walrus storing blobs: https://docs.wal.app/docs/walrus-client/storing-blobs
- Walrus TypeScript SDK: https://sdk.mystenlabs.com/walrus
- Seal SDK: https://sdk.mystenlabs.com/seal
- Sui Seal encryption guide: https://docs.sui.io/sui-stack/seal/sui-stack-seal

## Codex Plugin + MCP 연결

Codex 공식 문서 기준으로 Codex plugin은 skills, apps, MCP servers를 묶는 배포 단위입니다. Codex는 STDIO MCP 서버와 Streamable HTTP MCP 서버를 지원합니다. 이 데모는 Figma처럼 사용자가 플러그인을 설치하고 선택할 수 있도록 repo-local plugin marketplace를 제공합니다.

참고 문서:

- OpenAI Codex MCP docs: https://developers.openai.com/codex/mcp
- MCP server build guide: https://modelcontextprotocol.io/docs/develop/build-server

포함된 플러그인 구조:

```txt
plugins/hireme/
  .codex-plugin/plugin.json
  .mcp.json
  mcp/server.mjs
  skills/hireme/SKILL.md
  assets/
.agents/plugins/marketplace.json
```

로컬 설치 절차:

```bash
codex plugin marketplace add /Users/hanlab/Desktop/HireMe
codex plugin add hireme --marketplace hireme-local
```

그 다음 Codex를 새로 시작하고 `/mcp`로 `hireme` 서버가 잡혔는지 확인합니다.

현재 HireMe plugin MCP 서버가 제공하는 tool:

| Tool | Purpose |
| --- | --- |
| `hireme_list_hired_agents` | 현재 사용자가 고용한 Agent 목록, 가격, memWal 보호 요약 조회 |
| `hireme_get_agent` | 특정 Agent의 공개 프로필과 MCP 가격 조회 |
| `hireme_select_agent` | Codex 세션에서 active Agent 선택 |
| `hireme_current_agent` | 현재 active Agent 조회 |
| `hireme_call_agent` | 명시된 Agent 또는 active Agent를 mock 호출하고 ledger 이벤트 반환 |
| `hireme_prepare_sealed_harness_upload` | Creator의 `AGENTS.md` + `skills/` 폴더를 Seal + Walrus로 올리기 위한 등록 경계 안내 |
| `hireme_register_sealed_harness` | 암호화되어 Walrus에 올라간 Harness metadata만 등록 |
| `hireme_connection_help` | 플러그인 설치와 Agent 전환 안내 반환 |

주의: 현재 MCP call은 실제 Seal/Walrus/Supabase를 호출하지 않는 mock입니다. 실제 제품에서는 `hireme_call_agent` 내부가 hire 권한 확인, budget 검증, Seal policy approval, Walrus ciphertext read/decrypt, protected Harness 실행, Supabase `mcp_call_ledger` 기록으로 대체됩니다.

Agent 전환 방식:

```txt
hireme_list_hired_agents()
hireme_select_agent(agent_id: "codex-builder")
hireme_current_agent()
hireme_call_agent(task: "Implement billing ledger schema", budget_calls: 3)
hireme_call_agent(agent_id: "walrus-researcher", task: "Research Walrus storage pricing")
```

중요한 호출에는 `agent_id`를 명시하는 방식을 권장합니다. `hireme_select_agent`는 편의를 위한 세션-local 상태이며, production에서는 `agent_sessions(user_id, codex_installation_id, active_agent_id)` 같은 서버-side 상태로 저장해야 합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

Supabase를 붙일 때는 `.env.example`을 기준으로 `.env.local`에 값을 넣으면 됩니다.

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
