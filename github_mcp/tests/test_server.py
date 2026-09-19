import asyncio
import sys
import unittest
from unittest.mock import patch

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.shared.memory import create_connected_server_and_client_session

from github_mcp import analyze_files
from github_mcp.server import mcp


class ServerTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_returns_machine_readable_bundle(self):
        bundle = analyze_files({"AGENTS.md": "Research carefully.",
                                "agent.py": "@tool\ndef search(query: str):\n    pass\n"},
                               {"repo": "research", "owner": "demo", "commit": "a" * 40,
                                "repository": "https://github.com/demo/research"})
        with patch("github_mcp.server.analyze_github", return_value=bundle):
            async with create_connected_server_and_client_session(mcp) as client:
                result = await client.call_tool("analyze_github_agent", {"github_url": "https://github.com/demo/research"})
                self.assertFalse(result.isError)
                self.assertEqual(result.structuredContent, bundle)

    async def test_stdio_handshake_and_tool_schema(self):
        params = StdioServerParameters(command=sys.executable, args=["-m", "github_mcp.server"])
        async with asyncio.timeout(15):
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as client:
                    await client.initialize()
                    result = await client.list_tools()
                    self.assertEqual([t.name for t in result.tools], ["analyze_github_agent"])
                    self.assertEqual(result.tools[0].inputSchema["required"], ["github_url"])
                    self.assertEqual(result.tools[0].outputSchema["type"], "object")
                    error = await client.call_tool("analyze_github_agent", {"github_url": "https://example.com/agent"})
                    self.assertTrue(error.isError)

    def test_analysis_can_record_a_declared_server_url(self):
        bundle = analyze_files(
            {"agent.py": "@tool\ndef search(query: str):\n    pass\n"},
            {"repo": "research", "owner": "demo", "commit": "a" * 40,
             "repository": "https://github.com/demo/research"},
            server_url="https://agent.example.com/run",
        )
        self.assertEqual(bundle["manifest"]["declaredServerUrl"], "https://agent.example.com/run")


if __name__ == "__main__":
    unittest.main()
