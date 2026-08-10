# Creator Worker protocol v1

## 배치 구조

Creator Worker는 서버가 디자이너 Mac으로 접속하는 서버가 아니다. 로그인된 HireMe DMG가
10초 주기로 outbound HTTPS polling을 하고, 서버가 발급한 5분 lease capability를 가진
경우에만 한 Job을 실행한다. 한 Agent는 한 active Worker에 bind된다.

```text
Client                         Supabase                         Designer DMG
  create-project  ───────────▶ project + awaiting_assets
  signed upload   ───────────▶ private input bucket
  finalize        ───────────▶ queued
                                                ◀──────────── heartbeat / claim
                              leased + raw token ─────────────▶
                                                ◀──────────── renew every 30s
                                                ◀──────────── signed manifests
                              signed upload URL ─────────────▶
                                                ◀──────────── evaluations + complete
                              awaiting_creator_approval
                                                ◀──────────── approve / revise / reject
  signed delivery ◀────────── delivered only
```

## 고정되는 값

Project 접수 시 `agent_version_id`, `harness_revision`, `harness_digest`, `workflow_id`,
`workflow_revision`을 고정한다. DMG는 게시할 때 전체 Harness를
`published-agents/<digest>/agents/<local-agent-id>`에 별도 materialize한다. Worker는 편집
중인 Agent 폴더를 실행하지 않고 이 immutable snapshot의 publication receipt가 Job 값과
일치할 때만 실행한다.

## lease 규칙

- raw lease token은 DMG만 보유한다. DB에는 SHA-256 digest만 저장한다.
- claim은 `FOR UPDATE SKIP LOCKED`로 한 Job만 가져온다.
- lease는 5분이고 30초마다 갱신한다. availability가 꺼지거나 cancel 요청이 있으면 갱신이
  거절되고 실행 프로세스를 종료한다.
- 재시도는 최대 2회다. 두 번째 실패, 72시간 queue 정체, 48시간 승인 정체는 terminal
  상태로 전환한다.
- 상태 쓰기는 Edge Function/service role만 수행한다. Desktop과 renderer는 테이블에 직접
  insert/update하지 않는다.

## artifact 신뢰 계약

Worker는 Ed25519 device key로 다음 canonical manifest에 서명한다.

```json
{
  "schema": "hireme.creator_worker.artifact_manifest.v1",
  "jobId": "uuid",
  "projectId": "uuid",
  "workerId": "uuid",
  "harnessDigest": "sha256:...",
  "attemptNumber": 1,
  "kind": "preview",
  "version": 1,
  "filename": "direction-a.png",
  "mimeType": "image/png",
  "sizeBytes": 1048576,
  "contentDigest": "sha256:...",
  "provenance": {
    "workflowId": "brand-social-campaign",
    "workflowRevision": "v1",
    "harnessRevision": "1.0.0",
    "toolCallIds": []
  }
}
```

Edge Function은 등록된 public key로 서명과 pinned digest를 확인한 뒤 일회성 upload URL을
발급한다. 업로드된 object의 존재와 크기를 확인하기 전에는 complete되지 않는다. 이
서명은 등록 device가 제출했다는 증거이지, 디자이너 Mac이 침해되지 않았다는 remote
attestation은 아니다.

## 키와 백업

- Ed25519: artifact manifest 서명
- X25519 PKCS#8 device identity: creator recovery key의 device-bound input
- AES-256-GCM + HKDF-SHA256: 전체 Harness package의 creator-only backup
- private key는 macOS Keychain을 사용하는 Electron `safeStorage` ciphertext로 userData에
  저장한다.
- 서버에는 암호화 envelope만 저장하며 클라이언트에게 package URL이나 decrypt key를
  발급하지 않는다.

## v0 실행 제한

v0 Worker는 declarative Agent와 HireMe가 번들한 adapter만 실행한다. `command-v1`처럼
creator가 임의 executable을 등록하는 Agent는 차단한다. 입력 파일은 Job 임시 디렉터리로
받아 size와 digest를 다시 확인하고, 결과는 50MB 이하·20개 이하의 allowlisted MIME만
업로드한다.
