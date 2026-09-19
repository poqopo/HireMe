"""Call two hosted agents over real HTTP MCP and save the returned HTML artifact."""

import argparse
import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


@asynccontextmanager
async def agent_client(base_url: str, name: str):
    headers = {}
    token = os.getenv("HIREME_MCP_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    async with httpx.AsyncClient(headers=headers, timeout=70) as http:
        async with streamable_http_client(base_url.rstrip("/") + f"/agents/{name}/mcp", http_client=http) as (read, write, _):
            async with ClientSession(read, write) as client:
                initialized = await client.initialize()
                if initialized.serverInfo.name != name:
                    raise RuntimeError("Connected to an unexpected agent")
                yield client


async def run(base_url: str, output: Path, mode: str):
    filenames = ["news_run.json", "html_run.json", "report.html", "receipt.json"]
    if any((output / filename).exists() for filename in filenames):
        raise ValueError("기존 결과를 덮어쓰지 않습니다. 새 출력 폴더를 지정하세요.")
    async with agent_client(base_url, "crypto_news_research_mcp") as client:
        call = await client.call_tool("run_agent", {"task": "코인 기사 본문과 인사이트를 정리해줘", "config": {"mode": mode}})
        if call.isError or call.structuredContent is None:
            raise RuntimeError("News agent execution failed: " + "; ".join(getattr(c, "text", "") for c in call.content))
        research = call.structuredContent
    async with agent_client(base_url, "crypto_market_html_mcp") as client:
        call = await client.call_tool("run_agent", {"task": "리서치와 시세를 인터랙티브 HTML로 만들어줘",
            "context": {"news_digest": research["result"]}, "config": {"mode": mode}})
        if call.isError or call.structuredContent is None:
            raise RuntimeError("HTML agent execution failed: " + "; ".join(getattr(c, "text", "") for c in call.content))
        rendered = call.structuredContent
    artifact = next(a for a in rendered["artifacts"] if a["mimeType"] == "text/html")
    receipt = {"status": "passed", "transport": "HTTP MCP", "baseUrl": base_url, "dataMode": mode,
               "news": {"runId": research["runId"], "agentName": research["agentName"],
                        "insights": len(research["result"]["insights"]), "trace": research["trace"]},
               "html": {"runId": rendered["runId"], "agentName": rendered["agentName"], "trace": rendered["trace"]},
               "artifact": "report.html"}
    output.mkdir(parents=True, exist_ok=True)
    for filename, value in [("news_run.json", research), ("html_run.json", rendered), ("receipt.json", receipt)]:
        (output / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "report.html").write_text(artifact["text"], encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=["demo", "live"], default="demo")
    args = parser.parse_args()
    asyncio.run(run(args.base_url, args.output, args.mode))
