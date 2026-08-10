# Architecture and runtime contract

## 책임 경계

```text
Client Desktop / Web
  → Supabase control plane (project, encrypted asset, queue, lease)
  → outbound polling
Designer HireMe DMG
  → Creator Worker
  → Design Harness
      ├─ Contract compiler       brief + brand kit을 실행 계약으로 정규화
      ├─ Orchestrator            상태 전이와 workflow 선택
      ├─ Tool gateway            schema, capability, approval, audit 강제
      ├─ Executor                제한된 도구로 산출물 생성
      ├─ Critic                  독립 rubric으로 평가
      ├─ Human gate              publish/공유/고위험 변경 승인
      └─ Artifact store          version, provenance, delivery package
  → signed artifact manifest
  → creator approval
  → time-limited client delivery URL
```

Harness는 provider 선택, tool 권한, 프로젝트 상태, 평가와 trace를 결정한다. Skill은
prompt나 임의 코드로 이 경계를 바꾸지 못하며, manifest에 선언한 capability 안에서만
동작한다.

## 실제 Project/Job 상태 전이

```text
project: draft → queued → running → awaiting_creator_approval → delivered
                       ↘ blocked / failed
                       ↘ canceled / expired

job: awaiting_assets → queued → leased → running → awaiting_creator_approval
                                          ↘ failed
awaiting_creator_approval → queued (수정 1회) → ... → delivered
```

- `queued` 전에는 required brief/asset 업로드를 검증해야 한다.
- `executing` 중에는 승인된 workflow와 capability grant만 사용할 수 있다.
- evaluator의 `pass`는 전달 권한이 아니다. `delivered`는 creator 승인만 쓸 수 있다.
- `blocked`에는 누락 입력·권한·도구 실패·안전 위반의 machine-readable reason을 남긴다.

## 메모리 분리

| 계층 | 내용 | 쓰기 주체 | 사용 범위 |
| --- | --- | --- | --- |
| Brand memory | 브랜드 토큰, 승인 이력, 금지 규칙 | 승인된 관리자 | 해당 브랜드 |
| Project memory | brief, 결정, artifact, 피드백 | Harness | 해당 프로젝트 |
| Skill memory | 재사용 가능한 공개/보호된 작업 지식 | creator | 해당 skill revision |
| Run scratchpad | 한 실행의 임시 추론·중간 파일 | runtime | 실행 종료 후 정리 |

원문 private prompt, hidden rubric, credential, scratchpad는 public result나 hirer-visible
memory에 기록하지 않는다.

## 실행 루프

1. Intake가 `DesignProject`를 만들고 Contract compiler가 누락된 정보를 질문한다.
2. Orchestrator가 workflow와 skill revision을 pin한다.
3. Executor는 Tool gateway에서 발급한 일회성 capability grant로만 행동한다.
4. 모든 tool call은 input fingerprint, output artifact, 비용, 시간, 권한 결정을 trace한다.
5. Critic은 executor의 private reasoning 없이 project contract와 결과 artifact를 평가한다.
6. Gate가 통과하지 않으면 revise instruction을 새 실행 입력으로 만들고 재시도한다.
7. 통과 결과는 immutable artifact version과 evaluation record를 묶어 전달한다.

## 구현 금지 사항

- executor가 스스로 `approved` 또는 `delivered` 상태를 쓰는 것
- skill Markdown이 tool policy나 사용자 권한을 임의 변경하는 것
- 최신 메모리를 무조건 prompt에 주입하는 것
- artifact provenance 없이 이미지를 최종 결과로 표시하는 것
- 평가가 실패했는데 실패 사유·수정 경로 없이 재생성만 반복하는 것
