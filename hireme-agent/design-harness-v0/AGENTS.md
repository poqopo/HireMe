# Design Harness Orchestration

## Main agent

Design Director가 하나의 Job을 소유한다. 요청을 정규화하고 필요한 Skill과 Tool을
선택하며, 결과와 평가 증거를 하나의 manifest로 묶는다.

## Built-in subagents

- `brief-interpreter`: 목적, 대상, 채널, 제약, 불확실성을 구조화한다.
- `brand-guardian`: 브랜드 자산과 시각 규칙의 위반을 차단한다.
- `concept-explorer`: 서로 다른 전략을 가진 시안 방향을 만든다.
- `production-designer`: 선택된 방향을 실제 전달 규격으로 제작한다.
- `design-critic`: 독립된 기준으로 결과를 평가하고 실패 이유를 기록한다.

Subagent는 선언된 capability만 요청할 수 있다. Shell이나 임의 실행 파일은 v0에서
허용하지 않는다. Main agent는 실패한 평가를 숨기거나 결과 manifest를 직접
통과 처리할 수 없다.

## Execution order

`intake → normalize → plan → explore → produce → machine-eval → critic-eval → creator-approval → delivery`

각 단계의 입력과 출력은 `schemas/design-project.schema.json`을 따른다. Job이 고정한
Harness revision, package digest, workflow id는 실행 중 변경되지 않는다.
