import asyncio
import json
import shutil
import socket
import tempfile
import unittest
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import httpx
import uvicorn
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.shared.exceptions import McpError

from hireme_agent.api import create_app
from hireme_agent.hosting import Deployment, HostedAgent, HostSettings
from hireme_agent.registry import REGISTERED_HTTP_MCP_CONNECTIONS

TOKEN = "local-integration-test-token"
NEWS = "crypto_news_research_mcp"
HTML = "crypto_market_html_mcp"


class HostingHTTPTests(unittest.IsolatedAsyncioTestCase):
    async def test_playground_honors_explicit_demo_over_real_http_mcp(self):
        connections = {
            NEWS: {"url": self.base + f"/agents/{NEWS}/mcp", "token_env": "HOSTING_TEST_TOKEN"},
            HTML: {"url": self.base + f"/agents/{HTML}/mcp", "token_env": "HOSTING_TEST_TOKEN", "context_key": "news_digest"},
        }
        import os
        with patch.dict(REGISTERED_HTTP_MCP_CONNECTIONS, connections, clear=True), patch.dict(os.environ, {"HOSTING_TEST_TOKEN": TOKEN}):
            async with httpx.AsyncClient(base_url=self.base, headers={"Authorization": "Bearer " + TOKEN}, timeout=60) as http:
                response = await http.post("/runs", json={"task": "시장 리서치", "config": {"mode": "demo"}, "agents": [
                    {"id": NEWS, "name": "Crypto News", "role": "Research", "price": 0},
                    {"id": HTML, "name": "Crypto HTML", "role": "Design", "price": 0}]})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["dataMode"], "demo")
        self.assertTrue(result["steps"][0]["output"]["data"]["demo"])
        self.assertIn("DEMO", result["result"]["html"])

    async def asyncSetUp(self):
        self.app = create_app(HostSettings(token=TOKEN))
        self.socket = socket.socket()
        self.socket.bind(("127.0.0.1", 0))
        self.base = f"http://127.0.0.1:{self.socket.getsockname()[1]}"
        self.server = uvicorn.Server(uvicorn.Config(self.app, log_level="error", access_log=False, lifespan="on"))
        self.server_task = asyncio.create_task(self.server.serve(sockets=[self.socket]))
        async with asyncio.timeout(10):
            while not self.server.started:
                if self.server_task.done():
                    await self.server_task
                await asyncio.sleep(.02)

    async def asyncTearDown(self):
        self.server.should_exit = True
        async with asyncio.timeout(10):
            await self.server_task
        self.socket.close()

    @asynccontextmanager
    async def client(self, name):
        async with httpx.AsyncClient(headers={"Authorization": "Bearer " + TOKEN}, timeout=60) as http:
            async with streamable_http_client(self.base + f"/agents/{name}/mcp", http_client=http) as (read, write, _):
                async with ClientSession(read, write) as client:
                    initialized = await client.initialize()
                    self.assertEqual(initialized.serverInfo.name, name)
                    yield client

    async def test_each_url_exposes_only_its_own_tools_and_content(self):
        async with self.client(NEWS) as client:
            tools = {t.name for t in (await client.list_tools()).tools}
            self.assertEqual(tools, {"run_agent", "fetch_today_crypto_news", "collect_article_evidence",
                                     "summarize_crypto_news", "analyze_crypto_insights"})
            resources = (await client.list_resources()).resources
            instructions = next(r for r in resources if r.name.startswith("agents_md"))
            contents = await client.read_resource(instructions.uri)
            self.assertIn("리서치", contents.contents[0].text)
            sources = await client.read_resource("news://sources")
            self.assertEqual(len(json.loads(sources.contents[0].text)), 2)
            prompts = (await client.list_prompts()).prompts
            static = next(p for p in prompts if p.name.startswith("prompts_"))
            rendered = await client.get_prompt(static.name, arguments={"date": "2026-09-19"})
            self.assertIn("2026-09-19", rendered.messages[0].content.text)
            with self.assertRaises(McpError):
                await client.read_resource("market://demo-snapshot")
        async with self.client(HTML) as client:
            self.assertEqual({t.name for t in (await client.list_tools()).tools},
                             {"run_agent", "fetch_market_snapshot", "build_crypto_market_html"})
            prompt = await client.get_prompt("market_html_brief", arguments={"date": "2026-09-19"})
            self.assertIn("2026-09-19", prompt.messages[0].content.text)

    async def test_http_run_agent_chains_research_into_executed_html(self):
        async with self.client(NEWS) as client:
            call = await client.call_tool("run_agent", {"task": "코인 기사 본문을 리서치해줘", "config": {"mode": "demo"}})
            self.assertFalse(call.isError)
            research = call.structuredContent
            self.assertEqual(research["status"], "succeeded")
            self.assertEqual(len(research["result"]["insights"]), 4)
            self.assertEqual(len(research["trace"]), 4)
        async with self.client(HTML) as client:
            call = await client.call_tool("run_agent", {"task": "인터랙티브 시장 보고서를 만들어줘",
                "context": {"news_digest": research["result"]}, "config": {"mode": "demo"}})
            self.assertFalse(call.isError)
            result = call.structuredContent
            self.assertEqual(result["agentName"], HTML)
            self.assertEqual(len(result["trace"]), 2)
            self.assertNotEqual(result["runId"], research["runId"])
            self.assertTrue(result["artifacts"][0]["text"].startswith("<!doctype html>"))
            self.assertIn('id="dominance-slider"', result["artifacts"][0]["text"])
            self.assertEqual(result["artifacts"][0]["text"].count('class="insight-card"'), 4)

    async def test_native_calls_are_executed_and_cross_agent_tools_are_rejected(self):
        async with self.client(NEWS) as client:
            result = await client.call_tool("fetch_today_crypto_news", {"mode": "demo"})
            self.assertFalse(result.isError)
            self.assertEqual(len(result.structuredContent["items"]), 4)
            wrong_agent = await client.call_tool("fetch_market_snapshot", {"mode": "demo"})
            self.assertTrue(wrong_agent.isError)
            wrong_schema = await client.call_tool("fetch_today_crypto_news", {"mode": "demo", "limit": "invalid"})
            self.assertTrue(wrong_schema.isError)

    async def test_auth_unknown_agent_and_host_header_checks(self):
        async with httpx.AsyncClient(base_url=self.base) as client:
            self.assertEqual((await client.get("/health")).status_code, 200)
            self.assertEqual((await client.get("/agents")).status_code, 401)
            self.assertEqual((await client.post(f"/agents/{NEWS}/mcp", json={})).status_code, 401)
            self.assertEqual((await client.post("/runs", json={})).status_code, 401)
            self.assertEqual((await client.post("/agents/inspect", json={})).status_code, 401)
            headers = {"Authorization": "Bearer " + TOKEN, "Accept": "application/json, text/event-stream"}
            self.assertEqual((await client.post("/agents/missing_mcp/mcp", headers=headers, json={})).status_code, 404)
            listed = await client.get("/agents", headers=headers)
            self.assertEqual({a["name"] for a in listed.json()["agents"]}, {NEWS, HTML})
            payload = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
                "protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}}}
            rejected = await client.post(f"/agents/{NEWS}/mcp", json=payload, headers={**headers, "Host": "unregistered.example"})
            self.assertEqual(rejected.status_code, 421)

    async def test_concurrent_agents_do_not_mix_results(self):
        async def invoke(name, tool):
            async with self.client(name) as client:
                call = await client.call_tool(tool, {"mode": "demo"})
                self.assertFalse(call.isError)
                return call.structuredContent
        news, market = await asyncio.gather(invoke(NEWS, "fetch_today_crypto_news"), invoke(HTML, "fetch_market_snapshot"))
        self.assertIn("items", news)
        self.assertNotIn("coins", news)
        self.assertIn("coins", market)
        self.assertNotIn("items", market)

    async def test_timeout_is_a_tool_error_and_server_remains_healthy(self):
        async with self.client(NEWS) as client:
            await client.list_tools()
            agent = self.app.state.mcp_host.agents[NEWS]
            original = agent.settings
            agent.settings = replace(original, timeout=.001)
            try:
                result = await client.call_tool("run_agent", {"task": "test", "config": {"mode": "demo"}})
                self.assertTrue(result.isError)
                self.assertIn("deadline", result.content[0].text)
            finally:
                agent.settings = original
            self.assertFalse((await client.call_tool("fetch_today_crypto_news", {"mode": "demo"})).isError)

    async def test_invalid_workflow_inputs_return_actionable_tool_errors(self):
        async with self.client(HTML) as client:
            result = await client.call_tool("run_agent", {"task": "test", "config": {"mode": "demo"}})
            self.assertTrue(result.isError)
            self.assertIn("context.news_digest", result.content[0].text)
            result = await client.call_tool("run_agent", {"task": "test", "config": {"mode": "invalid"}})
            self.assertTrue(result.isError)
            self.assertIn("config.mode", result.content[0].text)


class HostingRegistrationTests(unittest.TestCase):
    def test_snapshot_changes_require_reregistration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = HostSettings().agents_root / "crypto_news_research"
            shutil.copytree(source, root / "crypto_news_research", ignore=shutil.ignore_patterns("__pycache__"))
            agent = HostedAgent(Deployment("crypto_news_research", "crypto_news"), HostSettings(agents_root=root), asyncio.Semaphore(1))
            agent.assert_snapshot()
            (root / "crypto_news_research/AGENTS.md").write_text("Changed snapshot", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "source changed"):
                agent.assert_snapshot()

    def test_runtime_path_cannot_escape_reviewed_source_root(self):
        with self.assertRaises(ValueError):
            HostedAgent(Deployment("../unreviewed", "crypto_news"), HostSettings(), asyncio.Semaphore(1))


if __name__ == "__main__":
    unittest.main()
