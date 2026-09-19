import json
import unittest

from github_mcp import analyze_files
from github_mcp.github import GitHubClient, GitHubError, analyze_github, parse_github_url

SOURCE = {"repository": "https://github.com/demo/research-agent", "owner": "demo",
          "repo": "research-agent", "commit": "a" * 40, "path": "", "license": "MIT"}


class AnalyzerTests(unittest.TestCase):
    def test_separates_instructions_prompts_and_tools_without_running_code(self):
        result = analyze_files({
            "AGENTS.md": "You are a research agent.",
            "skills/report/SKILL.md": "Write an evidence based report.",
            "prompts/report.txt": "Summarize {{question}}.",
            "agent.py": '''
from langchain_core.tools import tool
raise RuntimeError("must never be executed")
SYSTEM_PROMPT = "Collect trustworthy evidence."
@tool
def search(query: str, count: int = 5, *, language: str = "en") -> list[str]:
    """Search papers."""
    pass
''',
        }, SOURCE, "Paper Research")
        self.assertEqual(result["manifest"]["serverName"], "paper_research_mcp")
        self.assertEqual(result["manifest"]["runtime"]["frameworks"], ["langchain"])
        kinds = {r["kind"] for r in result["contents"]["resources"]}
        self.assertTrue({"instructions", "skill", "prompt"}.issubset(kinds))
        tool = result["tools"][0]
        self.assertEqual(tool["name"], "search")
        self.assertEqual(tool["inputSchema"]["required"], ["query"])
        self.assertEqual(tool["inputSchema"]["properties"]["count"], {"type": "integer", "default": 5})
        self.assertEqual(tool["binding"]["module"], "agent")
        self.assertEqual(tool["status"], "needs_adapter")
        self.assertIn("#L", tool["source"]["url"])

    def test_async_fastmcp_context_union_and_model_types(self):
        result = analyze_files({"tools.py": '''
from pydantic import BaseModel
from mcp.server.fastmcp import Context
class Query(BaseModel):
    phrase: str
    limit: int
@mcp.tool(name="find_papers")
async def search(query: Query, ctx: Context, tags: list[str] | None = None):
    """Search."""
    pass
'''}, SOURCE)
        tool = result["tools"][0]
        self.assertEqual(tool["name"], "find_papers")
        self.assertNotIn("ctx", tool["inputSchema"]["properties"])
        self.assertEqual(tool["inputSchema"]["properties"]["query"]["required"], ["phrase", "limit"])
        self.assertEqual(tool["inputSchema"]["properties"]["tags"]["anyOf"][1], {"type": "null"})
        self.assertTrue(tool["binding"]["async"])

    def test_connections_are_not_tools_and_secret_values_are_not_exported(self):
        result = analyze_files({".mcp.json": json.dumps({"mcpServers": {
            "search": {"command": "uvx", "args": ["search-mcp"], "env": {"API_KEY": "private-value"}}
        }}), ".env.example": "TOKEN=also-private\n", ".env": "DO_NOT_READ=private"}, SOURCE)
        self.assertEqual(result["tools"], [])
        self.assertEqual(result["manifest"]["requiredEnvironment"], ["API_KEY", "TOKEN"])
        self.assertNotIn("private", json.dumps(result))
        self.assertEqual(result["manifest"]["mcpConnections"][0]["status"], "needs_tool_discovery")

    def test_json_mcp_and_openai_tools(self):
        schema = {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}
        result = analyze_files({"tools.json": json.dumps({"tools": [
            {"name": "mcp_search", "inputSchema": schema},
            {"type": "function", "function": {"name": "openai_search", "parameters": schema}},
        ]})}, SOURCE)
        self.assertEqual([t["name"] for t in result["tools"]], ["mcp_search", "openai_search"])
        self.assertEqual(result["tools"][0]["inputSchema"], schema)

    def test_unknown_types_and_duplicate_tools_remain_reviewable(self):
        files = {f"{n}.py": '@tool\ndef search(query: UnknownType):\n    pass\n' for n in ["a", "b"]}
        result = analyze_files(files, SOURCE)
        self.assertEqual(len({t["name"] for t in result["tools"]}), 2)
        self.assertTrue(all(t["schemaStatus"] == "needs_review" for t in result["tools"]))

    def test_bad_files_and_partial_analysis_do_not_claim_completion(self):
        result = analyze_files({"bad.py": "def :", "tools.json": "{"}, SOURCE,
                               coverage={"scannedFiles": 2, "skippedFiles": [{"path": "agent.py"}],
                                         "treeTruncated": True, "complete": False})
        reasons = {r["reason"] for r in result["manifest"]["review"]}
        self.assertTrue({"python_parse_error", "invalid_json", "partial_repository_analysis"}.issubset(reasons))

    def test_dynamic_prompts_and_resources_stay_in_contents(self):
        result = analyze_files({"agent.py": '''
@mcp.prompt()
def greet(name: str):
    return f"Hello {name}"
@mcp.resource("docs://{name}")
def document(name: str):
    return open(name).read()
'''}, SOURCE)
        self.assertEqual(result["tools"], [])
        self.assertEqual(result["contents"]["prompts"][0]["arguments"], [{"name": "name", "required": True}])
        self.assertEqual(len(result["contents"]["resources"]), 2)
        self.assertEqual(result["contents"]["resources"][1]["originalUri"], "docs://{name}")

    def test_folder_scope_creates_relative_module_binding(self):
        result = analyze_files({"agents/research/tools.py": "@tool\ndef search(query: str):\n    pass\n"},
                               {**SOURCE, "path": "agents/research"})
        self.assertEqual(result["tools"][0]["binding"]["module"], "tools")

    def test_invalid_json_schema_is_not_emitted_as_a_tool(self):
        result = analyze_files({"tools.json": json.dumps({"tools": [
            {"name": "broken", "inputSchema": {"type": "object", "required": "not-an-array"}}
        ]})}, SOURCE)
        self.assertEqual(result["tools"], [])
        self.assertIn("invalid_tool_schema", {r["reason"] for r in result["manifest"]["review"]})

    def test_class_and_nested_functions_require_runtime_binding_review(self):
        result = analyze_files({"agent.py": '''
class Toolkit:
    @tool
    def search(self, query: str):
        pass
def factory():
    @tool
    def fetch(url: str):
        pass
'''}, SOURCE)
        self.assertEqual({t["binding"]["callable"] for t in result["tools"]}, {"Toolkit.search", "factory.fetch"})
        self.assertTrue(all(t["schemaStatus"] == "needs_review" for t in result["tools"]))


class GitHubTests(unittest.TestCase):
    def test_supported_urls(self):
        self.assertEqual(parse_github_url("https://github.com/demo/agent.git")["repo"], "agent")
        self.assertEqual(parse_github_url("https://github.com/demo/agent/tree/main/agents/demo")["tail"],
                         ["main", "agents", "demo"])
        for url in ["http://github.com/demo/agent", "https://github.com.evil/demo/agent",
                    "https://github.com/demo/agent/issues/1", "https://github.com/demo/agent/tree",
                    "https://github.com/demo/../agent", "https://github.com/demo%2Fbad/agent"]:
            with self.subTest(url=url), self.assertRaises(GitHubError):
                parse_github_url(url)

    def test_slash_branch_resolution(self):
        class FakeClient(GitHubClient):
            def get(self, path):
                if "/commits/" not in path:
                    return {"html_url": SOURCE["repository"], "default_branch": "main"}
                if path.endswith("feature%2Fresearch"):
                    return {"sha": "a" * 40, "commit": {"tree": {"sha": "tree"}}}
                error = GitHubError("not found")
                error.status = 404
                raise error
        source = FakeClient().resolve(parse_github_url("https://github.com/demo/agent/tree/feature/research/agents/demo"))
        self.assertEqual(source["ref"], "feature/research")
        self.assertEqual(source["path"], "agents/demo")

    def test_file_limit_and_pinned_snapshot(self):
        class FakeClient(GitHubClient):
            def resolve(self, parsed, ref=None):
                return {**SOURCE, "apiRoot": "/repos/demo/agent", "tree": "pinned-tree", "kind": "repository"}

            def get(self, path):
                if "/git/trees/" in path:
                    self.tree_path = path
                    return {"tree": [
                        {"type": "blob", "mode": "100644", "path": p, "sha": p, "size": 20}
                        for p in ["AGENTS.md", "README.md"]], "truncated": False}
                return {"encoding": "base64", "content": "aGVsbG8="}
        client = FakeClient()
        result = analyze_github("https://github.com/demo/agent", max_files=1, client=client)
        self.assertIn("pinned-tree", client.tree_path)
        self.assertEqual(result["manifest"]["coverage"]["scannedFiles"], 1)
        self.assertFalse(result["manifest"]["coverage"]["complete"])
        self.assertEqual(result["contents"]["resources"][0]["text"], "hello")


if __name__ == "__main__":
    unittest.main()
