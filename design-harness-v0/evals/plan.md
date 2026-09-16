# Evaluation plan

## 원칙

평가는 agent가 "완료"라고 말했는지 확인하는 과정이 아니다. 동일 입력과 rubric으로
독립 evaluator가 결과 artifact와 execution trace를 판정하는 시스템이다.

## v0 eval set

처음에는 브랜드 4개 × 의뢰 5개, 총 20개 case를 만든다. 각 case에는 아래를 versioned
fixture로 저장한다.

- structured brief와 허용 asset bundle
- 요청 deliverable과 정답이 아닌 **검증 가능한 조건**
- 금지 요소와 예상 위험
- 디자이너가 작성한 rubric 및 최소 통과선
- human review label을 위한 reference notes

## 판정 계층

1. **Machine check**: 파일 존재, MIME/치수, delivery 완결성, 금지 token, provenance
2. **Rubric evaluator**: brief 충족·브랜드 일관성·시각적 명료성 점수와 근거
3. **Human sample review**: 매 release에서 case의 최소 20%, 경계 사례는 100% 검토

release는 blocking gate가 모두 통과하고, 기준 모델/skill revision 대비 아래 중 하나를
만족할 때만 진행한다.

- pass rate가 떨어지지 않는다.
- 비용 또는 p95 실행 시간이 개선되고 pass rate 하락은 없다.
- human review에서 새로운 실패 유형이 발견되지 않는다.

## 기록할 지표

| 지표 | 정의 |
| --- | --- |
| `contract_completion_rate` | Intake가 사람 재질문 없이 실행 계약을 완성한 비율 |
| `first_pass_rate` | 첫 실행에서 모든 blocking gate를 통과한 비율 |
| `revision_count` | delivery 전 평균 수정 횟수 |
| `brand_gate_failure_rate` | 브랜드 기준으로 실패한 실행 비율 |
| `tool_policy_violation_rate` | deny 또는 scope 위반 도구 호출 비율 |
| `cost_per_delivered_asset` | 전달 완료 artifact당 비용 |
| `p95_delivery_time` | 접수부터 delivery-ready까지 시간 |

## 회귀 절차

모델, system prompt, tool adapter, skill manifest, evaluator 중 어느 하나를 바꿔도 모든
v0 case를 재실행한다. 결과는 이전 기준선과 비교하고, 실패 artifact·trace·evaluator
reason을 보존한다. 기준선보다 낮은 결과를 "새 모델이 더 창의적"이라는 서술만으로
승인하지 않는다.
