"""Combine a news digest with market data into a self-contained HTML briefing."""

import html
import json
import math
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).resolve().parent
SYSTEM_PROMPT = "Design an interactive market report from a completed paragraph-grounded research handoff. Preserve sources and research limitations, visualize dominance as sets, and keep scenario controls separate from observed data."
mcp = FastMCP("crypto_market_html", instructions=SYSTEM_PROMPT)


def _get_json(path: str):
    headers = {"User-Agent": "HireMeCryptoMarket/0.1", "Accept": "application/json"}
    key = os.getenv("COINGECKO_DEMO_API_KEY")
    if key:
        headers["x-cg-demo-api-key"] = key
    try:
        with urlopen(Request("https://api.coingecko.com/api/v3/" + path, headers=headers), timeout=12) as response:
            body = response.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError("Market response exceeded size limit")
        return json.loads(body)
    except HTTPError as exc:
        raise ValueError(f"CoinGecko HTTP {exc.code}; check API access or request limits") from None
    except (URLError, TimeoutError, OSError):
        raise ValueError("CoinGecko connection failed") from None


@mcp.tool()
def fetch_market_snapshot(coins: list[str] | None = None,
                          mode: Literal["live", "demo"] = "live") -> dict[str, Any]:
    """Fetch USD prices, market caps, 24h volumes/changes and global market totals; or explicit demo data."""
    selected = list(dict.fromkeys(coins if coins is not None else ["bitcoin", "ethereum", "solana"]))
    if not 1 <= len(selected) <= 10 or any(not re.fullmatch(r"[a-z0-9-]+", coin) for coin in selected):
        raise ValueError("Provide 1..10 valid CoinGecko coin IDs")
    if mode not in {"live", "demo"}:
        raise ValueError("mode must be live or demo")
    if mode == "demo":
        data = json.loads((ROOT / "data/demo_market.json").read_text(encoding="utf-8"))
        data["coins"] = [coin for coin in data["coins"] if coin["id"] in selected]
        data["missingCoins"] = sorted(set(selected) - {coin["id"] for coin in data["coins"]})
        return {**data, "demo": True, "mode": mode, "collectedAt": datetime.now(timezone.utc).isoformat()}
    query = urlencode({"vs_currency": "usd", "ids": ",".join(selected), "sparkline": "false"})
    rows = _get_json("coins/markets?" + query)
    global_data = _get_json("global")["data"]
    observed = datetime.now(timezone.utc).isoformat()
    values = [{"id": coin["id"], "name": coin["name"], "symbol": coin["symbol"].upper(),
               "price": coin.get("current_price"), "marketCap": coin.get("market_cap"),
               "volume24h": coin.get("total_volume"), "change24h": coin.get("price_change_percentage_24h"),
               "lastUpdated": coin.get("last_updated")} for coin in rows]
    return {"currency": "USD", "mode": mode, "demo": False, "source": "CoinGecko",
            "sourceUrl": "https://www.coingecko.com/", "collectedAt": observed,
            "asOf": observed, "globalUpdatedAt": datetime.fromtimestamp(global_data["updated_at"], timezone.utc).isoformat()
            if global_data.get("updated_at") else None,
            "global": {"marketCap": global_data["total_market_cap"].get("usd"),
                       "volume24h": global_data["total_volume"].get("usd"),
                       "btcDominance": global_data.get("market_cap_percentage", {}).get("btc"),
                       "ethDominance": global_data.get("market_cap_percentage", {}).get("eth")},
            "coins": values, "missingCoins": sorted(set(selected) - {coin["id"] for coin in values})}


def _escape(value) -> str:
    return html.escape(str(value), quote=True)


def _number(value) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def _money(value, compact=False) -> str:
    number = _number(value)
    if number is None:
        return "미제공"
    if compact:
        for divisor, suffix in [(1e12, "T"), (1e9, "B"), (1e6, "M")]:
            if abs(number) >= divisor:
                return f"${number / divisor:,.2f}{suffix}"
    return f"${number:,.2f}"


def _change(value) -> tuple[str, str]:
    number = _number(value)
    if number is None:
        return "미제공", "neutral"
    return f"{number:+.2f}%", "up" if number > 0 else "down" if number < 0 else "neutral"


def _link(value) -> str:
    parsed = urlsplit(str(value))
    return _escape(value) if parsed.scheme == "https" and parsed.hostname and not parsed.username else "#"


def _json_for_html(value) -> str:
    # Data remains JSON, never executable interpolation. '<' cannot close the script element.
    text = json.dumps(value, ensure_ascii=False, allow_nan=False)
    for original, escaped in [("&", "\\u0026"), ("<", "\\u003c"), (">", "\\u003e"),
                               ("\u2028", "\\u2028"), ("\u2029", "\\u2029")]:
        text = text.replace(original, escaped)
    return text


@mcp.tool()
def build_crypto_market_html(news_digest: dict[str, Any], market_snapshot: dict[str, Any],
                              title: str = "오늘의 코인 시장 브리핑") -> str:
    """Design standalone interactive HTML with paragraph-linked insights, article dialogs, market filters and dominance scenarios."""
    if market_snapshot["currency"] != "USD":
        raise ValueError("This template expects USD market values")
    highlights = news_digest["highlights"]
    insights = news_digest.get("insights", [])
    article_map = {item["id"]: item for item in highlights}
    for insight in insights:
        if not insight.get("evidenceRefs"):
            raise ValueError("Insight must include source paragraph references")
        for ref in insight.get("evidenceRefs", []):
            item = article_map.get(ref["articleId"])
            if not item or ref["paragraphId"] not in {p["id"] for p in item.get("article", {}).get("paragraphs", [])}:
                raise ValueError("Insight references an unavailable article paragraph")
    rows, cards, news_cards, comparison, insight_cards = [], [], [], [], []
    magnitude = max([abs(_number(c.get("change24h")) or 0) for c in market_snapshot["coins"]] + [1])
    for coin in market_snapshot["coins"]:
        change, direction = _change(coin.get("change24h"))
        related = [(i, item) for i, item in enumerate(highlights) if coin["id"] in item.get("assets", [])]
        related_links = "".join(f'<a href="#news-{i}" data-open-article="{i}">{_escape(item["headline"])}</a>' for i, item in related)
        related_links = related_links or '<span class="muted">수집된 뉴스에서 해당 코인 언급 없음</span>'
        cards.append(f'<article class="coin-card" data-filter-assets="{_escape(coin["id"])}"><div class="coin-top"><span class="coin-symbol">{_escape(coin["symbol"])}</span>'
                     f'<span class="change {direction}">{change}</span></div><h3>{_escape(coin["name"])}</h3>'
                     f'<div class="coin-price">{_money(coin.get("price"))}</div>'
                     f'<div class="coin-meta">시가총액 {_money(coin.get("marketCap"), True)} · 24h 거래량 {_money(coin.get("volume24h"), True)}</div>'
                     f'<div class="related"><span class="eyebrow">관련 뉴스 · {len(related)}건</span>{related_links}</div></article>')
        rows.append(f'<tr data-filter-assets="{_escape(coin["id"])}"><th scope="row">{_escape(coin["name"])}</th><td>{_money(coin.get("price"))}</td>'
                    f'<td class="{direction}">{change}</td><td>{_money(coin.get("marketCap"), True)}</td>'
                    f'<td>{_money(coin.get("volume24h"), True)}</td><td>{_escape(coin.get("lastUpdated") or "미제공")}</td></tr>')
        width = abs(_number(coin.get("change24h")) or 0) / magnitude * 100
        comparison.append(f'<div class="bar-row" data-filter-assets="{_escape(coin["id"])}"><span>{_escape(coin["symbol"])}</span><div class="bar-track">'
                          f'<div class="bar {direction}" style="width:{width:.1f}%"></div></div><strong class="{direction}">{change}</strong></div>')
    for i, item in enumerate(highlights):
        tags = "".join(f'<span class="tag">{_escape(asset.upper())}</span>' for asset in item.get("assets", [])) or '<span class="tag">MARKET</span>'
        assets = " ".join(item.get("assets", [])) or "macro"
        body_read = item.get("article", {}).get("status") == "read"
        body_label = "본문 확인" if body_read else "RSS만 확인"
        news_cards.append(f'<article id="news-{i}" class="news-card" data-news-index="{i}" data-filter-assets="{_escape(assets)}"><div class="news-meta">{_escape(item["source"])}'
                          f' · {_escape(item["publishedAt"])}{tags}</div><h3><a href="{_link(item["url"])}"'
                          f' target="_blank" rel="noopener noreferrer">{_escape(item["headline"])}</a></h3>'
                          f'<p>{_escape(item["summary"])}</p><div class="news-actions"><span class="body-status">{body_label}</span>'
                          f'<button type="button" data-open-article="{i}">본문 · 인사이트 보기 <span aria-hidden="true">↗</span></button></div></article>')
    for insight in insights:
        source_index = next(i for i, item in enumerate(highlights) if item["id"] == insight["articleId"])
        refs = "".join(f'<button type="button" class="evidence-button" data-open-article="{source_index}"'
                       f' data-paragraph="{_escape(ref["paragraphId"])}">근거 {index + 1} · {_escape(ref["paragraphId"])}</button>'
                       for index, ref in enumerate(insight["evidenceRefs"]))
        metrics = "".join(f'<li>{_escape(metric)}</li>' for metric in insight["watchMetrics"])
        assets = " ".join(insight.get("assets", [])) or "macro"
        insight_cards.append(f'<article class="insight-card" data-filter-assets="{_escape(assets)}" data-insight-article="{source_index}">'
                             f'<div class="insight-top"><span class="eyebrow">{_escape(insight["topic"].replace("_", " "))}</span>'
                             f'<span class="draft-tag">규칙 기반 초안</span></div><h3>{_escape(insight["title"])}</h3>'
                             f'<div class="insight-step"><span>본문 관측</span><p>{_escape(insight["observation"])}</p></div>'
                             f'<div class="insight-step interpretation"><span>리서치 해석</span><p>{_escape(insight["interpretation"])}</p></div>'
                             f'<details><summary>반대 설명과 확인할 지표</summary><p>{_escape(insight["counterpoint"])}</p>'
                             f'<ul>{metrics}</ul></details><div class="evidence-links">{refs}</div></article>')
    news_demo, market_demo = bool(news_digest.get("demo")), bool(market_snapshot.get("demo"))
    badge = "DEMO · 가상 뉴스 / 가상 시세" if news_demo and market_demo else (
        "MIXED · 일부 데이터는 데모" if news_demo or market_demo else "LIVE · 뉴스 / 시세")
    global_data = market_snapshot["global"]
    dominance = _number(global_data.get("btcDominance"))
    eth_dominance = _number(global_data.get("ethDominance"))
    dominance = dominance if dominance is not None and 0 <= dominance <= 100 else None
    eth_dominance = eth_dominance if eth_dominance is not None and 0 <= eth_dominance <= 100 else None
    if dominance is not None and eth_dominance is not None and dominance + eth_dominance > 100:
        eth_dominance = None
    alt_dominance = 100 - dominance if dominance is not None else None
    issues = list(news_digest.get("errors", []))
    if market_snapshot.get("missingCoins"):
        issues.append("시세 미제공: " + ", ".join(market_snapshot["missingCoins"]))
    issues.extend(error["error"] for error in news_digest.get("researchMeta", {}).get("articleErrors", []))
    template = Template((ROOT / "templates/report.html").read_text(encoding="utf-8"))
    questions = "".join(f'<div class="research-check"><span>{index + 1:02d}</span><div><h3>{_escape(insight["title"])}</h3>'
                        f'<p>확인 지표: {_escape(insight["watchMetrics"][0])}</p></div></div>' for index, insight in enumerate(insights[:3]))
    questions = questions or '<p class="research-intro">확인된 본문 근거가 부족해 인사이트를 만들지 않았습니다. 뉴스 출처와 자료 수집 상태를 먼저 확인하세요.</p>'
    return template.substitute(
        page_title=_escape(title), date=_escape(news_digest["date"]), badge=_escape(badge),
        overview=_escape(news_digest["overview"]), news_count=len(highlights), coin_count=len(market_snapshot["coins"]),
        market_cap=_money(global_data.get("marketCap"), True), volume=_money(global_data.get("volume24h"), True),
        dominance=f"{dominance:.1f}%" if dominance is not None else "미제공", coins="".join(cards),
        alt_dominance=f"{alt_dominance:.1f}%" if alt_dominance is not None else "미제공",
        eth_dominance=f"{eth_dominance:.1f}%" if eth_dominance is not None else "미제공",
        dominance_value=dominance if dominance is not None else 0,
        dominance_disabled="" if dominance is not None else "disabled",
        insights="".join(insight_cards), insight_count=len(insights),
        research_questions=questions,
        research_status=f"본문 {news_digest.get('researchMeta', {}).get('articleCoverage', {}).get('read', 0)}건 · 인사이트 {len(insights)}개 · 규칙 기반 초안",
        report_data=_json_for_html({"news": news_digest, "market": market_snapshot,
                                    "dominance": {"btc": dominance, "eth": eth_dominance}}),
        comparison="".join(comparison), rows="".join(rows),
        news="".join(news_cards) or '<p class="empty">해당 날짜의 뉴스가 없습니다.</p>',
        news_time=_escape(news_digest["collectedAt"]), market_time=_escape(market_snapshot["asOf"]),
        market_source=_escape(market_snapshot["source"]), market_link=_link(market_snapshot["sourceUrl"]),
        issues="".join(f'<p class="issue">{_escape(issue)}</p>' for issue in issues))


@mcp.prompt()
def market_html_brief(date: str) -> str:
    """Prepare the market and news composition workflow."""
    return (ROOT / "prompts/market_report.md").read_text(encoding="utf-8").replace("{{date}}", date)


@mcp.resource("market://demo-snapshot")
def demo_market_snapshot() -> str:
    """Read the explicitly fictional market snapshot used in offline tests."""
    return (ROOT / "data/demo_market.json").read_text(encoding="utf-8")


if __name__ == "__main__":
    mcp.run(transport="stdio")
