# Renderer page boundary

`App.tsx`는 라우팅과 전역 오류 경계만 담당합니다. 화면 단위 코드는 이 폴더에,
재사용 가능한 UI는 `components/`, 외부 통신은 이후 `services/`, 상태는
`features/`로 분리합니다.

`DesignerWorkspacePage.tsx`는 기존 기능을 보존한 1차 이관본입니다. 신규 화면을
여기에 추가하지 않고, Studio, Agent authoring, Worker approval 순서로 별도 page와
feature 모듈로 추출합니다.
