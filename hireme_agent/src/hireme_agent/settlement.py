"""Off-chain receipt gate for the Sui Move settlement package.

This module never settles estimated usage. It creates the immutable evidence the
platform must verify before calling settlement::settle_run on Sui.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any


def create_settlement_receipt(workflow: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {record["id"]: record for record in records}
    usages = workflow.get("settlement", {}).get("usages", [])
    paid = []
    for usage in usages:
        pricing = (by_id.get(usage.get("agentId"), {}).get("pricing") or {})
        if pricing.get("amount", 0) > 0:
            paid.append({**usage, "pricing": pricing})
    if not paid:
        return {"status": "not_required", "runId": workflow["runId"], "usages": []}
    if any(item.get("metering") != "reported" for item in paid):
        return {"status": "blocked_unverified_usage", "runId": workflow["runId"], "usages": paid}

    evidence = {"runId": workflow["runId"], "usages": paid, "steps": workflow.get("steps", [])}
    trace_hash = hashlib.sha256(json.dumps(evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    receipt = {"status": "pending_chain_submission", "chain": "sui", "runId": workflow["runId"],
               "traceHash": trace_hash, "usages": paid}
    path = Path(os.getenv("HIREME_SETTLEMENT_RECEIPTS_PATH", "settlement_receipts.jsonl"))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(receipt, ensure_ascii=False, separators=(",", ":")) + "\n")
    return receipt
