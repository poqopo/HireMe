# Creator-device architecture threat model

## 가장 큰 구조적 문제

핵심 위험은 중앙 서버가 계산을 통제하지 않으면서 서비스 품질과 납기를 약속한다는 점이다.
디자이너 Mac은 꺼질 수 있고, 네트워크가 끊기며, 앱이나 로컬 Harness가 바뀔 수 있고,
침해된 device가 거짓 artifact를 서명할 수도 있다. 따라서 “로컬에서 돌았다”를
“정확하고 안전하게 돌았다”와 동일시하면 안 된다.

| 위협 | v0 완화 | 남는 위험 / 다음 단계 |
| --- | --- | --- |
| Worker offline | heartbeat, health, 72h expiry, availability UI | SLA가 필요하면 managed fallback pool 필요 |
| 중복 실행 | DB atomic claim, digest-only lease, renew | external provider idempotency key까지 전파 필요 |
| 게시 후 로직 drift | version/digest pin + digest별 local snapshot | OS 관리자에 의한 snapshot 변조는 attestation 없이는 방지 불가 |
| client asset 변조 | upload manifest + Worker 재다운로드 digest check | 악성 이미지 decoder sandbox 필요 |
| 거짓/불완전 결과 | signed manifest, object size check, 2-layer eval, creator approval | signature는 결과의 진실성을 증명하지 않음 |
| Private Harness 유출 | client package delivery 제거, encrypted creator backup, RLS | creator device malware와 screen/process inspection은 범위 밖 |
| 임의 코드 실행 | declarative skill + trusted adapter allowlist, command-v1 차단 | adapter 공급망 signing과 sandbox 강화 필요 |
| 비용 폭주 | max attempts 2, artifact/asset limits, one active Job | provider budget/circuit breaker 추가 필요 |
| 승인 지연 | 48h approval expiry와 inbox | 알림·대체 reviewer 정책 필요 |
| 데이터 잔존 | source retention 7일 maintenance | 로컬 workspace 사본은 client/creator 정책 별도 필요 |

## 신뢰하지 않는 것

- 모델의 “완료했습니다” 문장
- creator가 작성한 skill의 tool 요청
- client가 보낸 MIME, filename, size 주장
- Worker가 보낸 artifact digest만으로 upload가 완료됐다는 주장
- signed manifest만으로 device가 침해되지 않았다는 주장

## 신뢰 루트

- Supabase auth user와 participant 관계
- DB transaction/RPC가 소유한 claim과 상태 전이
- macOS Keychain이 보호하는 device identity
- 게시 package digest와 immutable snapshot receipt
- 사람 creator의 최종 delivery 승인
