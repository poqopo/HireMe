# Two-agent crypto research demo

기사 본문 리서치 → 근거와 연결된 인사이트 JSON → 시장 데이터와 인터랙티브 디자인의 두 에이전트 예제입니다.

| Agent | Tool | 결과 |
| --- | --- | --- |
| crypto_news_research | fetch_today_crypto_news → collect_article_evidence → summarize_crypto_news → analyze_crypto_insights | 본문 관측·해석 초안·반대 설명·확인 지표와 문단별 출처가 연결된 리서치 JSON |
| crypto_market_html | fetch_market_snapshot → build_crypto_market_html | 도미넌스 집합 도식·필터·본문 패널·가정 탐색을 갖춘 HTML |

각 폴더는 독립적으로 GitHub에 올릴 수 있는 예제 MCP 에이전트입니다. GitHub 분석기가 임의 Agent를 실행 가능한 서버로 변환한 것은 아닙니다.

## Offline demo

프로젝트 루트에서:

```sh
uv run --project github_mcp python github_mcp/scripts/run_demo.py \
  --mode demo --output github_mcp/output/crypto_research_interactive
```

2026-09-19로 고정된 **가상 뉴스·가상 본문·가상 시세**를 사용합니다. 두 예제를 GitHub API 스냅샷처럼 분석한 뒤 각각의 MCP 서버를 실행해 도구 6개를 연결합니다. 본문 4개·각 3개 문단을 읽고 인사이트 초안 4개를 생성합니다.

출력:

- crypto_news_research/manifest.json, contents.json, tools.json
- crypto_market_html/manifest.json, contents.json, tools.json
- news_digest.json, article_evidence.json, market_snapshot.json
- report.html, demo_receipt.json

기존 파일을 덮어쓰지 않으므로 다시 실행할 때 새 출력 폴더를 지정하세요.

## Live mode

```sh
uv run --project github_mcp python github_mcp/scripts/run_demo.py \
  --mode live --output github_mcp/output/crypto_market_live
```

실행 시점의 오늘(Asia/Seoul) RSS 뉴스, 발행사의 공개 기사 본문, CoinGecko의 최신 USD 시세를 가져옵니다. 본문은 공개 JSON-LD/기사 영역에서 읽으며 접근 제한을 우회하지 않습니다. 읽을 수 없는 기사는 RSS만 표시하고 본문 기반 인사이트를 만들지 않습니다.

요약은 RSS 발췌 정리이고 인사이트는 본문 근거와 주제별 규칙을 연결하는 초안입니다. **LLM 추론이나 독립적 사실 검증을 수행하지 않습니다.** MCP 호스트의 LLM이 본문·근거·프롬프트를 받아 추가 분석할 수 있는 구조입니다. 지난 날짜는 --date로 선택할 수 있지만 RSS에 남은 기사만 제공되며 시세는 현재 값입니다.

## Interactive design

BTC·비BTC·ETH 집합 다이어그램을 클릭하면 뉴스·인사이트·코인 카드가 필터링됩니다. 도미넌스 슬라이더는 실제 관측값과 분리된 가정 탐색이며 ETH/비BTC 기준 구성비를 유지합니다. 도식의 원 크기는 시가총액에 비례하지 않습니다.

본문 검색, 근거 문단 강조와 원문 위치 링크, 기사 상세 패널, 뉴스 카드/목록 전환, 리서치 JSON 내보내기를 제공합니다. HTML 한 파일로 동작하며 외부 스크립트나 폰트는 필요하지 않습니다.

라이브 연결 실패 시 오류를 반환합니다. 데모 자료로 자동 대체하지 않습니다. 선택적 COINGECKO_DEMO_API_KEY는 환경변수로 주입하고 소스 파일에 저장하지 마세요.

## Inspect the split

instructions는 항상 따를 규칙, prompt는 작업 요청 템플릿, reference는 출처 목록·입출력 계약·템플릿·데이터입니다. 두 manifest의 등록용 이름은 crypto_news_research_mcp와 crypto_market_html_mcp입니다. 시뮬레이션 저장소 주소와 커밋은 실제 게시된 GitHub 리소스가 아닙니다.
