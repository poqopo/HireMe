# HireMe Desktop Design System

## Product Character

HireMe는 디자이너가 자신의 판단 기준을 반복 가능한 서비스로 만들고, 고객이 그
서비스에 직접 작업을 맡기는 조용한 작업 도구입니다. 마케팅 페이지나 범용 이미지
생성기처럼 보이기보다 서비스, 고객 질문, 결과 기준, 주문, 버전과 수익을 빠르게
읽고 운영하기 좋은 데스크톱 생산성 앱이어야 합니다.

## Layout

```text
titlebar
sidebar | feedback thread | result canvas | expert system
```

- Sidebar: 주요 메뉴, 새 작업, 최근 채팅, 작업 폴더
- 첫 작업: 디자이너가 설정한 질문형 작업 주문서
- 실행 후 Workspace: 수정 요청 thread, 결과 중심 canvas, version history
- Expert System: 공개 가능한 목적과 적용된 질문·판단·품질 기준의 개수
- 1120px 미만에서는 Expert System panel을 숨기고 thread와 canvas에 집중
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

- 고객의 첫 작업 화면은 빈 프롬프트가 아니라 디자이너가 정의한 `User Ask Questions`로 시작
- 필수 질문에 답한 뒤에만 디자인 서비스 실행 가능
- 질문 답변은 작업 요청으로 저장하되 디자이너의 비공개 판단 기준은 사용자에게 표시하지 않음
- 실행 후에는 채팅 단독 화면이 아니라 결과 canvas를 중심으로 전환
- 수정 thread는 전체 방향과 추가 맥락에 사용하고, 결과 파일은 canvas와 version history에서 확인
- Claude Design의 canvas 패턴은 활용하되 자유 프롬프트가 아니라 디자이너의 질문과 Expert System이 작업의 시작점이 되도록 구분
- Enter: 메시지 전송
- Shift+Enter: 줄바꿈
- 실행 중 Enter: 요청을 현재 채팅의 FIFO queue에 추가
- 실행은 다른 채팅으로 이동해도 계속 진행
- 실행 panel에 elapsed time, 현재 단계, queue count, cancel 표시
- 수익 또는 구독 작업은 비용 단위를 항상 함께 표시

## Content Rules

- 디자인 영역에서는 `Agent 고용`보다 `디자인 서비스 이용`, `작업 맡기기`, `결과` 사용
- `token`은 AI 입력+출력 사용량임을 가격 설정에서 설명
- 개발 용어보다 사용자가 받는 산출물과 다음 행동을 먼저 표시
- 데모 금액은 반드시 `데모`로 표시
- private Agent internals를 보여주거나 열람할 수 있는 UI를 만들지 않음

## Design Decision System

디자이너가 정의하는 것은 팔레트와 스타일 키워드만이 아니라 결과를 가르는 판단
규칙입니다.

- Purpose: 결과가 달성해야 할 고객·브랜드 목적
- Priorities: 정보 위계와 선택의 우선순위
- Avoid: 브랜드를 평균적인 AI 결과로 만드는 금지 규칙
- Quality Bar: 결과 전달 전에 자동으로 확인할 통과 기준
- User Ask Questions: 고객에게 공개되는 하나 선택, 복수 선택, 짧은 답변, 긴 답변 질문

Purpose, Priorities, Avoid, Quality Bar는 creator-owned Private Harness에 저장합니다.
고객은 질문과 공개 설명만 보고, 실행 시 답변에 비공개 판단 시스템이 적용됩니다.
