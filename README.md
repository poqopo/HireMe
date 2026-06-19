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

지금 데모의 UI, 결제, ledger는 mock 데이터로 동작합니다. 보호 artifact 경로는 platform-managed encryption으로 암호화한 ciphertext를 Walrus에 올리고 gateway가 다시 읽어 복호화하는 형태까지 테스트할 수 있게 나눠 두었습니다.

## 현재 프로젝트 구조

배포 단위는 웹, gateway, Codex plugin으로 나눴습니다. 웹은 정적 프론트엔드로 배포하고, gateway는 secret을 가진 별도 Node service로 배포하며, Codex plugin은 사용자가 설치하는 MCP client package로 유지합니다.

| Path | Role |
| --- | --- |
| `apps/web` | React/Vite 웹 앱. 랜딩, docs, marketplace, My page UI |
| `apps/gateway` | MCP/HTTP gateway. Agent 실행, 권한 확인, 결제/정산, Walrus/memWal 처리 |
| `plugins/hireme` | Codex에서 설치하는 HireMe MCP plugin |
| `scripts` | smoke test, artifact publish, plugin export, Supabase seed script |
| `supabase` | DB migrations and local Supabase assets |
| `move` | Sui Move package experiments |
| `docs` | `/docs` 페이지의 Markdown source draft |

배포 절차는 [DEPLOYMENT.md](DEPLOYMENT.md)에 정리했습니다.

## 핵심 보호 원칙

등록자가 올리는 실제 Agent 폴더(`AGENTS.md`, `skills/`, 선택적인 adapter/plugin 코드)를 고용자의 로컬 Codex plugin으로 배포하면 보호가 불가능합니다. 로컬에 파일이 내려오는 순간 사용자는 원문을 볼 수 있기 때문입니다.

따라서 HireMe의 목표 구조는 다음과 같습니다.

1. Creator가 `AGENTS.md` + `skills/**` 폴더를 준비합니다.
2. Creator 측에서 폴더를 tar/zip 번들로 묶습니다.
3. 번들을 platform-managed envelope로 암호화합니다.
4. 암호문만 Walrus에 저장합니다.
5. Supabase에는 `encryption_provider`, `platform_kms_key_id`, `policy_id`, `walrus_blob_id`, `sui_object_id`, `ciphertext_digest`, 가격, 공개 MCP contract만 저장합니다.
6. Hirer가 Codex plugin을 설치하면, 설치되는 것은 HireMe public connector뿐입니다.
7. Codex는 HireMe MCP gateway를 호출합니다.
8. Gateway가 hire 권한과 budget을 검증합니다.
9. Gateway가 creator bundle을 로드/복호화하고 protected Harness를 실행합니다.
10. Hirer에게는 최종 결과, 공개 로그, 과금 ledger만 반환합니다.

MVP에서는 HireMe gateway를 trusted executor로 두고 plaintext user task를 처리합니다. 즉, 먼저 검증할 가치는 “creator의 `AGENTS.md`, `skills/**`, harness를 hirer에게 노출하지 않고 결과만 반환하는 marketplace loop”입니다. 이 판단은 [Roadmap.md](Roadmap.md)에 정리했습니다.

Team 단위 Hire에서는 여러 protected Agent가 같은 프로젝트 맥락을 이어받을 수 있도록 `memWal`을 encrypted shared project memory로 적극 활용합니다. 자세한 전략은 [TeamMemWal.md](TeamMemWal.md)에 정리했습니다.

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
| `agent_teams` | marketplace에 노출되는 팀 단위 상품, owner, 공개 설명 |
| `agent_team_pricing` | 팀 bundle 가격, pooled call, overage 정책 |
| `agents` | 팀 안에서 실제 실행되는 Agent, 공개 skill summary |
| `agent_versions` | Harness 버전, MCP manifest 버전, 배포 상태 |
| `protected_artifacts` | encryption provider, policy id, Walrus blob id, Sui object id, encrypted metadata |
| `agent_pricing` | Agent별 실행 call 단가, budget cap, volume tier |
| `agent_team_hires` | 팀 단위 고용 상태, pooled quota, Codex installation |
| `hires` | 단일 Agent 직접 고용 상태, 권한 범위, 만료 시간 |
| `mcp_call_ledger` | call id, token/call count, latency, team/agent split amount |
| `user_memwal_results` | Hirer별 encrypted result artifact와 safe summary |
| `payouts` | Creator 정산 기록 |

보안 원칙:

- 공개 테이블에는 전체 Skills/Harness 원문을 저장하지 않습니다.
- `protected_artifacts`는 artifact id, platform access policy, checksum, version만 저장합니다.
- 실제 실행은 Supabase Edge Function, 별도 MCP gateway, 또는 gateway-managed worker에서 수행합니다.
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

- `agent_teams`, `agent_team_pricing`, `agent_team_hires`는 팀 단위 상품, bundle 가격, pooled usage를 담당합니다.
- `agents`, `agent_versions`, `agent_pricing`은 팀 안의 실행 Agent와 Agent별 metered execution 가격을 담당합니다.
- `protected_artifacts`는 platform-managed encryption/Walrus metadata만 저장합니다. `AGENTS.md`, `skills/`, Harness 원문은 저장하지 않습니다.
- `hires`는 고용 상태, Codex installation, access identity를 추적합니다.
- `agent_sessions`는 Codex에서 여러 Agent를 바꿔 쓰기 위한 active Agent 상태를 저장합니다.
- `mcp_call_ledger`는 call id, digest, latency, billable amount와 team access/agent execution split을 저장합니다. raw prompt/response는 저장하지 않습니다.
- `user_memwal_results`는 Agent 실행 결과를 Hirer별 encrypted memWal artifact로 저장합니다. RLS는 owning Hirer만 읽을 수 있게 제한합니다.
- `payouts`는 creator 정산 단위입니다.

## 필요한 환경 변수

`.env.example`를 복사해서 `.env` 또는 `.env.local`에 채웁니다. 브라우저에 노출되는 값은 `VITE_` prefix만 사용하고, gateway/server secret은 절대 `VITE_`를 붙이지 않습니다.

| Env | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | React 앱에서 Supabase에 접속할 URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | RLS가 적용되는 public anon key |
| `VITE_ENOKI_PUBLIC_API_KEY` | Browser | Enoki zkLogin wallet registration에 쓰는 public API key |
| `VITE_GOOGLE_CLIENT_ID` | Browser | Enoki Google zkLogin OAuth client id |
| `VITE_SUI_NETWORK` | Browser | Enoki/dApp Kit network. 로컬 데모는 `testnet` |
| `VITE_SUI_FULLNODE_URL` | Browser | dApp Kit JSON-RPC fullnode endpoint |
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
| `HIREME_PLATFORM_KMS_KEY` | Server secret | platform-managed artifact encryption root secret |
| `HIREME_PLATFORM_KMS_KEY_ID` | Server | logical KMS key id exposed in safe metadata |
| `HIREME_SEAL_PACKAGE_ID` | Server optional | Optional future Seal access policy Move package id |
| `HIREME_SEAL_KEY_SERVER_IDS` | Server optional | Optional future Seal key server object ids |
| `SUI_CLI_PATH` | Local only | 로컬 테스트용 `sui` binary path |
| `WALRUS_CLI_PATH` | Local only | 로컬 테스트용 `walrus` binary path |
| `SEAL_CLI_PATH` | Local only | 로컬 테스트용 `seal-cli` binary path |

## MCP 실행 흐름

1. Hirer가 웹에서 Agent Team을 고용합니다.
2. 플랫폼이 해당 Hirer에게 team hire receipt와 MCP endpoint 또는 manifest를 발급합니다.
3. Codex가 MCP tool call을 보냅니다.
4. MCP gateway가 team hire 권한, pooled call budget, agent routing 권한을 검증합니다.
5. gateway가 platform-managed KMS key로 Walrus ciphertext를 복호화합니다.
6. gateway가 선택된 Agent의 복호화된 `AGENTS.md`와 `skills/` 폴더를 격리 실행 환경에서 사용해 Agent Harness를 실행합니다.
7. 결과는 Hirer에게 반환하면서 동시에 Hirer 전용 encrypted memWal result artifact로 저장합니다.
8. 내부 Skills/Harness는 노출하지 않고, public record에는 result ciphertext digest와 safe summary만 남깁니다.
9. `mcp_call_ledger`에 team access amount와 agent execution amount를 분리한 과금 이벤트를 기록합니다.

## 로컬 Protected Gateway

로컬 gateway는 `apps/gateway/src/index.mjs`에 있습니다. 지금 단계에서는 Supabase/Walrus를 일부 실제로 호출하고, 암호화는 platform-managed envelope로 동작합니다. API 경계는 production 구조에 맞춰 두었습니다.

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
| `POST /v1/agents/register` | MCP에서 paid protected Agent 공개 메타데이터와 encrypted artifact 참조 등록 |
| `POST /v1/sessions/select` | Codex installation별 active Agent 선택 |
| `POST /v1/sessions/current` | 현재 active Agent 조회 |
| `POST /v1/agent-call` | protected Agent 호출. example agent는 trusted gateway runner를 사용 |
| `POST /v1/sealed-harness/prepare` | `AGENTS.md + skills/` protected upload 준비 |
| `POST /v1/sealed-harness/register` | platform encryption/Walrus public metadata 등록 |
| `POST /v1/sealed-harness/validate` | paid receipt가 있을 때 gateway runner가 protected artifact를 복호화 검증 |
| `POST /v1/memwal/read` | protected memWal snapshot을 gateway에서만 복호화하고 safe summary 반환 |
| user memWal result write | `POST /v1/agent-call` 내부에서 call 결과를 Hirer 전용 encrypted memWal result로 저장 |

Codex plugin MCP 서버는 `HIREME_MCP_GATEWAY_URL`로 이 gateway를 먼저 호출합니다. gateway가 꺼져 있으면 로컬 demo fallback을 사용하고, 반드시 gateway를 거치게 만들고 싶으면 `HIREME_MCP_GATEWAY_REQUIRED=1`을 설정합니다.

Creator가 Codex에서 “이 Agent 등록할래”라고 요청하는 경우에는 MCP가 `hireme_register_agent`를 호출합니다. 이 tool은 공개 카드 정보와 가격, 이미 암호화되어 Walrus에 올라간 artifact 참조만 받습니다. `AGENTS.md`, `skills/**` 원문, private prompt, Harness source는 MCP 등록 payload에 넣지 않습니다.

```json
{
  "agent_id": "private-code-reviewer",
  "name": "Private Code Reviewer",
  "creator": "Han Labs",
  "category": "Code",
  "headline": "Reviews migration diffs with a protected rubric.",
  "public_summary": "A paid protected code review agent. Buyers receive findings and memWal result records, not the creator folder.",
  "public_mcp_contract": "review_pull_request(diff, repo_context, risk_level)",
  "skills": ["Code review", "Migration risk", "Test planning"],
  "protected_asset_classes": ["AGENTS.md", "skills/**", "harness/**"],
  "price_per_call_usd": 0.005,
  "walrus_blob_id": "walrus_private_code_reviewer_ciphertext",
  "sui_object_id": "0x...",
  "ciphertext_digest": "sha256:..."
}
```

검증:

```bash
npm run gateway:smoke
npm run plugin:smoke
```

## Protected Agent Folder

```txt
<agent-folder>/
  AGENTS.md
  public.json
  skills/<skill-name>/SKILL.md
  harness/policy.json
```

Creator가 올리는 원본 Agent folder는 `AGENTS.md`, private skills, harness policy를 포함합니다. 올바른 보호 모델은 buyer가 이 folder를 직접 복호화하는 것이 아니라, 결제/권한을 검증한 gateway만 복호화하고 실행 결과만 반환하는 구조입니다.

새 creator folder는 MCP의 `hireme_create_agent_template`로 만들거나, 위 folder shape에 맞춰 직접 만들 수 있습니다. 로컬에서 보호 흐름을 검증할 때는 folder 경로를 명시합니다.

```bash
npm run agent:validate-folder -- <agent-folder>
npm run platform:encrypt -- <agent-folder>
node scripts/validate-protected-artifact.mjs .hireme/artifacts/<agent>.public-record.json
npm run gateway:smoke
npm run plugin:smoke
```

각 단계의 의미:

| Command | Purpose |
| --- | --- |
| `agent:validate-folder` | 원본 folder에 `AGENTS.md`, `public.json`, `skills/**/SKILL.md`가 있는지 검증 |
| `platform:encrypt` | 원본 folder를 platform-managed envelope로 암호화하고 `.hireme/local-walrus/*.platform-encryption.json`에 ciphertext 저장 |
| `platform:inspect` / `seal:inspect` | public record와 local Walrus ciphertext를 읽어 plaintext marker가 없는지 확인 |
| `validate-protected-artifact.mjs` | paid hire receipt mock이 있을 때만 gateway runner가 decrypt 검증을 수행하고 safe summary만 반환 |
| `gateway:smoke` / `plugin:smoke` | gateway API, OAuth MCP, plugin routing, Agent call JSON output을 검증 |

생성되는 `.hireme/` 폴더는 로컬 artifact cache이며 git에 커밋하지 않습니다. Production에서는 이 local cache가 Walrus blob으로 바뀌고, `.hireme/artifacts/*.public-record.json`에 해당하는 metadata만 Supabase `protected_artifacts`에 저장됩니다.

Production 매핑:

| Local example | Production equivalent |
| --- | --- |
| `.hireme/local-walrus/*.seal.json` | Walrus encrypted blob |
| `.hireme/artifacts/*.public-record.json` | Supabase `protected_artifacts` row |
| `hire_receipt_local_paid_demo` | Sui `HireReceipt` or execution-ticket object |
| platform-managed envelope with AES-GCM DEM | production KMS or optional `@mysten/seal` provider |
| `/v1/sealed-harness/validate` | trusted gateway decrypt + manifest verification mock |

Codex MCP 사용 예:

```txt
launch-operator에게 핸드폰 출시 페이지 방향을 잡아달라고 해
```

Codex는 `hireme_request`를 호출하고, MCP 서버가 요청을 실제 marketplace Agent로 라우팅합니다. 배포 환경에서는 `.hireme/artifacts` local demo record에 의존하지 않고, Try/Hire entitlement와 gateway registry를 기준으로 실행합니다. `AGENTS.md`, private skills, Harness 원문은 반환하지 않습니다.

현재 gateway의 `POST /v1/agent-call`은 다음을 보장하는 mock 결과를 반환합니다.

- private Agent folder를 gateway runner가 사용했다고 표시합니다.
- local Codex가 바로 소비할 수 있는 `jsonOutput.schema: hireme.protected_agent_json_output.v1`을 반환합니다.
- `jsonOutput.payload`에는 Agent가 만든 safe output이 들어가고, `jsonOutput.responseMode`와 `jsonOutput.localCodex.shouldAct`로 direct answer와 local Codex handoff를 구분합니다.
- `AGENTS.md`, `skills/`, plugin source, Harness internals는 반환하지 않습니다.
- ledger에는 raw prompt/response 대신 digest와 과금 metadata만 남깁니다.

## Walrus Folder Registry Demo

`examples/wal_test1/`은 실제 Walrus blob read/write와 Supabase registry를 검증하는 plaintext 데모입니다. Walrus는 폴더를 직접 저장하지 않으므로 folder를 tar.gz로 묶어 하나의 blob으로 올리고, Supabase `walrus_agent_artifacts`에 blob id와 archive checksum을 저장합니다. 이 데모는 내부 LLM을 호출하지 않고 deterministic JSON output만 반환합니다.

```txt
examples/wal_test1/
  AGENTS.md
```

현재 등록된 테스트 blob:

```txt
agent_id: wal-test1
walrus_blob_id: TfoPiFNeinTkiE3dO4dAkS99EUn_-yudfxiDJOacG_g
sui_object_id: 0x2cf6f6cc0180c379b634bcef8a56932744f81c77ca72aabcf4d23be155139bb3
archive_digest: sha256:cf379b5a3a2631aefd4e743a1e499850f0daf5e1448b336f42edb6f366bd3773
```

업로드/검증:

```bash
npm run walrus:publish:test1
npm run walrus:read:test1
```

Gateway endpoint:

```txt
POST /v1/walrus-agent/read
{
  "agent_id": "wal-test1",
  "task": "Describe this Walrus Agent folder"
}
```

Codex MCP 사용:

```txt
hireme_call_walrus_agent({ "agent_id": "wal-test1", "task": "wal_test1 폴더 구조를 설명해줘" })
```

이 데모는 일부러 plaintext로 둔 storage-path 검증입니다. production protected agent는 같은 registry/read 경계를 쓰되 Walrus에 platform-managed ciphertext를 저장하고 gateway runner만 복호화해야 합니다. 내부 LLM runner를 붙이기 전까지는 `runner.internalLlmCalled: false`, `jsonOutput.schema: hireme.walrus_agent_folder_json_output.v1` 형태의 구조화 결과만 반환합니다.

## Platform Encryption + Walrus 등록 흐름

공식 문서 기준으로 Walrus blob은 공개적으로 discoverable하므로 민감 데이터는 저장 전에 암호화해야 합니다. MVP에서는 HireMe Gateway가 trusted executor이므로 platform-managed encryption을 기본값으로 사용합니다. Seal threshold key servers는 플랫폼도 복호화 권한을 단독으로 갖지 않는 옵션으로 나중에 붙입니다.

HireMe는 Agent마다 package를 새로 배포하지 않습니다. `move/hireme`의 단일 Sui package가 `Agent`, `AgentVersion`, `ProtectedArtifact`, `HireReceipt`, `seal_approve` policy를 정의하고, creator는 agent/version/artifact 등록 tx만 보냅니다.

Sui package 준비:

```bash
npm run sui:build
npm run sui:publish:hireme
```

publish 결과로 나온 package id는 Sui metadata/proof 경계에 사용할 수 있습니다. MVP decrypt에는 필수값이 아닙니다.

```bash
HIREME_SEAL_PACKAGE_ID=<published package id>
```

현재 로컬 MVP 흐름:

```bash
npm run platform:encrypt -- <agent-folder>
npm run platform:inspect
node scripts/validate-protected-artifact.mjs .hireme/artifacts/<agent>.public-record.json
```

`platform:encrypt`는 Agent folder를 하나의 bundle로 만들고 `hireme.platform-ciphertext-envelope.v1` 포맷으로 암호화합니다. `.hireme/local-walrus/*.platform-encryption.json`에는 ciphertext envelope만 저장되고, `.hireme/artifacts/*.public-record.json`에는 `encryption_provider`, `platform_kms_key_id`, `walrus_blob_id`, `sui_object_id`, `ciphertext_digest` 등 safe metadata만 저장됩니다.

Production에서는 같은 경계를 유지하되 로컬 root secret을 cloud KMS/HSM으로 교체합니다. Gateway는 paid `HireReceipt`나 subscription/budget check를 통과한 뒤에만 platform KMS로 artifact를 복호화합니다.

실제 Walrus에 platform-managed ciphertext를 올리고 gateway가 Walrus에서 다시 읽어 복호화하는 흐름:

```bash
npm run platform:publish:walrus -- <agent-folder>
node scripts/validate-protected-artifact.mjs .hireme/artifacts/<agent>.public-record.json
```

이 경로에서 `.hireme/artifacts/<agent>.public-record.json`은 `storageProvider: "walrus"`와 실제 `walrusBlobId`를 갖습니다. Gateway는 이 record를 받으면 local cache가 아니라 Walrus blob을 읽고 ciphertext digest를 검증한 뒤 runner 내부에서만 복호화합니다.

## memWal

memWal은 Agent의 private memory snapshot과 Hirer별 Agent call result를 같은 방식으로 보호합니다.

```bash
npm run memwal:publish -- <memory.json> <agent-id>
npm run memwal:read -- .hireme/memwal/<agent>.memwal-record.json
```

`memwal:publish`는 명시한 memory JSON을 platform-managed envelope로 암호화해 Walrus에 올립니다. `memwal:read`는 gateway 경계에서만 복호화하고 `entryCount`, `tags`, `safeCapabilities` 같은 safe summary만 반환합니다. raw memory entry와 private notes는 hirer/Codex 응답으로 반환하지 않습니다.

Agent call 결과는 `apps/gateway/src/memWal.mjs`의 `writeUserMemWalResult`를 통해 Hirer별 ciphertext로 저장됩니다. Public record와 DB에는 raw result 대신 digest, encryption id, safe summary만 남기며, `user_memwal_results` RLS는 owning Hirer만 조회할 수 있게 제한합니다.

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

개발 중에는 메인 repo를 local marketplace로 바로 설치할 수 있습니다.

```bash
codex plugin marketplace add /Users/hanlab/Desktop/HireMe
codex plugin add hireme --marketplace hireme-local
```

그 다음 Codex를 새로 시작하고 `/mcp`로 `hireme` 서버가 잡혔는지 확인합니다.

사용자 배포용으로는 메인 repo 전체를 marketplace로 쓰지 않습니다. 웹 앱, gateway, Supabase migration, Walrus scripts, examples를 제외하고 Codex plugin bundle만 별도 repo로 export합니다.

```bash
npm run plugin:export -- ../hireme-codex-plugin \
  --repository-url https://github.com/poqopo/hireme-codex-plugin \
  --gateway-url https://your-gateway.example
```

생성되는 별도 repo 구조:

```txt
../hireme-codex-plugin/
  .agents/plugins/marketplace.json
  plugins/hireme/
    .codex-plugin/plugin.json
    .mcp.json
    mcp/server.mjs
    skills/hireme/SKILL.md
    assets/
```

사용자는 plugin 전용 repo만 추가합니다.

```bash
codex plugin marketplace add poqopo/hireme-codex-plugin --ref main
codex plugin add hireme --marketplace hireme
```

Plugin으로 배포되는 `hireme` MCP는 Codex 안에서 실행되는 얇은 connector입니다. 실제 protected Agent 실행, OAuth session 검증, entitlement 확인, memWal 저장은 public HireMe gateway가 처리합니다.

OAuth 연결을 테스트하려면 gateway를 HTTP MCP 서버로 등록합니다. 이 경로는 Codex가 `codex mcp login`으로 authorization code + PKCE flow를 실행하고, 이후 `/mcp` 호출에 bearer token을 붙이는 구조입니다. `/oauth/authorize`는 먼저 HireMe 웹 로그인 세션을 확인합니다. 로그인되어 있지 않으면 `/login?return_to=...`로 보내고, 웹에서 Google 로그인 후 다시 Codex consent 화면으로 돌아옵니다.

```bash
npm run gateway:dev
codex mcp add hireme --url http://localhost:8787/mcp --oauth-resource http://localhost:8787/mcp
codex mcp login --scopes hireme:agents,hireme:call,hireme:manage hireme
```

웹 로그인은 Supabase Auth Google provider를 사용합니다. Supabase Auth redirect URL에는 로컬 기준 `http://localhost:5173/auth/callback`을 허용해야 합니다. gateway 자체 demo approval은 기본적으로 꺼져 있으며, smoke test에서만 `HIREME_OAUTH_ALLOW_DEMO_LOGIN=1`로 켭니다.

OAuth client, Google login session, authorization code, bearer token hash는 Supabase의 `oauth_mcp_*` 테이블에 저장됩니다. 새 migration을 적용해야 gateway 재시작 후에도 Codex bearer token 검증이 유지됩니다.

### Enoki zkLogin address linking

Enoki는 MVP에서 wallet/address linking까지만 사용합니다. Sponsored transaction은 아직 구현하지 않았습니다. 웹 로그인은 Google 버튼 하나로 시작하고, Enoki Google zkLogin session에서 받은 ID token으로 Supabase session을 만든 뒤 Sui address를 profile과 gateway session에 같이 연결합니다.

1. Enoki Portal에서 Google provider와 public API key를 설정합니다.
2. Google OAuth redirect URI에 로컬 callback을 추가합니다.

```txt
http://localhost:5173/auth/enoki/callback
```

3. Browser env를 채웁니다.

```env
VITE_ENOKI_PUBLIC_API_KEY=enoki_public_...
VITE_GOOGLE_CLIENT_ID=...
VITE_SUI_NETWORK=testnet
VITE_SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
```

4. 새 wallet/profile migration을 적용합니다.

```bash
supabase db push
```

5. 웹에서 Google 로그인을 누릅니다.

성공하면 Enoki Google zkLogin address가 Supabase `profiles.sui_address`, `oauth_mcp_*` session/token metadata, Try/Hire entitlement의 `owner_sui_address`에 연결됩니다. Supabase Google provider와 Enoki `VITE_GOOGLE_CLIENT_ID`는 같은 Google OAuth client를 사용해야 ID token 검증이 통과합니다. Codex에서는 `hireme_whoami`로 `suiAddress`를 확인할 수 있습니다. 권한 판단의 안정성을 위해 MVP authorization key는 계속 email 기반 `hirer_id`이고, Sui address는 결제/receipt 연결용 보조 식별자로 저장합니다. 기존 계정에 Sui address가 비어 있으면 `/my` 페이지에서 fallback 연결 버튼을 사용할 수 있습니다.

현재 HireMe plugin MCP 서버가 제공하는 tool:

| Tool | Purpose |
| --- | --- |
| `hireme_whoami` | Codex가 현재 어떤 HireMe hirer identity로 연결되어 있는지 확인. token/secret은 반환하지 않음 |
| `hireme_request` | 자연어 요청을 agent/task/receipt로 라우팅해서 protected gateway 호출 |
| `hireme_list_hired_agents` | 현재 사용자가 고용한 Agent 목록, 가격, memWal 보호 요약 조회 |
| `hireme_get_agent` | 특정 Agent의 공개 프로필과 MCP 가격 조회 |
| `hireme_select_agent` | Codex 세션에서 active Agent 선택 |
| `hireme_current_agent` | 현재 active Agent 조회 |
| `hireme_call_agent` | 명시된 Agent 또는 active Agent를 호출하고 ledger 이벤트 반환. protected example agent는 trusted gateway runner 사용 |
| `hireme_prepare_sealed_harness_upload` | Creator의 `AGENTS.md` + `skills/` 폴더를 platform encryption + Walrus로 올리기 위한 등록 경계 안내 |
| `hireme_register_sealed_harness` | 암호화되어 Walrus에 올라간 Harness metadata만 등록 |
| `hireme_register_agent` | 공개 Agent 프로필, `$0.005/call` 같은 call 단가, encrypted Walrus artifact 참조를 gateway/Supabase에 등록 |
| `hireme_validate_sealed_harness` | paid receipt가 있을 때 gateway runner를 통해 protected example artifact를 검증 |
| `hireme_read_memwal` | gateway를 통해 protected memWal snapshot을 읽고 safe summary만 반환 |
| `hireme_connection_help` | 플러그인 설치와 Agent 전환 안내 반환 |

주의: 현재 MCP call은 로컬 gateway mock입니다. 실제 제품에서는 `hireme_call_agent` 내부가 hire 권한 확인, budget 검증, Sui AgentVersion 조회, Walrus ciphertext read, platform KMS decrypt, protected Harness 실행, Supabase `mcp_call_ledger` 기록으로 대체됩니다.

Agent 전환 방식:

```txt
hireme_whoami()
hireme_request(request: "launch-operator에게 제품 출시 페이지 방향을 잡아달라고 해")
hireme_list_hired_agents()
hireme_select_agent(agent_id: "codex-builder")
hireme_current_agent()
hireme_call_agent(task: "Implement billing ledger schema", budget_calls: 3)
hireme_call_agent(agent_id: "walrus-researcher", task: "Research Walrus storage pricing")
```

예시 protected Agent folder를 Codex MCP에서 검증하는 방식:

```txt
# repo에서 먼저 local ciphertext/public record 생성
npm run platform:encrypt
npm run gateway:dev

# Codex MCP tool call
hireme_validate_platform_encrypted_harness(record_path: ".hireme/artifacts/<agent>.public-record.json")
```

이 경로에서 MCP plugin은 복호화하지 않습니다. Plugin은 gateway로 요청을 전달하고, gateway runner만 `.hireme/local-walrus/*.seal.json` 또는 Walrus ciphertext를 복호화 검증한 뒤 safe summary와 ledger metadata만 반환합니다.

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
