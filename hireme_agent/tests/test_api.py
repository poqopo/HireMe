import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from hireme_agent.api import app, create_app


class ApiTests(unittest.TestCase):
    def test_rejects_workflow_when_openai_key_is_absent(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=False):
            response = TestClient(app).post("/runs", json={
                "task": "테스트 요청",
                "agents": [{"id": "research", "name": "Paper Research", "role": "Researcher", "price": 0}],
            })
        self.assertEqual(response.status_code, 503)
        self.assertIn("OPENAI_API_KEY", response.json()["detail"])

    def test_registers_existing_server_url_after_github_analysis(self):
        analysis = {"manifest": {"agentId": "market_agent"}, "contents": {"prompts": []}, "tools": []}
        with patch("hireme_agent.api.inspect_github_agent", new=AsyncMock(return_value=analysis)) as inspect:
            with tempfile.TemporaryDirectory() as directory:
                with TestClient(create_app(registry_path=os.path.join(directory, "agents.json"))) as client:
                    response = client.post("/agents/register", json={
                        "name": "Market Agent",
                        "github_url": "https://github.com/example/market-agent",
                        "existing_server": True,
                        "server_url": "https://agent.example.com/mcp",
                        "price_per_100m": 0.025,
                    })
                    agent_id = response.json()["agent"]["id"]
                    listed = client.get("/agents")
                    deleted = client.delete(f"/agents/registry/{agent_id}")
                    listed_after_delete = client.get("/agents")
        self.assertEqual(response.status_code, 200)
        payload = response.json()["agent"]
        self.assertEqual(payload["serverUrl"], "https://agent.example.com/mcp")
        self.assertTrue(payload["existingServer"])
        self.assertEqual(payload["pricePer100M"], 0.025)
        inspect.assert_awaited_once_with(
            "https://github.com/example/market-agent", "Market Agent", "https://agent.example.com/mcp"
        )
        self.assertIn(agent_id, [agent["name"] for agent in listed.json()["agents"]])
        registry_agent = next(agent for agent in listed.json()["agents"] if agent["name"] == agent_id)
        self.assertEqual(registry_agent["pricePer100M"], 0.025)
        self.assertEqual(deleted.status_code, 200)
        self.assertNotIn(agent_id, [agent["name"] for agent in listed_after_delete.json()["agents"]])


if __name__ == "__main__":
    unittest.main()
