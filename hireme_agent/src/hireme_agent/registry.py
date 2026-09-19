"""Demo registry and safe metadata conversion from github_mcp analysis."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

DEMO_CATALOG: dict[str, dict[str, Any]] = {
    "research": {
        "tools": [
            {"name": "search_papers", "description": "Find relevant papers and primary sources."},
            {"name": "compare_sources", "description": "Compare relevance and coverage across sources."},
        ],
        "prompts": [
            {"name": "research_brief", "template": "Collect verifiable context for the user's question."},
        ],
    },
    "evidence": {
        "tools": [
            {"name": "extract_claims", "description": "Extract claims, evidence, and uncertainty."},
            {"name": "normalize_evidence", "description": "Convert findings into a consistent evidence structure."},
        ],
        "prompts": [
            {"name": "evidence_structure", "template": "Keep claims separate from supporting evidence."},
        ],
    },
    "writer": {
        "tools": [
            {"name": "compose_brief", "description": "Write a concise Korean research brief."},
            {"name": "edit_clarity", "description": "Improve structure and readability without adding facts."},
        ],
        "prompts": [
            {"name": "brief_writer", "template": "Write from the supplied evidence and identify limits."},
        ],
    },
    "code": {
        "tools": [
            {"name": "inspect_code", "description": "Inspect code for correctness, types, and edge cases."},
            {"name": "suggest_tests", "description": "Propose focused regression tests."},
        ],
        "prompts": [{"name": "code_review", "template": "Report concrete issues and prioritized fixes."}],
    },
    "data": {
        "tools": [
            {"name": "analyze_patterns", "description": "Identify patterns and comparisons in supplied data."},
            {"name": "check_assumptions", "description": "List assumptions and interpretation risks."},
        ],
        "prompts": [{"name": "data_analysis", "template": "State findings with their limitations."}],
    },
    "translate": {
        "tools": [{"name": "translate_ko", "description": "Translate supplied content into natural Korean."}],
        "prompts": [{"name": "translation", "template": "Preserve meaning, tone, and uncertainty."}],
    },
}

# Deployment-time configuration only. Do not accept an MCP command or endpoint
# from the public workflow request: that would turn /runs into remote execution.
# A production deployment replaces this map with its reviewed agent-version table.
HOSTED_MCP_CONNECTIONS: dict[str, dict[str, Any]] = {}

# Operator-controlled remote MCP endpoints. Browser requests never supply these
# URLs or their credentials.
REGISTERED_HTTP_MCP_CONNECTIONS: dict[str, dict[str, str]] = {}


def mcp_connection_for(agent_id: str) -> dict[str, Any] | None:
    config = HOSTED_MCP_CONNECTIONS.get(agent_id)
    return deepcopy(config) if config else None


def http_mcp_connection_for(agent_id: str) -> dict[str, str] | None:
    config = REGISTERED_HTTP_MCP_CONNECTIONS.get(agent_id)
    return deepcopy(config) if config else None


def catalog_for(agent_id: str, analysis: dict[str, Any] | None = None) -> dict[str, list[dict[str, Any]]]:
    """Prefer reviewed GitHub MCP metadata; use local demo metadata only when absent."""
    if analysis:
        raw_tools = analysis.get("tools", [])
        # github_mcp returns a list today; accept the wrapped form for future adapters.
        tools = raw_tools.get("tools", []) if isinstance(raw_tools, dict) else raw_tools
        prompts = analysis.get("contents", {}).get("prompts", [])
        if tools or prompts:
            return {"tools": deepcopy(tools), "prompts": deepcopy(prompts)}
    return deepcopy(DEMO_CATALOG.get(agent_id, {"tools": [], "prompts": []}))
