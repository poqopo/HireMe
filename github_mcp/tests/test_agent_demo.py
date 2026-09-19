import asyncio
import importlib.util
import io
import json
import sys
import unittest
from contextlib import AsyncExitStack
from pathlib import Path
from unittest.mock import patch

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.shared.memory import create_connected_server_and_client_session

from github_mcp.github import analyze_github
from github_mcp.server import mcp
from github_mcp.snapshot import LocalSnapshotClient, analyze_local

AGENTS = Path(__file__).resolve().parents[2] / "agents"
NAMES = ["crypto_news_research", "crypto_market_html"]
EXPECTED = {"crypto_news_research": {"fetch_today_crypto_news", "summarize_crypto_news", "collect_article_evidence", "analyze_crypto_insights"},
            "crypto_market_html": {"fetch_market_snapshot", "build_crypto_market_html"}}


def load_example(name):
    spec = importlib.util.spec_from_file_location("demo_" + name, AGENTS / name / "agent.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


NEWS = load_example(NAMES[0])
HTML = load_example(NAMES[1])


class AgentDemoTests(unittest.TestCase):
    def test_two_simulated_repositories_separate_contents_and_tools(self):
        for name in NAMES:
            with self.subTest(agent=name):
                url = "https://github.com/hireme-demo/" + name.replace("_", "-")
                result = analyze_local(AGENTS / name, url, name)
                manifest = result["manifest"]
                self.assertTrue(manifest["source"]["simulated"])
                self.assertTrue(manifest["source"]["syntheticCommit"])
                self.assertEqual(manifest["serverName"], name + "_mcp")
                self.assertEqual(manifest["source"]["license"], "MIT")
                self.assertTrue(manifest["coverage"]["complete"])
                self.assertEqual({tool["name"] for tool in result["tools"]}, EXPECTED[name])
                self.assertTrue(all(tool["schemaStatus"] == "draft" for tool in result["tools"]))
                self.assertEqual(len(result["contents"]["prompts"]), 3)
                self.assertTrue({"instructions", "skill", "prompt", "reference", "resource_definition"}.issubset(
                    {resource["kind"] for resource in result["contents"]["resources"]}))
                if name == "crypto_market_html":
                    template = next(r for r in result["contents"]["resources"] if r["source"]["path"] == "templates/report.html")
                    self.assertEqual(template["mimeType"], "text/html")
                repeated = analyze_local(AGENTS / name, url)
                self.assertEqual(manifest["source"]["snapshotDigest"], repeated["manifest"]["source"]["snapshotDigest"])

    def test_demo_news_tags_and_fixed_date(self):
        news = NEWS.fetch_today_crypto_news(mode="demo")
        digest = NEWS.summarize_crypto_news(news)
        self.assertEqual(digest["date"], "2026-09-19")
        self.assertTrue(digest["demo"])
        self.assertEqual([n["assets"] for n in digest["highlights"]], [["bitcoin"], ["ethereum"], ["solana"], []])
        with self.assertRaises(ValueError):
            NEWS.fetch_today_crypto_news(date="2026-09-18", mode="demo")

    def test_rss_publication_dates_are_filtered_in_korea_timezone(self):
        feed = b'''<rss><channel>
<item><title>Bitcoin update</title><link>https://example.org/btc</link><description>&lt;b&gt;Short excerpt&lt;/b&gt;</description><pubDate>Fri, 18 Sep 2026 15:05:00 +0000</pubDate></item>
<item><title>Old news</title><link>https://example.org/old</link><pubDate>Fri, 18 Sep 2026 00:00:00 +0000</pubDate></item>
<item><title>No date</title><link>https://example.org/no-date</link></item>
</channel></rss>'''
        with patch.object(NEWS, "urlopen", return_value=io.BytesIO(feed)):
            items, error = NEWS._read_feed({"name": "Demo", "url": "https://example.org/rss"}, "2026-09-19")
        self.assertIsNone(error)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["excerpt"], "Short excerpt")

    def test_live_feed_failure_is_not_replaced_with_demo_news(self):
        with patch.object(NEWS, "_read_feed", return_value=([], "feed unavailable")):
            with self.assertRaisesRegex(ValueError, "All news feeds failed"):
                NEWS.fetch_today_crypto_news(mode="live")

    def test_live_market_response_preserves_missing_values(self):
        rows = [{"id": "bitcoin", "name": "Bitcoin", "symbol": "btc", "current_price": None,
                 "market_cap": 100, "total_volume": 10, "price_change_percentage_24h": None, "last_updated": None}]
        global_data = {"data": {"total_market_cap": {"usd": 100}, "total_volume": {"usd": 10},
                                "market_cap_percentage": {"btc": 50}, "updated_at": 1789740000}}
        with patch.object(HTML, "_get_json", side_effect=[rows, global_data]):
            data = HTML.fetch_market_snapshot(coins=["bitcoin", "solana"], mode="live")
        self.assertFalse(data["demo"])
        self.assertIsNone(data["coins"][0]["price"])
        self.assertIsNone(data["coins"][0]["change24h"])
        self.assertEqual(data["missingCoins"], ["solana"])

    def test_html_escapes_external_text_and_blocks_script_links(self):
        digest = NEWS.summarize_crypto_news(NEWS.fetch_today_crypto_news(mode="demo"))
        digest["highlights"][0]["headline"] = '<script>alert("x")</script>'
        digest["highlights"][0]["url"] = "javascript:alert(1)"
        digest["highlights"][0]["summary"] = '<img src=x onerror="alert(1)">'
        report = HTML.build_crypto_market_html(digest, HTML.fetch_market_snapshot(mode="demo"))
        self.assertIn("&lt;script&gt;", report)
        self.assertNotIn('<script>alert("x")</script>', report)
        self.assertNotIn('href="javascript:', report)
        self.assertNotIn("<img src=x", report)

    def test_html_handles_empty_news_null_prices_and_mixed_modes(self):
        digest = NEWS.summarize_crypto_news(NEWS.fetch_today_crypto_news(mode="demo"))
        digest["highlights"] = []
        market = HTML.fetch_market_snapshot(mode="demo")
        market["demo"] = False
        market["coins"][0]["price"] = None
        market["coins"][0]["change24h"] = None
        report = HTML.build_crypto_market_html(digest, market)
        self.assertIn("해당 날짜의 뉴스가 없습니다", report)
        self.assertIn("미제공", report)
        self.assertIn("MIXED", report)

    def test_insights_link_body_paragraphs_and_separate_interpretations(self):
        news = NEWS.fetch_today_crypto_news(mode="demo")
        enriched = NEWS.collect_article_evidence(news)
        result = NEWS.analyze_crypto_insights(NEWS.summarize_crypto_news(news), enriched)
        self.assertEqual(enriched["articleCoverage"]["read"], 4)
        self.assertEqual(len(result["insights"]), 4)
        self.assertFalse(result["researchMeta"]["llmUsed"])
        for insight in result["insights"]:
            article = next(a for a in enriched["articleEvidence"] if a["articleId"] == insight["articleId"])
            self.assertTrue(insight["interpretation"])
            self.assertTrue(insight["counterpoint"])
            self.assertEqual(len(insight["watchMetrics"]), 3)
            self.assertTrue(all(ref["paragraphId"] in {p["id"] for p in article["paragraphs"]}
                                and ref["url"] == article["sourceUrl"] for ref in insight["evidenceRefs"]))

    def test_unread_article_does_not_produce_a_body_grounded_insight(self):
        news = NEWS.fetch_today_crypto_news(mode="demo")
        enriched = NEWS.collect_article_evidence(news)
        enriched["articleEvidence"][0].update(status="unavailable", paragraphs=[], error="Body blocked")
        result = NEWS.analyze_crypto_insights(NEWS.summarize_crypto_news(news), enriched)
        self.assertEqual(len(result["insights"]), 3)
        self.assertEqual(result["researchMeta"]["articleCoverage"]["read"], 3)
        self.assertEqual(result["researchMeta"]["articleErrors"][0]["error"], "Body blocked")

    def test_article_parser_reads_structured_body_not_navigation(self):
        body = "First source paragraph about ETF product flows and their comparison period. " * 3 + "\nSecond paragraph explaining limitations."
        parser = NEWS.ArticleParser()
        parser.feed('<nav><p>Navigation content must not become article evidence.</p></nav><script type="application/ld+json">' +
                    json.dumps({"@type": "NewsArticle", "articleBody": body, "isAccessibleForFree": True}) + '</script>')
        parts, method = parser.body()
        self.assertEqual(method, "public_json_ld")
        self.assertEqual(parts, [paragraph.strip() for paragraph in body.splitlines()])

    def test_article_source_and_redirect_destinations_are_allowlisted(self):
        for url in ["http://www.coindesk.com/a", "https://127.0.0.1/a", "https://coindesk.com.evil/a", "https://www.coindesk.com:444/a"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                NEWS._validate_article_url(url)
        NEWS._validate_article_url("https://www.coindesk.com/markets/article")

    def test_restricted_structured_body_is_not_used(self):
        parser = NEWS.ArticleParser()
        text = "This restricted article body must not be used for the public article reading workflow. " * 4
        parser.feed('<article><p>' + text + '</p></article><script type="application/ld+json">' +
                    json.dumps({"@type": "NewsArticle", "articleBody": text, "isAccessibleForFree": False}) + '</script>')
        self.assertEqual(parser.body(), ([], "restricted"))

    def test_html_article_parser_excludes_sidebar_and_script_text(self):
        parser = NEWS.ArticleParser()
        main = "The public article paragraph describes the observed market event and its limitations."
        parser.feed('<nav><p>Navigation content is not article evidence, even when very long.</p></nav>'
                    '<article><p>' + main + '</p><aside><p>Sidebar promotions must not become source evidence for this article.</p></aside>'
                    '<script>doNotReadThisScript()</script></article>')
        self.assertEqual(parser.body(), ([main], "article_html"))

    def test_forged_paragraph_reference_is_rejected_by_design_agent(self):
        news = NEWS.fetch_today_crypto_news(mode="demo")
        digest = NEWS.analyze_crypto_insights(NEWS.summarize_crypto_news(news), NEWS.collect_article_evidence(news))
        digest["insights"][0]["evidenceRefs"][0]["paragraphId"] = "missing"
        with self.assertRaisesRegex(ValueError, "unavailable article paragraph"):
            HTML.build_crypto_market_html(digest, HTML.fetch_market_snapshot(mode="demo"))

    def test_embedded_report_json_cannot_close_script_element(self):
        payload = {"headline": '</script><script>alert(1)</script>', "value": "<&>"}
        encoded = HTML._json_for_html(payload)
        self.assertNotIn("<", encoded)
        self.assertEqual(json.loads(encoded), payload)


class AgentMcpTests(unittest.IsolatedAsyncioTestCase):
    async def test_importer_mcp_analyzes_both_simulated_github_repositories(self):
        for name in NAMES:
            url = "https://github.com/hireme-demo/" + name.replace("_", "-")
            snapshot = LocalSnapshotClient(AGENTS / name, url)
            with patch("github_mcp.github.GitHubClient", return_value=snapshot):
                async with create_connected_server_and_client_session(mcp) as client:
                    result = await client.call_tool("analyze_github_agent", {"github_url": url, "agent_name": name})
                    self.assertFalse(result.isError)
                    self.assertEqual(result.structuredContent, analyze_github(url, name, client=snapshot))

    async def test_two_native_mcp_servers_chain_news_to_html(self):
        async with asyncio.timeout(20):
            async with AsyncExitStack() as stack:
                clients = {}
                for name in NAMES:
                    params = StdioServerParameters(command=sys.executable, args=[str(AGENTS / name / "agent.py")])
                    read, write = await stack.enter_async_context(stdio_client(params))
                    client = await stack.enter_async_context(ClientSession(read, write))
                    await client.initialize()
                    listed = await client.list_tools()
                    self.assertEqual({t.name for t in listed.tools}, EXPECTED[name])
                    clients[name] = client
                news_client, html_client = clients[NAMES[0]], clients[NAMES[1]]
                sources = await news_client.read_resource("news://sources")
                self.assertEqual(len(json.loads(sources.contents[0].text)), 2)
                prompt = await news_client.get_prompt("crypto_news_brief", arguments={"date": "2026-09-19"})
                self.assertIn("2026-09-19", prompt.messages[0].content.text)
                market_resource = await html_client.read_resource("market://demo-snapshot")
                self.assertEqual(json.loads(market_resource.contents[0].text)["currency"], "USD")
                html_prompt = await html_client.get_prompt("market_html_brief", arguments={"date": "2026-09-19"})
                self.assertIn("2026-09-19", html_prompt.messages[0].content.text)
                found = await news_client.call_tool("fetch_today_crypto_news", {"mode": "demo"})
                self.assertFalse(found.isError)
                evidence = await news_client.call_tool("collect_article_evidence", {"news": found.structuredContent})
                self.assertFalse(evidence.isError)
                digest = await news_client.call_tool("summarize_crypto_news", {"news": found.structuredContent})
                self.assertFalse(digest.isError)
                digest = await news_client.call_tool("analyze_crypto_insights", {
                    "news_digest": digest.structuredContent, "enriched_news": evidence.structuredContent})
                self.assertFalse(digest.isError)
                market = await html_client.call_tool("fetch_market_snapshot", {"mode": "demo"})
                self.assertFalse(market.isError)
                report = await html_client.call_tool("build_crypto_market_html", {
                    "news_digest": digest.structuredContent, "market_snapshot": market.structuredContent})
                self.assertFalse(report.isError)
                text = report.structuredContent["result"]
                self.assertTrue(text.startswith("<!doctype html>"))
                self.assertEqual(text.count('class="coin-card"'), 3)
                self.assertEqual(text.count('class="news-card"'), 4)
                self.assertIn("$92,000.00", text)
                self.assertIn('href="#news-0"', text)
                self.assertIn("DEMO · 가상 뉴스 / 가상 시세", text)
                self.assertEqual(text.count('class="insight-card"'), 4)
                self.assertIn('id="dominance-slider"', text)
                self.assertIn('id="article-dialog"', text)


if __name__ == "__main__":
    unittest.main()
