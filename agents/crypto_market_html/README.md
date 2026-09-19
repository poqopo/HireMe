# Crypto Market HTML Agent

본문 근거·인사이트를 가진 리서치 JSON과 시장 금액을 결합해 단일 인터랙티브 HTML 보고서를 디자인합니다.

Tools: `fetch_market_snapshot`, `build_crypto_market_html`.

Contents: 행동 규칙, HTML 구성 스킬, 보고서 프롬프트, 입력 계약, HTML 템플릿.

실시간 모드(기본)는 CoinGecko의 [coins/markets](https://docs.coingecko.com/v3.0.1/reference/coins-markets)와 [global](https://docs.coingecko.com/v3.0.1/reference/crypto-global)을 사용합니다. USD 기준으로 가격·시가총액·24h 거래량·등락률과 전체 시장 값을 조회합니다. 선택적으로 COINGECKO_DEMO_API_KEY 환경변수를 사용할 수 있습니다. 제공자의 인증·요청 제한에 따라 오류가 발생할 수 있으며 데모로 자동 대체하지 않습니다.

`mode="demo"`는 2026-09-19 기준의 가상 시세를 사용합니다. 실제 시세가 아닙니다.

프로젝트 루트에서 실행:

```sh
uv run --project github_mcp python agents/crypto_market_html/agent.py
```

등록용 이름: `crypto_market_html_mcp`.

상호작용: BTC/비BTC/ETH 집합 다이어그램 클릭, 도미넌스 가정 슬라이더와 복원, 코인 필터, 본문·인사이트 검색, 카드/목록 전환, 근거 문단 강조를 포함한 기사 dialog, 원문 위치 링크, 리서치 JSON 내보내기.

BTC와 비BTC의 교집합은 없고 ETH는 비BTC의 부분집합입니다. 원은 집합 관계를 보여주는 도식이며 면적 비례가 아닙니다. 슬라이더는 가상 구성비만 바꾸며 실제 시세나 상단의 관측 비중을 변경하지 않습니다.

뉴스에 언급된 코인과 시세를 함께 배치하며, 뉴스가 가격 변동의 원인이라는 분석은 하지 않습니다. 실제 HTML 생성 연결 데모는 [상위 README](../README.md)를 참고하세요.
