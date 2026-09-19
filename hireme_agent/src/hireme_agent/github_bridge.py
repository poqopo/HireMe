"""MCP client bridge for the bounded github_mcp analyzer."""

from __future__ import annotations

import os
import sys
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class GitHubMCPError(RuntimeError):
    """The separate analyzer server could not complete a static inspection."""


async def inspect_github_agent(github_url: str, agent_name: str | None = None,
                               server_url: str | None = None) -> dict[str, Any]:
    """Ask github_mcp for a static analysis bundle through its MCP interface."""
    command = os.getenv("GITHUB_MCP_COMMAND", sys.executable)
    args = os.getenv("GITHUB_MCP_ARGS", "-m github_mcp.server").split()
    params = StdioServerParameters(command=command, args=args)
    try:
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as client:
                await client.initialize()
                response = await client.call_tool("analyze_github_agent", {
                    "github_url": github_url,
                    "agent_name": agent_name,
                    "server_url": server_url,
                })
                if response.isError or not isinstance(response.structuredContent, dict):
                    raise GitHubMCPError("github_mcp 분석을 완료하지 못했습니다.")
                return response.structuredContent
    except GitHubMCPError:
        raise
    except Exception as exc:
        raise GitHubMCPError("github_mcp 서버에 연결하거나 분석을 완료하지 못했습니다.") from exc
