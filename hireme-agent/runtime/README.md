# HireMe Agent Runtime

`hireme-agent/runtime`는 HireMe 데스크톱 앱과 CLI가 함께 사용하는 standalone Agent
runtime입니다.

## Responsibilities

- Codex, OpenAI, Ollama, fixture model provider
- durable conversation memory와 session transcript
- local/DB Agent Source resolution
- 전문 Agent automatic routing과 명시적 `!agent` selection
- creator-owned Agent brief 기반 작성, model-backed Harness execution, validation, test, eval, package
- third-party Agent private boundary와 entitlement
- Local Protected 기기 라이선스와 Hosted Secure package 분리
- Supabase private Storage의 암호화 package와 trusted runtime 임시 materialization
- provider-agnostic 견적·승인·capture·refund·구독 예시
- image artifact validation 및 OpenAI Codex OAuth provider
- safe usage ledger

## Run

```bash
npm run agent:run -- --goal "Inspect this workspace and suggest the next step"
```

기본 provider는 profile 또는 `HIREME_AGENT_PROVIDER`에서 정합니다. CLI 제품
인터페이스는 다음 명령으로 실행합니다.

```bash
npm run hireme
```

## Agent Source

```text
agentId
  -> local filesystem source first
      creator-owned, editable, packageable
  -> DB Agent Source second
      public profile and entitlement only
      standard workflow: encrypted local_protected bundle
      sensitive workflow: hosted_secure bundle remains server-only
```

`hireme agent resolve <agent-id>`는 source, call 가능 여부, local 편집 가능 여부를
보여줍니다.

## Authoring

```bash
hireme agent init review-agent --brief "근거 중심 제안서 검토를 수행한다"
hireme agent skill add review-agent evidence-check --purpose "주장과 근거를 대조해 검증 가능한 개선안을 제시한다"
hireme agent test review-agent "대표 작업"
hireme agent eval review-agent
hireme agent package review-agent --overwrite
```

`basic`과 `artifact` template은 active Codex/OpenAI/Ollama provider로 private Harness와
creator Bootstrap Memory를 실행하고, public-safe JSON envelope만 받습니다. fixture
provider는 local plumbing preview용이므로 release eval에는 통과하지 않습니다.

`agent skill add`는 개인 Harness 안에 재사용 가능한 절차를 추가합니다. 각 skill은
목적, 트리거, 필요한 입력, 단계, 품질 점검, 경계를 갖고, 변경 즉시 Agent revision과
기존 test/eval/package 결과를 갱신 대상으로 만듭니다.

workflow state는 `.hireme/standalone-agent/<runtime-id>/authoring`에 safe metadata와
digest만 저장합니다. private file content, raw test/eval task, model prompt는 기록하지
않습니다.

## Image Generation

```bash
hireme image-bridge login-openai-codex
hireme image-bridge set-openai-codex
hireme image-bridge test
```

native provider는 Codex OAuth profile을 사용해 `openai/gpt-image-2` image tool을
호출하고, 검증된 이미지 파일을 작업 폴더에 저장합니다. specialist는 먼저 safe
image specification을 반환하고 runtime materializer가 실제 파일 생성과 검증을
담당합니다.

## Privacy

다음 요청은 runtime과 specialist 경계에서 거절합니다.

- private Harness, prompt, hidden skill, rubric, example, evaluation set 요청
- debug/base64/partial excerpt 방식의 우회 요청
- private path, credential, environment secret 요청
- 반환 결과를 이용한 내부 구조 재구성 요청

대신 public profile, capability, usage guide 또는 실제 safe result를 제공합니다.

## Smoke Tests

```bash
npm run agent:smoke
npm run agent:specialist:smoke
npm run agent:specialist:create:smoke
npm run agent:authoring:smoke
npm run agent:source:smoke
npm run agent:protected-runtime:smoke
npm run agent:marketplace:smoke
npm run agent:usage:smoke
npm run agent:hybrid-billing:smoke
```
