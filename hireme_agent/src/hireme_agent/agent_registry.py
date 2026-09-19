"""Durable, server-owned records for runnable Agent versions."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


class AgentRegistry:
    def __init__(self, path: Path | str | None = None):
        default = Path(os.getenv("HIREME_AGENT_REGISTRY_PATH", "agent_registry.json"))
        self.path = Path(path or default).resolve()
        self.records: dict[str, dict[str, Any]] = {}
        if self.path.exists():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self.records = data if isinstance(data, dict) else {}

    def get(self, agent_id: str) -> dict[str, Any] | None:
        record = self.records.get(agent_id)
        return json.loads(json.dumps(record)) if record else None

    def all(self) -> list[dict[str, Any]]:
        return [self.get(agent_id) for agent_id in sorted(self.records)]

    def register(self, record: dict[str, Any]) -> None:
        agent_id = record["id"]
        if agent_id in self.records:
            raise ValueError("같은 이름의 에이전트가 이미 등록되어 있습니다.")
        self.records[agent_id] = record
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(self.records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(self.path)

    def delete(self, agent_id: str) -> bool:
        if agent_id not in self.records:
            return False
        del self.records[agent_id]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(self.records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(self.path)
        return True
