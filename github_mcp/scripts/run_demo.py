"""Analyze two crypto agents and run their native MCP tools to compose an HTML report."""

import argparse
import asyncio
import json
import sys
from contextlib import AsyncExitStack
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from github_mcp.snapshot import analyze_local

AGENTS = Path(__file__).resolve().parents[2] / "agents"
NAMES = ["crypto_news_research", "crypto_market_html"]


async def _call(client: ClientSession, name: str, args: dict):
    result = await client.call_tool(name, args)
    if result.isError:
        raise RuntimeError(f"{name} failed: " + "; ".join(getattr(c, "text", "") for c in result.content))
    if result.structuredContent is None:
        raise RuntimeError(f"{name} did not return structured output")
    value = result.structuredContent
    return value["result"] if set(value) == {"result"} else value


async def run(output: Path, mode: str = "demo", date: str | None = None):
    filenames = ["news_digest.json", "article_evidence.json", "market_snapshot.json", "report.html", "demo_receipt.json"]
    filenames += [f"{name}/{filename}.json" for name in NAMES for filename in ["manifest", "contents", "tools"]]
    if any((output / name).exists() for name in filenames):
        raise ValueError("결과가 이미 존재합니다. 새 출력 폴더를 지정하세요.")
    bundles = {name: analyze_local(AGENTS / name, "https://github.com/hireme-demo/" + name.replace("_", "-"), name)
               for name in NAMES}
    async with asyncio.timeout(55):
        async with AsyncExitStack() as stack:
            clients = {}
            for name in NAMES:
                params = StdioServerParameters(command=sys.executable, args=[str(AGENTS / name / "agent.py")])
                read, write = await stack.enter_async_context(stdio_client(params))
                client = await stack.enter_async_context(ClientSession(read, write))
                await client.initialize()
                listed = await client.list_tools()
                if {t.name for t in listed.tools} != {t["name"] for t in bundles[name]["tools"]}:
                    raise RuntimeError(f"Extracted tools differ from native MCP tools: {name}")
                clients[name] = client
            news = await _call(clients[NAMES[0]], "fetch_today_crypto_news", {"mode": mode, "date": date})
            enriched = await _call(clients[NAMES[0]], "collect_article_evidence", {"news": news})
            digest = await _call(clients[NAMES[0]], "summarize_crypto_news", {"news": news})
            digest = await _call(clients[NAMES[0]], "analyze_crypto_insights", {"news_digest": digest, "enriched_news": enriched})
            market = await _call(clients[NAMES[1]], "fetch_market_snapshot", {"mode": mode})
            report_text = await _call(clients[NAMES[1]], "build_crypto_market_html", {"news_digest": digest, "market_snapshot": market})
            if not report_text.startswith("<!doctype html>"):
                raise RuntimeError("Expected a standalone HTML report")
    receipt = {"status": "passed", "githubSimulated": True, "dataMode": mode,
               "execution": "two example agents' native MCP servers", "date": digest["date"],
               "agents": {name: {"serverName": bundles[name]["manifest"]["serverName"],
                                 "analysis": bundles[name]["manifest"]["summary"]} for name in NAMES},
               "workflow": [{"tool": "fetch_today_crypto_news", "items": len(news["items"])},
                            {"tool": "collect_article_evidence", "read": enriched["articleCoverage"]["read"]},
                            {"tool": "summarize_crypto_news", "highlights": len(digest["highlights"])},
                            {"tool": "analyze_crypto_insights", "insights": len(digest["insights"])},
                            {"tool": "fetch_market_snapshot", "coins": len(market["coins"])},
                            {"tool": "build_crypto_market_html", "report": "report.html"}]}
    output.mkdir(parents=True, exist_ok=True)
    for name, bundle in bundles.items():
        directory = output / name
        directory.mkdir(exist_ok=True)
        for key in ["manifest", "contents", "tools"]:
            (directory / f"{key}.json").write_text(json.dumps(bundle[key], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for key, value in [("news_digest", digest), ("article_evidence", enriched), ("market_snapshot", market)]:
        (output / f"{key}.json").write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "report.html").write_text(report_text + "\n", encoding="utf-8")
    (output / "demo_receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=["demo", "live"], default="demo")
    parser.add_argument("--date", help="News date (YYYY-MM-DD, Asia/Seoul); market data remains current in live mode")
    args = parser.parse_args()
    asyncio.run(run(args.output, args.mode, args.date))
