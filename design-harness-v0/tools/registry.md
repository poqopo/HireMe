# Tool registry and permission model

도구는 자연어 이름이 아니라 versioned capability로 등록한다. Orchestrator가 workflow 단계별로
짧은 수명의 grant를 발급하고 Tool gateway가 schema·scope·승인을 검증한다.

| Capability | 등급 | 예시 | 기본 정책 |
| --- | --- | --- | --- |
| `asset.inspect` | read | 이미지 메타데이터, 레이어, 색상 분석 | 자동 허용 |
| `brand.validate` | read | 토큰/금지 요소 검사 | 자동 허용 |
| `reference.search` | read | 공개 레퍼런스 탐색 | 출처 trace 필수 |
| `image.generate` | create | 이미지 시안 생성 | sandbox에만 생성 |
| `image.edit` | create | 승인된 입력 artifact 변형 | 새 artifact version 생성 |
| `layout.compose` | create | 템플릿 기반 조판 | sandbox에만 생성 |
| `file.export` | mutate | PNG/PDF/SVG/편집 파일 생성 | delivery 폴더에만 쓰기 |
| `figma.apply_change` | mutate | 기존 원본 파일 수정 | 사람 또는 정책 승인 |
| `delivery.share` | external | 외부 링크 공유 | 항상 사람 승인 |
| `delivery.publish` | external | 게시/발행 | 항상 사람 승인 |

## 모든 도구 호출의 최소 기록

```json
{
  "toolCallId": "tcall_01",
  "projectId": "dprj_12345678",
  "capability": "image.edit",
  "grantId": "grant_01",
  "inputFingerprint": "sha256:...",
  "outputArtifactIds": ["dart_01"],
  "policyDecision": "allowed",
  "startedAt": "2026-08-06T12:00:00Z",
  "durationMs": 1200,
  "cost": { "currency": "USD", "amount": 0.04 }
}
```

정책이 거절된 호출도 `policyDecision: denied`와 이유를 남긴다. 모델이 재시도할 수 있는
오류와 사람 승인 없이는 진행할 수 없는 오류를 구분한다.

## Creator Worker v0 실제 allowlist

`HIREME_TOOL_ALLOWLIST`가 아래 이름만 모델 runtime에 노출한다. 문서의 capability는 제품
계약이고, 이 목록은 현재 CLI adapter 이름이다.

| Tool name | capability | scope |
| --- | --- | --- |
| `list_files`, `search_files`, `read_file` | `asset.inspect` | 해당 Job 임시 workspace만 |
| `write_file` | `file.export` | 해당 Job 임시 workspace만 |
| `hireme_list_local_specialist_agents` | Agent discovery | pinned snapshot root만 |
| `hireme_validate_local_specialist_agent` | Agent validation | pinned Agent만 |
| `hireme_call_local_specialist_agent` | workflow execution | pinned Agent만 |
| `hireme_validate_image_artifact` | `brand.validate` / technical gate | Job artifact만 |
| `hireme_materialize_specialist_image_artifact` | `image.generate` | Job workspace만 |

authoring, Agent 생성/수정, marketplace, billing, protected-runtime, usage-ledger, shell 도구는
Worker 모델에게 등록되지 않는다. capability grant의 단계별 발급과 OpenTelemetry tool-call
trace는 closed pilot 운영 단계에서 이 정적 allowlist 위에 추가한다.
