# HireMe Desktop Distribution

HireMe의 기본 배포 단위는 데스크톱 앱입니다. React renderer와 로컬 Agent
Runtime을 Electron 앱 하나에 포함합니다. 같은 renderer는 제품 검토용 정적 웹
미리보기로도 배포할 수 있습니다.

## Local Development

```bash
npm install
npm run desktop:dev
```

이 명령은 Vite renderer와 Electron main process를 함께 실행합니다. 로컬
Agent 채팅은 기존 `bin/hireme.mjs`를 별도 process로 실행하며, renderer에는
허용된 IPC 함수만 노출합니다.

## Build Checks

```bash
npm run deploy:check
```

검사 범위:

- TypeScript renderer build
- Vite production bundle
- Electron main/preload syntax

## Local App Bundle

설치 전 실행 가능한 현재 운영체제용 디렉터리:

```bash
npm run desktop:package
```

DMG/ZIP, NSIS, AppImage 같은 배포 파일:

```bash
npm run desktop:dist
```

결과는 `release/`에 생성됩니다. 개발 빌드는 서명을 건너뜁니다. 실제 배포에서는
Apple Developer ID 또는 Windows code-signing certificate를 CI secret으로
연결하고, macOS notarization과 자동 업데이트 feed를 별도로 설정해야 합니다.

## Included Runtime

패키지에는 다음 파일이 `resources/runtime` 아래에 포함됩니다.

- `bin/hireme.mjs`
- `apps/agent/**`
- `examples/local-specialist-agents/**`
- OpenAI Codex OAuth 이미지 provider 실행 파일

개발 환경에서는 저장소 자체를 runtime root로 사용합니다. 설치 앱에서는
read-only runtime resource와 사용자의 writable state를 분리합니다.

```text
read-only: <app resources>/runtime
writable:  <Electron userData>/runtime
workspace: 사용자가 선택한 프로젝트 폴더
```

## Browser Preview

```bash
npm run web:build
npm run web:preview
```

`apps/web/dist`를 정적 호스팅할 수 있습니다. 브라우저에서는 로컬 파일 시스템과
Agent process IPC가 없으므로 UI와 외부 Agent의 데모 응답만 동작합니다.

## Database

새 DB 기준 스키마는
`supabase/migrations/202607110001_hireme_core.sql`입니다. 테이블은 `profiles`,
`agents`, `agent_versions`, `agent_access`, `conversations`, `messages`, `runs`
7개만 유지합니다. Provider token과 비공개 Harness 본문은 DB에 저장하지
않습니다. 제작자 수익은 검증된 `runs`에서 계산하고 실제 지급을 시작할 때만
별도 정산 원장을 추가합니다.

## Environment

CLI fixture smoke test는 인증 없이 실행할 수 있습니다. 배포 가능한 데스크톱
번들은 아래 Supabase 공개 설정과 Google provider 설정이 필요합니다.

```bash
HIREME_AGENT_PROVIDER=codex
HIREME_LOCAL_SPECIALIST_ROOT=examples/local-specialist-agents
HIREME_USER_ID=local-dev-user
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-anon-key>
HIREME_GOOGLE_CLIENT_ID=<google-web-client-id>
HIREME_GOOGLE_CLIENT_SECRET=<google-web-client-secret>
```

`npm run desktop:package`는 Supabase URL과 anon key만
`apps/desktop/public-config.json`으로 생성해 앱에 포함합니다. Google Client
Secret과 service-role key는 앱에 포함하지 않습니다. Google Cloud의 authorized
redirect URI는 `https://<project-ref>.supabase.co/auth/v1/callback`이어야 하며,
Supabase Auth redirect allow list에는 `hireme://auth/callback`이 필요합니다.

사용자는 앱의 `작업에 사용할 AI` 설정에서 ChatGPT 계정 또는 이 컴퓨터의
Ollama를 선택합니다. ChatGPT 연결은 HireMe UUID별 `CODEX_HOME`에 저장되고,
같은 OAuth 연결이 텍스트 작업과 native `gpt-image-2` 이미지 생성에 사용됩니다.
AI 인증 정보는 DB나 renderer에 전달하지 않습니다.

## Production Follow-up

다운로드 가능한 공개 앱으로 전환하기 전에 남은 필수 작업은 다음과 같습니다.

1. 운영체제별 서명과 notarization
2. 자동 업데이트 및 rollback
3. 결제 provider와 환불 정책
4. DB Agent Source의 인증된 API
5. 타인 소유 Agent를 실행할 격리된 remote executor
6. crash report와 개인정보 최소 수집 정책
