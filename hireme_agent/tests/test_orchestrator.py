import unittest
from unittest.mock import AsyncMock, patch
from hireme_agent.orchestrator import AgentSelection, WorkflowRequest, assert_live_result, execute_workflow, stream_workflow


async def fake_generator(**kwargs):
    return f"{kwargs['agent_name']} 모델 출력"


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_default_execution_passes_live_config_to_mcp(self):
        call = AsyncMock(return_value={"mode": "live", "demo": False, "highlights": []})
        with patch("hireme_agent.orchestrator._invoke_mcp", new=call):
            result = await execute_workflow(WorkflowRequest(task="오늘 뉴스", agents=[
                AgentSelection(id="crypto_news_research_mcp", name="Crypto News", role="Research", price=0)]), generator=fake_generator)
        self.assertEqual(call.await_args.args[4], {"mode": "live"})
        self.assertEqual(result["dataMode"], "live")
        self.assertEqual(result["steps"][0]["input"]["config"], {"mode": "live"})

    async def test_demo_requires_explicit_config(self):
        call = AsyncMock(return_value={"mode": "demo", "demo": True})
        with patch("hireme_agent.orchestrator._invoke_mcp", new=call):
            result = await execute_workflow(WorkflowRequest(task="테스트", config={"mode": "demo"}, agents=[
                AgentSelection(id="crypto_news_research_mcp", name="Crypto News", role="Research", price=0)]), generator=fake_generator)
        self.assertEqual(call.await_args.args[4], {"mode": "demo"})
        self.assertEqual(result["dataMode"], "demo")

    async def test_live_workflow_rejects_mock_instead_of_reporting_success(self):
        with patch("hireme_agent.orchestrator._invoke_mcp", new=AsyncMock(return_value={"mode": "demo", "demo": True})):
            with self.assertRaisesRegex(RuntimeError, "데모 데이터"):
                await execute_workflow(WorkflowRequest(task="오늘 뉴스", agents=[
                    AgentSelection(id="crypto_news_research_mcp", name="Crypto News", role="Research", price=0)]), generator=fake_generator)

    def test_live_guard_checks_nested_market_data_but_not_source_provenance(self):
        with self.assertRaisesRegex(RuntimeError, "데모 데이터"):
            assert_live_result({"marketSnapshot": {"demo": True}})
        assert_live_result({"mode": "live", "demo": False, "source": {"simulated": True}})

    def test_invalid_execution_mode_is_rejected(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            WorkflowRequest(task="test", config={"mode": "fallback"}, agents=[
                AgentSelection(id="crypto_news_research_mcp", name="Crypto News", role="Research", price=0)])

    async def test_mcp_json_and_html_result_does_not_require_model_summary(self):
        async def unexpected_generator(**_):
            raise AssertionError("MCP output should bypass the model summary")

        mcp_result = {"reportFormat": "html", "html": "<h1>시장 리포트</h1>", "market": {"btc": 100}}
        with patch("hireme_agent.orchestrator._invoke_mcp", new=AsyncMock(return_value=mcp_result)):
            result = await execute_workflow(WorkflowRequest(
                task="오늘 시장을 시각화해줘",
                agents=[AgentSelection(id="crypto_market_html_mcp", name="Crypto Market HTML", role="Market Report Agent", price=0)],
            ), generator=unexpected_generator)

        output = result["steps"][0]["output"]
        self.assertEqual(output["html"], "<h1>시장 리포트</h1>")
        self.assertEqual(output["data"], mcp_result)
        self.assertIn("시장 리포트", result["result"]["html"])

    async def test_unregistered_browser_server_url_is_ignored(self):
        result = await execute_workflow(WorkflowRequest(
            task="서버 호출 테스트",
            agents=[AgentSelection.model_validate({
                "id": "external", "name": "External Agent", "role": "Runner", "price": 0,
                "server_url": "https://untrusted.example/mcp",
            })],
        ), generator=fake_generator)
        self.assertNotIn("toolResult", result["steps"][0]["output"])

    async def test_passes_each_step_output_to_the_next_agent(self):
        result = await execute_workflow(WorkflowRequest(
            task="멀티 에이전트 협업의 장점을 정리해줘",
            agents=[
                AgentSelection(id="research", name="Paper Research", role="Researcher", price=0.02),
                AgentSelection(id="evidence", name="Evidence Structurer", role="Analyst", price=0),
                AgentSelection(id="writer", name="Report Writer", role="Writer", price=0.01),
            ],
        ), generator=fake_generator)
        self.assertEqual(result["status"], "succeeded")
        self.assertEqual(result["cost"], 0.03)
        self.assertEqual(len(result["steps"]), 3)
        self.assertEqual(result["steps"][1]["input"]["previous"], result["steps"][0]["output"])
        self.assertEqual(result["steps"][2]["input"]["previous"], result["steps"][1]["output"])
        self.assertEqual(result["steps"][0]["selectedTool"], "search_papers")
        self.assertEqual(result["steps"][0]["output"]["summary"], "Paper Research 모델 출력")
        self.assertEqual(len(result["settlement"]["usages"]), 3)
        self.assertTrue(all(item["outputTokens"] > 0 for item in result["settlement"]["usages"]))
        self.assertTrue(all(item["metering"] == "estimated" for item in result["settlement"]["usages"]))

    async def test_uses_tools_discovered_by_github_mcp_analysis(self):
        result = await execute_workflow(WorkflowRequest(
            task="문서를 검토해줘",
            agents=[AgentSelection(
                id="custom", name="Imported Agent", role="Reviewer", price=0,
                analysis={
                    "tools": [{"name": "review_document", "description": "Review a document."}],
                    "contents": {"prompts": [{"name": "review_prompt", "template": "Review carefully."}]},
                },
            )],
        ), generator=fake_generator)
        self.assertEqual(result["steps"][0]["selectedTool"], "review_document")
        self.assertEqual(result["steps"][0]["selectedPrompt"], "review_prompt")

    async def test_stream_reports_each_step_before_the_final_result(self):
        request = WorkflowRequest(task="테스트", agents=[
            AgentSelection(id="research", name="Research", role="Researcher", price=0),
            AgentSelection(id="writer", name="Writer", role="Writer", price=0),
        ])
        events = [event async for event in stream_workflow(request, fake_generator)]
        self.assertEqual([event["type"] for event in events], [
            "step.started", "step.completed", "step.started", "step.completed", "workflow.completed",
        ])
        self.assertEqual(events[3]["step"]["input"]["previous"], events[1]["step"]["output"])

    def test_browser_cannot_supply_an_mcp_endpoint_or_hosting_flag(self):
        agent = AgentSelection.model_validate({
            "id": "research", "name": "Research", "role": "Researcher", "price": 0,
            "server_url": "https://untrusted.example/mcp", "hosted_by_hireme": True,
        })
        self.assertNotIn("server_url", agent.model_dump())
        self.assertNotIn("hosted_by_hireme", agent.model_dump())


if __name__ == "__main__":
    unittest.main()
