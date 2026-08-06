# 단계별 구현과 검증 기준

## Stage 0 — 경계 고정

구현: Creator Worker를 별도 execution class로 만들고 buyer-device package materialization을
Desktop에서 제거한다. first workflow, 상태, retention, 승인 책임을 문서와 schema에 고정한다.

Exit criteria:

- 타인의 Agent를 기존 채팅으로 실행하면 `creator_worker_project_required`로 거절된다.
- 신규 Agent manifest의 default execution class가 `creator_worker`다.
- client에게 Private Harness, backup URL, lease token이 노출되는 IPC/API가 없다.

## Stage 1 — 제어면과 queue

구현: Worker registration, Agent binding, Project/Asset/Job/Event/Artifact/Evaluation/Approval
테이블, RLS, claim/renew RPC, private Storage bucket을 만든다.

Exit criteria:

- 동시에 claim해도 한 Job은 한 Worker만 획득한다.
- DB에는 raw lease가 남지 않는다.
- current Agent version과 binding digest가 다르면 Project 생성이 거절된다.
- client source는 `retention_until` 7일 이후 maintenance에서 삭제된다.

## Stage 2 — DMG Worker

구현: Keychain 보호 identity, register/heartbeat/availability, polling, lease renewal, cancel,
digest-pinned local snapshot execution, signed artifact upload를 연결한다.

Exit criteria:

- 앱이 닫히거나 availability가 off면 새 Job을 claim하지 않는다.
- source asset의 size/digest가 다르면 모델 호출 전에 실패한다.
- 편집 중인 Harness와 pinned snapshot이 달라도 pinned snapshot만 실행한다.
- 임의 command adapter는 실행되지 않는다.

## Stage 3 — 디자인 workflow와 eval

구현: brand social campaign의 input contract와 3-preview output contract, machine evaluator,
design critic, 최대 1회 revision을 연결한다.

Exit criteria:

- image preview가 3개 미만이면 machine gate가 blocked다.
- `worker_machine`과 `design_critic` 기록이 없으면 approval 상태로 가지 않는다.
- 이전 attempt artifact/eval이 두 번째 검수함에 섞이지 않는다.
- creator 승인 전 client download URL은 발급되지 않는다.

## Stage 4 — 제품 UI

구현: Studio의 Worker on/off·health·active Job·approval inbox, Client의 intake upload·status·delivery
화면을 연결한다.

Exit criteria:

- 디자이너가 승인/수정/반려를 선택할 수 있다.
- 수정은 attempt 2로 queue되고 그 이상은 거절된다.
- client는 queued/running/approval/delivered/failed 상태를 구분할 수 있다.
- delivered artifact만 time-limited URL로 다운로드할 수 있다.

## Stage 5 — closed pilot 운영

구현: 20-case eval set, OpenTelemetry trace, crash recovery, maintenance schedule, DMG signing/notary,
초대 사용자 운영 runbook을 추가한다.

출시 gate:

- 20-case blocking contract pass 100%
- first-pass rate와 human accept rate 기준선 확보
- p95 queue-to-delivery, creator approval latency, cost/delivery 기록
- Worker 강제 종료·네트워크 단절·중복 요청·lease 만료 복구 테스트 통과
- 보안 리뷰에서 raw secret, private source, unrestricted executable 경로 0건

현재 저장소는 Stage 0–4의 vertical slice를 구현했다. Stage 5의 실제 Supabase 배포,
scheduled maintenance 설정, 실모델 20-case 평가, Apple signing/notary는 배포 환경에서 수행해야
한다.
