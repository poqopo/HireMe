"""Usage records used to create an off-chain settlement receipt.

The chain only receives the aggregate output-token count for each successful
call. Keep the full MCP trace in the runtime database, keyed by ``runId``.
"""

from __future__ import annotations

import re
from typing import Any


def output_token_count(output: Any) -> tuple[int, str]:
    """Return MCP-reported tokens, falling back to a clearly labelled estimate."""
    if isinstance(output, dict):
        usage = output.get("usage")
        if isinstance(usage, dict):
            for key in ("outputTokens", "output_tokens", "completion_tokens"):
                value = usage.get(key)
                if isinstance(value, int) and value >= 0:
                    return value, "reported"
    # A deterministic demo has no model provider usage field. This makes the
    # limitation explicit; production should reject estimated records for paid runs.
    words = re.findall(r"\S+", str(output))
    return max(1, (len(words) + 3) // 4), "estimated"


def settlement_usage(agent_id: str, output: Any) -> dict[str, Any]:
    tokens, source = output_token_count(output)
    return {"agentId": agent_id, "outputTokens": tokens, "metering": source}
