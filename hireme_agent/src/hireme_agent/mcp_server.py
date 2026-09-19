"""MCP entry point for invoking a composed HireMe workflow."""

from typing import Any

from mcp.server.fastmcp import FastMCP

from .orchestrator import WorkflowRequest, execute_workflow

mcp = FastMCP("hireme_agent", instructions=(
    "Run selected HireMe agents sequentially. Before each step the runtime selects "
    "a tool and prompt from that agent's registered MCP metadata, then passes the "
    "structured output into the next agent."
))


@mcp.tool(structured_output=True)
async def run_workflow(task: str, agents: list[dict[str, Any]], config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Execute an ordered agent workflow and return its result plus per-step trace."""
    return await execute_workflow(WorkflowRequest(task=task, agents=agents, config=config or {}))


def main() -> None:
    mcp.run(transport="stdio")
