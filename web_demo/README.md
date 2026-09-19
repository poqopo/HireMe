# HireMe Web Demo

HireMe의 에이전트 조립·실행 경험을 체험하는 한국어 웹 데모입니다.

## 실행

Node.js 20.9 이상이 필요합니다.

먼저 별도 터미널에서 에이전트 런타임을 실행합니다.

```bash
cd hireme_agent
uv run --with-editable ../github_mcp --with-editable . hireme-agent-api
```

```bash
cd web_demo
npm ci
npm run dev
```

http://localhost:3000 에서 확인합니다.

## 구성

- Next.js App Router + TypeScript + Tailwind CSS v4
- Next.js 기본 빌드 도구인 Turbopack 사용 (Vite는 사용하지 않음)
- React Flow: 드래그, 확대·축소, 포트 연결, 연결선 제거
- Lucide: UI 아이콘

## 디자인

흰색 배경과 파란색 (#2563eb) 포인트 컬러를 사용한 작업 화면입니다. 채팅, 에이전트 노드와 결과를 3열로 배치하고, 얇은 구분선과 가벼운 카드로 영역을 구분합니다. Inter는 패키지에 포함된 폰트 파일로 제공합니다. 모바일에서는 에이전트 목록을 접고 결과 패널을 아래에 표시합니다.

## 체험

1. 왼쪽에서 에이전트를 검색하거나 카테고리로 필터링합니다. + / 체크 버튼으로 추가·제거할 수 있습니다.
2. 기본 리서치 팀은 Paper Research → Evidence Structurer → Report Writer입니다. 노드 설정 버튼이나 목록의 이름을 누르면 에이전트 정보를 확인합니다.
3. 노드 양옆 포트를 드래그해 연결합니다. 연결선을 선택하고 Delete / Backspace로 제거합니다. 연결 초기화는 기본 순서로 연결하고 위치를 복원합니다. 에이전트 추가·제거 시에도 기본 연결이 다시 생성됩니다.
4. 질문을 입력하거나 예시 질문을 선택합니다. Enter로 실행하고 Shift+Enter로 줄바꿈합니다.
5. 연결 그래프의 순서를 따라 에이전트를 실행합니다. 모든 에이전트가 질문 및 결과와 연결되어 있어야 하며 순환 연결은 실행할 수 없습니다. 분기된 흐름도 데모에서는 순서대로 실행합니다.
6. 오른쪽에서 결과와 실행 내역, 성공한 단계의 예시 비용을 확인합니다. 결과를 복사하거나 Markdown으로 다운로드할 수 있습니다.
7. 실행 중에는 전송 버튼이 중지 버튼으로 바뀝니다. 최근 대화는 현재 브라우저 세션의 메모리에 저장됩니다. 새로고침하면 초기화됩니다.
8. 작은 화면에서는 왼쪽 메뉴를 접고 결과 패널을 채팅·캔버스 아래에 표시합니다.

## 런타임 연결

선택한 에이전트는 그래프 순서대로 `hireme_agent`에 전달됩니다. 런타임은 각 에이전트의 MCP 도구와 프롬프트 목록에서 하나를 선택하고, 이전 단계의 구조화된 출력을 다음 단계 입력으로 전달합니다. 결과 패널의 실행 내역에는 선택된 도구와 프롬프트가 나타납니다.

Next.js는 `/api/runs`를 `http://127.0.0.1:8000/runs`로 프록시합니다. 런타임을 다른 주소에 배포할 경우 `HIREME_AGENT_URL` 환경변수를 설정하세요. 가격은 아직 테스트 표시이며 결제·정산은 수행하지 않습니다. 모델 기반 워크플로 실행에는 런타임의 `OPENAI_API_KEY`가 필요합니다.

에이전트 추가 버튼은 이름과 GitHub 링크를 받아 `github_mcp` 분석을 실행합니다. 기존 서버가 있다면 URL을 등록하고, 이후 워크플로는 `POST {server_url}`로 `{ task, context, config }`를 보냅니다. 서버는 JSON 객체 또는 `{ "result": { ... } }` 형태를 반환해야 합니다. 자체 호스팅을 선택하면 런타임이 `/agents/{agent_id}/run` URL을 발급합니다.

## 검증 및 프로덕션 실행

```bash
npm run lint
npm run typecheck
npm run build
npm start
```
