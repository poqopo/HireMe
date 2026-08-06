# Workflow: Brand social campaign v0

## 입출력 계약

- 입력: 목적, 대상, CTA, 채널/규격, 최소 1개 브랜드 asset, 필수/금지 요소
- 출력: 3개 preview, 선택본 export, 가능하면 editable source, design rationale, evaluation report
- 불가: 실제 게시, 기존 원본 덮어쓰기, 브랜드 자료가 없는 상태에서 "브랜드 일관성" 통과 선언

## 단계

| 단계 | 담당 | 허용 capability | 종료 조건 |
| --- | --- | --- | --- |
| 1. Intake | Brief Analyst | `asset.inspect` | required field와 asset 충족 |
| 2. Contract | Contract compiler | `brand.validate` | 모호성/위험 항목이 질문 또는 가정으로 명시 |
| 3. Plan | Orchestrator | 없음 | 고정된 skill revision과 deliverable 수 결정 |
| 4. Produce | Design Executor | `asset.inspect`, `image.generate`, `image.edit`, `layout.compose` | 3개 provenance 포함 preview 생성 |
| 5. Validate | Machine evaluator | `brand.validate`, `asset.inspect` | 규격·파일·금지 요소 검사 |
| 6. Critique | Design Critic | 읽기 전용 artifact access | rubric별 점수와 revise instruction 생성 |
| 7. Deliver | Delivery packager | `file.export` | pass일 때만 package 생성 |

## Critic의 rubric

| gate | 통과 기준 | 실패 시 |
| --- | --- | --- |
| brief fidelity | 목적, 대상, CTA, 채널 규격 충족 | `revise_required` |
| brand consistency | 승인 asset/token과 충돌 없음 | `revise_required` 또는 `blocked` |
| technical delivery | 요청 포맷·치수·읽기 가능성 충족 | `revise_required` |
| policy safety | 저작권/민감 표현/금지 요소 위반 없음 | `blocked` 또는 사람 검토 |

`Design Critic`은 executor의 chain-of-thought나 private skill 파일에 접근하지 않는다. 입력
contract, 공개 가능한 brand rule, artifact, tool trace만 평가한다.

## sample skill manifest

```json
{
  "schema": "hireme.design_skill.v0",
  "id": "brand-social-variation",
  "revision": "v1",
  "input": {
    "requiredProjectFields": ["brief.objective", "brief.audience", "brief.deliverables", "brandContext.assetRefs"],
    "requiredAssetKinds": ["logo", "color_token"]
  },
  "capabilities": ["asset.inspect", "brand.validate", "image.generate", "image.edit", "layout.compose", "file.export"],
  "outputs": [{ "kind": "preview", "format": "png" }, { "kind": "export", "format": "png" }, { "kind": "rationale", "format": "json" }],
  "qualityGates": ["brief_fidelity", "brand_consistency", "technical_delivery", "policy_safety"],
  "approval": { "requiredFor": ["share", "publish"] }
}
```
