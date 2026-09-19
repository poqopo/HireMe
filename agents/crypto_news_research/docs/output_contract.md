# Output contract

다음 에이전트에는 `analyze_crypto_insights` 결과를 전달합니다. 리서치 역할은 이 JSON에서 끝나며 시장 조회와 디자인은 별도 에이전트가 담당합니다.

필수 메타데이터: date, timezone, demo, mode, collectedAt, overview, highlights, insights, researchMeta.

각 highlight: id, headline, summary, assets(coin ID 목록), source, url, publishedAt.

highlight.article에는 sourceUrl, status(read/unavailable/not_requested), paragraphs([{id,text}])가 있습니다.

각 insight: articleId, assets, topic, title, observation, interpretation, counterpoint, watchMetrics, evidenceRefs([{articleId,paragraphId,url,kind}]), confidence, limitation.

observation은 원문에 보고된 관측이고 interpretation은 주제별 규칙의 해석 초안입니다. evidenceRefs는 기사 본문 문단까지 연결하며 시각화 에이전트가 참조 존재 여부를 검사합니다.

researchMeta에는 본문 수집 범위·오류·insightCount·llmUsed(false)가 있습니다. 본문 읽기 실패는 감추지 않습니다.

assets의 지원 ID는 bitcoin, ethereum, solana입니다. 코인명이 없는 거시경제 기사는 빈 목록으로 남깁니다. 뉴스와 코인 가격의 동시 표시는 인과관계를 의미하지 않습니다.
