# Input contract

`news_digest`는 crypto_news_research의 analyze_crypto_insights 결과입니다. highlights[].article에 본문 문단이 있고 insights[].evidenceRefs는 그 기사 ID·문단 ID를 참조합니다. 존재하지 않는 참조는 HTML 생성 단계에서 거부합니다.

`market_snapshot`는 fetch_market_snapshot 결과입니다. currency는 USD이고, global에는 marketCap, volume24h, btcDominance가 있습니다. coins에는 id, name, symbol, price, marketCap, volume24h, change24h, lastUpdated가 있습니다.

global.ethDominance는 선택 사항이며 없을 때 추정하지 않습니다. BTC+ETH 비중이 100%를 넘으면 ETH 구성 값을 표시하지 않습니다.

슬라이더는 BTC 비중을 가정하고 비BTC를 100-BTC로 계산합니다. ETH는 기준 시점의 ‘ETH/비BTC’ 구성비를 유지하는 가정입니다. 원 크기는 면적 비례가 아닌 집합 관계 도식이며, 시세 표·관측 BTC 비중은 바뀌지 않습니다.

24시간 가격 변화와 같은 날의 뉴스는 관측 시점과 기간이 다를 수 있습니다. 이 예제는 연관 코인별로 자료를 함께 배치하며 가격 원인을 추론하지 않습니다.

가상 뉴스와 가상 시세를 실제 값으로 표시하지 않습니다. 혼합된 입력은 MIXED로 표시합니다.
