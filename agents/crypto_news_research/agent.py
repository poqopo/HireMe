"""Crypto news research: collect today's RSS items and produce a source-linked digest."""

import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date as Date, datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).resolve().parent
KST = ZoneInfo("Asia/Seoul")
SYSTEM_PROMPT = "Read crypto article bodies, connect every observation and insight to source paragraphs, distinguish reported facts from hypotheses, and hand off a research brief without designing the market report."
mcp = FastMCP("crypto_news_research", instructions=SYSTEM_PROMPT)


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def _plain(value: str) -> str:
    parser = PlainText()
    parser.feed(value)
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


def _read_feed(source: dict, target_date: str) -> tuple[list, str | None]:
    try:
        request = Request(source["url"], headers={"User-Agent": "HireMeCryptoNews/0.1", "Accept": "application/rss+xml,application/xml"})
        with urlopen(request, timeout=12) as response:
            body = response.read(2_000_001)
        if len(body) > 2_000_000 or b"<!DOCTYPE" in body.upper() or b"<!ENTITY" in body.upper():
            raise ValueError("Unsupported or oversized RSS feed")
        root = ElementTree.fromstring(body)
        items = []
        for entry in root.findall("./channel/item"):
            try:
                published = parsedate_to_datetime(entry.findtext("pubDate", ""))
                if published.tzinfo is None:
                    published = published.replace(tzinfo=timezone.utc)
                if published.astimezone(KST).date().isoformat() != target_date:
                    continue
                if published > datetime.now(timezone.utc):
                    continue
            except (ValueError, TypeError, OverflowError):
                continue
            title = _plain(entry.findtext("title", ""))
            link = entry.findtext("link", "").strip()
            if not title or not link.startswith("https://"):
                continue
            items.append({"id": hashlib.sha256(link.encode()).hexdigest()[:12], "title": title,
                          "excerpt": _plain(entry.findtext("description", ""))[:240],
                          "url": link, "source": source["name"], "publishedAt": published.isoformat()})
        return items, None
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, ElementTree.ParseError) as exc:
        status = getattr(exc, "code", None)
        return [], f"{source['name']}: HTTP {status}" if status else f"{source['name']}: feed unavailable"


@mcp.tool()
def fetch_today_crypto_news(date: str | None = None, limit: int = 6,
                            mode: Literal["live", "demo"] = "live") -> dict[str, Any]:
    """Collect crypto news for a YYYY-MM-DD date in Asia/Seoul; live RSS or explicit demo fixtures."""
    if not 1 <= limit <= 30:
        raise ValueError("limit must be between 1 and 30")
    if mode not in {"live", "demo"}:
        raise ValueError("mode must be live or demo")
    if mode == "demo":
        fixture = json.loads((ROOT / "data/demo_news.json").read_text(encoding="utf-8"))
        target = date or fixture["date"]
    else:
        target = date or datetime.now(KST).date().isoformat()
    if Date.fromisoformat(target).isoformat() != target:
        raise ValueError("date must be YYYY-MM-DD")
    if mode == "demo":
        if target != fixture["date"]:
            raise ValueError("Demo news is fixed to " + fixture["date"])
        return {**fixture, "items": fixture["items"][:limit], "demo": True, "mode": mode,
                "collectedAt": datetime.now(timezone.utc).isoformat(), "errors": []}
    sources = json.loads((ROOT / "data/sources.json").read_text(encoding="utf-8"))
    with ThreadPoolExecutor(max_workers=2) as pool:
        batches = list(pool.map(lambda source: _read_feed(source, target), sources))
    errors = [error for _, error in batches if error]
    if len(errors) == len(sources):
        raise ValueError("All news feeds failed: " + "; ".join(errors))
    items = {item["url"]: item for articles, _ in batches for item in articles}
    ordered = sorted(items.values(), key=lambda item: datetime.fromisoformat(item["publishedAt"]), reverse=True)
    return {"date": target, "timezone": "Asia/Seoul", "mode": mode, "demo": False,
            "collectedAt": datetime.now(timezone.utc).isoformat(), "items": ordered[:limit], "errors": errors}


@mcp.tool()
def summarize_crypto_news(news: dict[str, Any], max_items: int = 5) -> dict[str, Any]:
    """Create an extractive news digest with short feed excerpts, source links, and detected coin mentions."""
    if not 1 <= max_items <= 30:
        raise ValueError("max_items must be between 1 and 30")
    aliases = {"bitcoin": r"\b(bitcoin|btc)\b|비트코인", "ethereum": r"\b(ethereum|eth)\b|이더리움",
               "solana": r"\b(solana|sol)\b|솔라나"}
    highlights = []
    for article in news["items"][:max_items]:
        combined = article["title"] + " " + article.get("excerpt", "")
        assets = [coin for coin, pattern in aliases.items() if re.search(pattern, combined, re.I)]
        highlights.append({"id": article["id"], "headline": article["title"],
                           "summary": article.get("excerpt", "")[:200] or article["title"],
                           "assets": assets, "source": article["source"], "url": article["url"],
                           "publishedAt": article["publishedAt"]})
    return {"date": news["date"], "timezone": news["timezone"], "demo": news["demo"],
            "mode": news["mode"], "collectedAt": news["collectedAt"], "method": "extractive_rss_digest",
            "overview": f"{news['date']} 코인 시장 뉴스 {len(highlights)}건을 정리했습니다." if highlights else
                        f"{news['date']}에 발행된 뉴스를 찾지 못했습니다.",
            "highlights": highlights, "errors": news.get("errors", [])}


def _validate_article_url(url: str):
    parsed = urlsplit(url)
    hosts = {"coindesk.com", "www.coindesk.com", "cointelegraph.com", "www.cointelegraph.com"}
    if (parsed.scheme != "https" or parsed.hostname not in hosts or parsed.username or parsed.password
            or parsed.port not in {None, 443}):
        raise ValueError("Article URL must use HTTPS on a configured news publisher")


class ArticleRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_article_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ArticleParser(HTMLParser):
    """Prefer public NewsArticle JSON-LD; otherwise only paragraph text in article containers."""

    def __init__(self):
        super().__init__()
        self.stack = []
        self.parts = []
        self.paragraphs = []
        self.json_blocks = []
        self.json_parts = []
        self.in_json = False
        self.paywalled = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.stack.append((tag, attrs))
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self.in_json = True
            self.json_parts = []
        if tag == "p":
            self.parts = []

    def handle_endtag(self, tag):
        if tag == "script" and self.in_json:
            self.json_blocks.append("".join(self.json_parts))
            self.in_json = False
        if tag == "p" and self.parts:
            text = re.sub(r"\s+", " ", "".join(self.parts)).strip()
            if len(text) >= 40:
                self.paragraphs.append(text)
            self.parts = []
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_data(self, data):
        if self.in_json:
            self.json_parts.append(data)
            return
        if any(tag in {"script", "style", "nav", "aside"} for tag, _ in self.stack):
            return
        container = any(tag == "article" or attrs.get("itemprop") == "articleBody"
                        or any(key in attrs.get("class", "").lower()
                               for key in ["article-body", "article-content", "article__body", "article__content", "post-content", "post__content"])
                        or attrs.get("data-testid") == "article-content"
                        for tag, attrs in self.stack)
        if container and any(tag == "p" for tag, _ in self.stack):
            self.parts.append(data)

    def body(self) -> tuple[list[str], str]:
        def find(value):
            if isinstance(value, list):
                for item in value:
                    yield from find(item)
            elif isinstance(value, dict):
                types = value.get("@type", [])
                types = [types] if isinstance(types, str) else types
                if any(t in {"NewsArticle", "Article", "ReportageNewsArticle"} for t in types):
                    if value.get("isAccessibleForFree") in (False, "False", "false"):
                        self.paywalled = True
                        return
                    body = value.get("articleBody")
                    if isinstance(body, str) and len(body) >= 150:
                        yield body
                if "@graph" in value:
                    yield from find(value["@graph"])
        for block in self.json_blocks:
            try:
                bodies = list(find(json.loads(block)))
            except (ValueError, TypeError):
                continue
            if bodies:
                body = max(bodies, key=len)
                parts = [re.sub(r"\s+", " ", p).strip() for p in body.splitlines() if p.strip()]
                return parts, "public_json_ld"
        return ([], "restricted") if self.paywalled else (list(dict.fromkeys(self.paragraphs)), "article_html")


def _fetch_article(item: dict) -> dict:
    base = {"articleId": item["id"], "sourceUrl": item["url"], "paragraphs": [], "status": "unavailable"}
    try:
        _validate_article_url(item["url"])
        request = Request(item["url"], headers={"User-Agent": "HireMeCryptoResearch/0.2", "Accept": "text/html"})
        with build_opener(ArticleRedirects()).open(request, timeout=8) as response:
            _validate_article_url(response.geturl())
            content = response.read(2_000_001)
        if len(content) > 2_000_000:
            raise ValueError("Article response is too large")
        parser = ArticleParser()
        parser.feed(content.decode("utf-8", errors="replace"))
        parts, method = parser.body()
        if sum(len(p) for p in parts) < 150:
            return {**base, "error": "Readable public article body was not found; no paywall or JS bypass attempted"}
        paragraphs, count = [], 0
        for text in parts:
            text = text[:min(3000, 24000 - count)]
            if not text:
                break
            paragraphs.append({"id": f"P{len(paragraphs) + 1}", "text": text})
            count += len(text)
        return {**base, "status": "read", "method": method, "paragraphs": paragraphs,
                "truncated": count < sum(len(p) for p in parts)}
    except (ValueError, HTTPError, URLError, TimeoutError, OSError):
        return {**base, "error": "Article could not be read from the configured public source"}


@mcp.tool()
def collect_article_evidence(news: dict[str, Any], max_articles: int = 4) -> dict[str, Any]:
    """Read public article bodies into source-linked paragraph evidence; keep failures explicit and demo bodies separate."""
    if not 1 <= max_articles <= 8:
        raise ValueError("max_articles must be between 1 and 8")
    selected = news["items"][:max_articles]
    if news["demo"]:
        fixtures = json.loads((ROOT / "data/demo_articles.json").read_text(encoding="utf-8"))
        articles = []
        for item in selected:
            paragraphs = fixtures.get(item["id"], [])
            articles.append({"articleId": item["id"], "sourceUrl": item["url"], "status": "read" if paragraphs else "unavailable",
                             "method": "fictional_demo_body", "paragraphs": paragraphs, "truncated": False})
    else:
        with ThreadPoolExecutor(max_workers=3) as pool:
            articles = list(pool.map(_fetch_article, selected))
    return {**news, "articleEvidence": articles,
            "articleCoverage": {"requested": len(selected), "read": sum(a["status"] == "read" for a in articles),
                                "notRequested": len(news["items"]) - len(selected)}}


def _insight_profile(text: str) -> dict:
    if re.search(r"\betf\b|자금.*흐름|순유입", text, re.I):
        return {"topic": "institutional_flows", "title": "ETF 순유입과 시장 전체 수요를 구분해서 보기",
                "interpretation": "일부 ETF의 순유입은 해당 상품의 수요 단서입니다. 전체 ETF 합계와 지속 기간을 확인해야 시장 전반의 수요로 확장해 해석할 수 있습니다.",
                "counterpoint": "다른 상품의 순유출이나 파생상품 포지션이 관측을 상쇄할 수 있으며, 당일 가격 변화의 원인으로 단정할 수 없습니다.",
                "watchMetrics": ["전체 현물 ETF의 5일 누적 순유입", "BTC 도미넌스", "선물 미결제약정·펀딩비"]}
    if re.search(r"수수료|fees?|layer.?2|l2", text, re.I):
        return {"topic": "network_economics", "title": "수수료 하락을 네트워크 수요 감소와 구분하기",
                "interpretation": "수수료 변화는 활동량뿐 아니라 처리 효율과 L2 이동의 영향을 받을 수 있습니다. 활성 주소·거래 건수와 함께 읽어야 합니다.",
                "counterpoint": "주소 수만으로 경제적 수요를 판정할 수 없고, 낮은 수수료가 토큰 가치에 미치는 방향도 이 기사만으로 확정되지 않습니다.",
                "watchMetrics": ["L1·L2 활성 주소와 거래 건수", "네트워크 수수료·소각량", "ETH/BTC 상대 가격"]}
    if re.search(r"솔라나|\bsolana\b|dex|거래 활동", text, re.I):
        return {"topic": "activity_quality", "title": "거래량보다 지속성과 참여의 질을 함께 보기",
                "interpretation": "거래 활동 증가는 관찰할 신호이지만 사용자 구성과 유동성의 지속 여부가 중요합니다. 같은 조건의 기간 비교가 필요합니다.",
                "counterpoint": "봇·반복 거래·일회성 이벤트가 활동 지표를 키울 수 있으므로 신규 수요와 동일시하지 않습니다.",
                "watchMetrics": ["DEX 거래량과 고유 거래자", "유동성·TVL의 7일 변화", "네트워크 실패율과 반복 거래 비중"]}
    return {"topic": "macro_context", "title": "거시경제 배경과 코인 시장 관측을 분리하기",
            "interpretation": "금리·달러·유동성은 시장을 읽는 배경 변수입니다. 기사 시각과 각 지표의 관측 기간을 맞춰 비교해야 합니다.",
            "counterpoint": "단일 뉴스와 하루 등락만으로 인과관계를 검증할 수 없으며, 서로 다른 기간의 값은 직접적인 비교 근거가 아닙니다.",
            "watchMetrics": ["달러 지수와 국채 금리", "시장 전체 거래량", "BTC·알트코인 상대 수익률"]}


@mcp.tool()
def analyze_crypto_insights(news_digest: dict[str, Any], enriched_news: dict[str, Any]) -> dict[str, Any]:
    """Build paragraph-grounded insight drafts separating reported observations, interpretations, counterpoints, and watch metrics. Uses explicit topic rules, not an LLM."""
    if (news_digest["date"] != enriched_news["date"] or news_digest["demo"] != enriched_news["demo"]):
        raise ValueError("Digest and article evidence must belong to the same date and data mode")
    evidence = {a["articleId"]: a for a in enriched_news.get("articleEvidence", [])}
    highlights, insights = [], []
    for item in news_digest["highlights"]:
        article = evidence.get(item["id"], {"articleId": item["id"], "sourceUrl": item["url"],
                                             "status": "not_requested", "paragraphs": []})
        if article["sourceUrl"] != item["url"]:
            raise ValueError("Article evidence URL does not match the digest source")
        highlights.append({**item, "article": article})
        if article["status"] != "read" or not article["paragraphs"]:
            continue
        paragraphs = article["paragraphs"]
        text = item["headline"] + " " + " ".join(p["text"] for p in paragraphs)
        profile = _insight_profile(text)
        refs = [{"articleId": item["id"], "paragraphId": p["id"], "url": item["url"],
                 "kind": "observation" if index == 0 else "context"}
                for index, p in enumerate([paragraphs[0]] + ([paragraphs[-1]] if len(paragraphs) > 1 else []))]
        insights.append({"id": "INSIGHT-" + item["id"], "articleId": item["id"], "assets": item["assets"],
                         **profile, "observation": paragraphs[0]["text"][:300], "evidenceRefs": refs,
                         "confidence": "rule_based_draft", "source": item["source"],
                         "limitation": "주제별 규칙으로 만든 해석 초안이며 독립적 사실 검증이나 LLM 심층 추론은 수행하지 않았습니다."})
    actual_coverage = {"requested": len(evidence), "read": sum(a["status"] == "read" for a in evidence.values()),
                       "notRequested": max(0, len(enriched_news["items"]) - len(evidence))}
    return {**news_digest, "highlights": highlights, "insights": insights, "method": "body_grounded_rules",
            "researchMeta": {"articleCoverage": actual_coverage,
                             "insightCount": len(insights), "llmUsed": False,
                             "articleErrors": [{"articleId": a["articleId"], "error": a.get("error", "Body unavailable")}
                                               for a in evidence.values() if a["status"] != "read"]}}


@mcp.prompt()
def crypto_news_brief(date: str) -> str:
    """Prepare the crypto news research workflow for a date."""
    return (ROOT / "prompts/daily_news.md").read_text(encoding="utf-8").replace("{{date}}", date)


@mcp.resource("news://sources")
def news_sources() -> str:
    """Read the configured crypto RSS publishers."""
    return (ROOT / "data/sources.json").read_text(encoding="utf-8")


if __name__ == "__main__":
    mcp.run(transport="stdio")
