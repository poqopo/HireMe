# HireMe Desktop Design System

## Product Character

HireMe는 프리랜서가 매일 사용하는 조용한 작업 도구입니다. 마케팅 페이지처럼
보이기보다 채팅, 파일, 에이전트, 버전, 수익을 빠르게 읽고 반복 작업하기 좋은
데스크톱 생산성 앱이어야 합니다.

## Layout

```text
titlebar
sidebar | active workspace | contextual inspector
```

- Sidebar: 주요 메뉴, 새 작업, 최근 채팅, 작업 폴더
- Workspace: 채팅 또는 현재 관리 화면
- Inspector: 선택한 Agent, 작업, 가격, 버전, 정산의 상세 정보
- 1260px 미만에서는 inspector를 숨기고 본문에 집중
- 700px 미만에서는 sidebar를 drawer로 전환

## Color

중립 회색을 기본으로 하고 의미에 따라 여러 accent를 제한적으로 사용합니다.

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#f4f4f1` | 앱 바깥과 보조 배경 |
| Surface | `#ffffff` | 주요 작업 면 |
| Ink | `#20221f` | 기본 텍스트 |
| Line | `#dfe1db` | 분리선과 입력 테두리 |
| Green | `#1f6f52` | 완료, 보호, 사용량 수익 |
| Coral | `#c96341` | 구독, 주의가 필요한 강조 |
| Blue | `#476f98` | 정보와 글쓰기 Agent |
| Yellow | `#9b7420` | 검토와 대기 상태 |
| Violet | `#735f8e` | 디자인 Agent 보조 accent |

배경 gradient, 장식용 orb, 과도한 shadow는 사용하지 않습니다.

## Type

- System UI font와 Pretendard fallback
- 화면 제목 21~24px
- 패널 제목 14~16px
- 기본 UI 11~13px
- 금액과 시간에는 tabular figures
- viewport 폭에 따라 font-size를 비례 확대하지 않음
- letter-spacing은 항상 `0`

## Shape

- Card: 7px 이하
- Input/Button: 5~6px
- Icon button: 30x30px 고정
- Agent avatar: 정사각형 5~6px radius
- 익숙한 명령은 Lucide icon 사용
- hover tooltip이 필요한 icon-only button에는 `title`과 `aria-label` 제공

## Interaction

- Enter: 메시지 전송
- Shift+Enter: 줄바꿈
- 실행 중 Enter: 요청을 현재 채팅의 FIFO queue에 추가
- 실행은 다른 채팅으로 이동해도 계속 진행
- 실행 panel에 elapsed time, 현재 단계, queue count, cancel 표시
- 수익 또는 구독 작업은 비용 단위를 항상 함께 표시

## Content Rules

- `Harness 구매` 대신 `Agent 고용`, `실행 권한`, `결과` 사용
- `token`은 AI 입력+출력 사용량임을 가격 설정에서 설명
- 개발 용어보다 사용자가 받는 산출물과 다음 행동을 먼저 표시
- 데모 금액은 반드시 `데모`로 표시
- private Agent internals를 보여주거나 열람할 수 있는 UI를 만들지 않음
