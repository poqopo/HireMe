"""The importer MCP server; extracted agents are analyzed, not executed."""

from typing import Any

from mcp.server.fastmcp import FastMCP

from .github import analyze_github

mcp = FastMCP("github_mcp", instructions=(
    "Analyze GitHub agent repositories and separate MCP resources/prompts from tool definitions. "
    "Results are static drafts with provenance. Inspect review and coverage before generating adapters."
))


@mcp.tool(structured_output=True)
def analyze_github_agent(github_url: str, agent_name: str | None = None,
                         ref: str | None = None, max_files: int = 60,
                         server_url: str | None = None) -> dict[str, Any]:
    """Read a GitHub repository/folder/file and return manifest, contents, and tools.

    Does not run source code or connect to the declared server URL. The URL is
    stored as reviewed registration metadata for the HireMe runtime.
    agent_name determines the future HireMe server name: agent_name_mcp.
    ref pins a branch/tag/commit; the resolved commit SHA is recorded in the manifest.
    max_files limits analysis (1..200). Check manifest.coverage for skipped files.
    """
    return analyze_github(github_url, agent_name, ref, max_files, server_url=server_url)


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
