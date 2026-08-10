# Design Harness v0

Design Harness는 모델이나 개별 스킬의 모음이 아니다. 디자이너의 판단 기준을
`계약 → 실행 → 검증 → 개선`으로 반복 가능하게 만드는 HireMe의 공통 실행 기반이다.

## v0의 목표

첫 번째 지원 업무를 **브랜드 에셋 기반 소셜 캠페인 시안 제작**으로 제한한다. 사용자가
brief와 브랜드 자료를 제출하면 Harness가 입력을 정규화하고, 정해진 도구·workflow·품질
게이트 안에서 시안을 만든 뒤, 근거와 함께 `pass`, `revise`, `blocked` 중 하나를 반환한다.

v0은 범용 디자인 자동화나 완전 자율 게시를 목표로 하지 않는다. 우선 한 workflow가
재현 가능하고 측정 가능해야 한다.

## 읽는 순서

1. `architecture.md` — 경계와 런타임 생명주기
2. `schemas/design-project.schema.json` — 프로젝트의 영속 상태 계약
3. `schemas/design-skill.schema.json` — 디자이너가 올리는 skill 계약
4. `tools/registry.md` — 도구 권한과 승인 모델
5. `workflows/brand-social-campaign.md` — v0 기준 workflow
6. `evals/plan.md` — 출시·회귀 검증 방식
7. `creator-worker-protocol.md` — DMG, 제어면, 로컬 Worker 사이의 실제 계약
8. `implementation-roadmap.md` — 단계별 구현 범위와 exit criteria
9. `threat-model.md` — 가장 큰 실패 모드와 v0 완화책

## 핵심 원칙

- Harness가 모델, tool, memory, 권한, 평가를 소유한다. skill은 이를 우회할 수 없다.
- 모델은 실행자이지 완료 판정자가 아니다. Critic과 machine check가 별도로 판정한다.
- 모든 결과물은 프로젝트, 입력 asset, tool call, 평가 결과와 연결된 버전 artifact다.
- 외부 반영(공유·게시·원본 덮어쓰기)은 명시적인 사람 승인을 요구한다.
- private workflow와 rubric은 creator 소유이며, hirer에게는 안전한 결과·근거·공개 기준만
  전달한다.

## 구현 단위

```text
hireme-agent/
  runtime/                            # orchestration, project state, tool gateway
  design-harness-v0/                  # 현재 Design 전용 Harness
    skills/                           # 검증된 선언형 전문성
    tools/                            # capability allowlist와 audit policy
    workflows/                        # 재현 가능한 상태 전이
    memory/                           # 브랜드·프로젝트 기억 정책
    evals/                            # machine, critic, human gate
    schemas/                          # Project와 Skill contract
```

현재 구현은 `app/designer-app/electron/creatorWorker.mjs`, `app/designer-app/electron/creatorWorkerExecutor.mjs`,
`app/supabase/functions/creator-worker`, `app/supabase/migrations/202608060001_creator_worker_control_plane.sql`에 연결돼
있다. 예전 buyer-device `local_protected` 실행은 Desktop 제품 경로에서 제거했으며, 신규
Agent의 기본 실행 class는 `creator_worker`다.
