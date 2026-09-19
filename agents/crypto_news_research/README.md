# Crypto News Research Agent

코인 뉴스의 공개 본문을 읽고, 문단별 출처와 연결된 리서치 인사이트 초안을 다른 에이전트에 전달합니다.

Tools: `fetch_today_crypto_news`, `collect_article_evidence`, `summarize_crypto_news`, `analyze_crypto_insights`.

Contents: AGENTS.md의 행동 규칙, 뉴스 검토 스킬, 일일 리서치 프롬프트, 출처 목록, 출력 계약.

실시간 모드(기본)는 CoinDesk와 Cointelegraph RSS를 Asia/Seoul 날짜로 필터링하고, 해당 발행사의 공개 HTML/JSON-LD에서 기사 본문을 읽습니다. 기사당 최대 24,000자, 기본 4개(최대 8개)를 읽으며 접근 제한 우회는 하지 않습니다. 본문 수집 실패는 상태로 남기고 인사이트를 생성하지 않습니다.

인사이트는 ‘본문 관측 → 해석 → 반대 설명 → 확인할 지표’ 구조이며 근거 문단과 원문 URL을 보존합니다. 생성 방식은 ETF·네트워크·활동·거시경제에 대한 **주제별 규칙 초안**입니다. LLM이나 독립적 사실 검증을 수행하지 않으며 이 제한을 결과 JSON과 화면에 표시합니다. MCP를 사용하는 LLM 호스트는 본문 근거와 프롬프트를 받아 추가 검토할 수 있습니다.

`mode="demo"`는 2026-09-19 가상 뉴스 4개와 각 3개 문단의 가상 본문을 사용합니다. 실제 뉴스가 아닙니다.

프로젝트 루트에서 실행:

```sh
uv run --project github_mcp python agents/crypto_news_research/agent.py
```

GitHub 시뮬레이션 분석:

```sh
uv run --project github_mcp github-mcp analyze-local agents/crypto_news_research \
  --github-url https://github.com/hireme-demo/crypto-news-research \
  --agent-name crypto_news_research --output github_mcp/output/news_analysis
```

등록용 이름: `crypto_news_research_mcp`.

두 에이전트 연결 예제와 HTML 보고서는 [상위 README](../README.md)를 참고하세요.
