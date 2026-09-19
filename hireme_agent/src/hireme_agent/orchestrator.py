"""Sequential agent execution with live data by default and explicit demo opt-in."""

from __future__ import annotations

import re
import os
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any, Literal

from langchain_core.runnables import RunnableLambda
from pydantic import BaseModel, Field

from .registry import catalog_for, http_mcp_connection_for, mcp_connection_for
from .metering import settlement_usage
from .model import generate_agent_response


class AgentSelection(BaseModel):
    id: str
    name: str
    role: str
    price: float = Field(ge=0)
    github_url: str | None = None
    analysis: dict[str, Any] | None = None


class ExecutionConfig(BaseModel):
    model_config = {"extra": "allow"}
    mode: Literal["live", "demo"] = "live"
    date: str | None = None
    coins: list[str] | None = None
    title: str | None = None


class WorkflowRequest(BaseModel):
    task: str = Field(min_length=1, max_length=12_000)
    agents: list[AgentSelection] = Field(min_length=1, max_length=12)
    config: ExecutionConfig = Field(default_factory=ExecutionConfig)


def _keywords(text: str) -> set[str]:
    return set(re.findall(r"[\w가-힣]{2,}", text.lower()))


def choose_item(items: list[dict[str, Any]], task: str, fallback: str) -> dict[str, Any]:
    if not items:
        return {"name": fallback, "description": "No published metadata was available."}
    task_words = _keywords(task)
    def score(item: dict[str, Any]) -> tuple[int, str]:
        text = f"{item.get('name', '')} {item.get('description', '')} {item.get('template', '')}"
        return (len(task_words & _keywords(text)), str(item.get("name", "")))
    return max(items, key=score)


def output_summary(output: dict[str, Any]) -> str:
    summary = output.get("summary")
    if isinstance(summary, str) and summary.strip():
        return summary.strip()
    keys = ", ".join(str(key) for key in output.keys())
    return f"구조화된 JSON 결과를 받았습니다. 포함 항목: {keys or '없음'}"


AgentTextGenerator = Callable[..., Awaitable[str]]


def assert_live_result(output: dict[str, Any]) -> None:
    """Reject explicit demo operational payloads, not provenance or example text."""
    pending = [output]
    while pending:
        value = pending.pop()
        if value.get("demo") is True or any(value.get(key) == "demo" for key in ("mode", "dataMode", "data_mode")):
            raise RuntimeError("실시간 실행에서 데모 데이터가 반환되어 중단했습니다. 실제 뉴스·시세가 필요합니다.")
        for key in ("result", "data", "toolResult", "marketSnapshot", "market_snapshot", "news_digest", "news"):
            if isinstance(value.get(key), dict):
                pending.append(value[key])


async def _invoke_mcp(agent: AgentSelection, tool: str, task: str, upstream: dict[str, Any] | None,
                      config: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Invoke an operator-registered remote or local MCP Agent by its ID."""
    http_connection = http_mcp_connection_for(agent.id)
    if http_connection:
        import httpx
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client

        url = http_connection.get("url")
        if not isinstance(url, str) or not url.startswith(("https://", "http://")):
            raise RuntimeError(f"등록된 MCP URL이 올바르지 않습니다: {agent.id}")
        headers: dict[str, str] = {}
        token_env = http_connection.get("token_env")
        if token_env:
            token = os.getenv(token_env)
            if not token:
                raise RuntimeError(f"등록된 MCP 인증 환경변수가 없습니다: {token_env}")
            headers["Authorization"] = f"Bearer {token}"
        try:
            async with httpx.AsyncClient(headers=headers, timeout=50, follow_redirects=False) as http:
                async with streamable_http_client(url, http_client=http) as (read, write, _):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        context = upstream
                        context_key = http_connection.get("context_key")
                        if context_key:
                            previous_result = upstream.get("toolResult", upstream) if isinstance(upstream, dict) else upstream
                            context = {context_key: previous_result}
                        call = await session.call_tool("run_agent", {"task": task, "context": context,
                                                                   "config": config if config is not None else {"mode": "live"}})
        except httpx.HTTPError as exc:
            raise RuntimeError(f"등록된 MCP 서버에 연결하지 못했습니다: {agent.name}") from exc
        if call.isError:
            detail = "; ".join(getattr(item, "text", str(item)) for item in call.content)
            raise RuntimeError(f"MCP Agent {agent.name} 실행 실패: {detail}")
        if not isinstance(call.structuredContent, dict):
            raise RuntimeError(f"MCP Agent {agent.name}가 구조화된 결과를 반환하지 않았습니다")
        result = dict(call.structuredContent)
        if isinstance(result.get("result"), dict):
            result = {**result["result"], "artifacts": result.get("artifacts", []),
                      "usage": result.get("usage", {})}
        for artifact in result.get("artifacts", []):
            if isinstance(artifact, dict) and artifact.get("mimeType") == "text/html" and isinstance(artifact.get("text"), str):
                result["html"] = artifact["text"]
                break
        return result

    connection = mcp_connection_for(agent.id)
    if not connection:
        return None
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    command = connection.get("command")
    if not isinstance(command, str) or not command:
        raise ValueError(f"Agent {agent.id} has MCP configuration without a command")
    extra = connection.get("arguments", {})
    if not isinstance(extra, dict):
        raise ValueError(f"Agent {agent.id} MCP arguments must be an object")
    params = StdioServerParameters(
        command=command,
        args=connection.get("args", []),
        env=connection.get("env"),
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            call = await session.call_tool(tool, {**extra, "task": task, "previous": upstream})
    if call.isError:
        detail = "; ".join(getattr(item, "text", str(item)) for item in call.content)
        raise RuntimeError(f"MCP tool {tool} failed: {detail}")
    # Prefer structured content so agents can pass reliable data downstream.
    if call.structuredContent is not None:
        return dict(call.structuredContent)
    return {"content": [getattr(item, "text", str(item)) for item in call.content]}


async def run_agent_step(state: dict[str, Any]) -> dict[str, Any]:
    agent: AgentSelection = state["agent"]
    catalog = catalog_for(agent.id, agent.analysis)
    selected_tool = choose_item(catalog["tools"], state["task"], "run_agent")
    selected_prompt = choose_item(catalog["prompts"], state["task"], "default_prompt")
    upstream = state.get("upstream")
    execution_config = state.get("config", {"mode": "live"})
    mcp_output = await _invoke_mcp(agent, selected_tool["name"], state["task"], upstream, execution_config)
    if mcp_output is not None:
        if execution_config.get("mode", "live") == "live":
            assert_live_result(mcp_output)
        output = {
            "summary": output_summary(mcp_output),
            "tool": selected_tool["name"],
            "prompt": selected_prompt["name"],
            "toolResult": mcp_output,
            "data": mcp_output,
        }
        if isinstance(mcp_output.get("usage"), dict):
            output["usage"] = mcp_output["usage"]
        if isinstance(mcp_output.get("html"), str):
            output["html"] = mcp_output["html"]
    else:
        text = await state["generator"](
            agent_name=agent.name,
            agent_role=agent.role,
            task=state["task"],
            tool=selected_tool,
            prompt=selected_prompt,
            upstream=upstream,
            tool_result=None,
        )
        output = {"summary": text, "tool": selected_tool["name"], "prompt": selected_prompt["name"]}
    return {
        "agentId": agent.id,
        "agentName": agent.name,
        "selectedTool": selected_tool["name"],
        "selectedPrompt": selected_prompt["name"],
        "input": {"task": state["task"], "previous": upstream, "config": execution_config},
        "output": output,
    }


async def stream_workflow(
    request: WorkflowRequest, generator: AgentTextGenerator = generate_agent_response,
) -> Any:
    """Yield lifecycle events while running each Agent sequentially."""
    chain = RunnableLambda(run_agent_step)
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    upstream: dict[str, Any] | None = None
    steps: list[dict[str, Any]] = []
    for agent in request.agents:
        yield {"type": "step.started", "runId": run_id, "agentId": agent.id, "agentName": agent.name}
        started = time.perf_counter()
        try:
            result = await chain.ainvoke({"task": request.task, "agent": agent, "upstream": upstream, "generator": generator,
                                         "config": request.config.model_dump(exclude_none=True)})
        except Exception as exc:
            yield {"type": "step.failed", "runId": run_id, "agentId": agent.id, "agentName": agent.name, "error": str(exc)}
            raise
        result["duration"] = max(1, round((time.perf_counter() - started) * 1000))
        result["price"] = agent.price
        result["settlementUsage"] = settlement_usage(agent.id, result["output"])
        steps.append(result)
        upstream = result["output"]
        yield {"type": "step.completed", "runId": run_id, "step": result}

    final = upstream or {}
    points = [
        {"title": step["agentName"], "text": step["output"]["summary"]}
        for step in steps
    ]
    workflow_result = {
        "runId": run_id,
        "status": "succeeded",
        "dataMode": request.config.mode,
        "result": {
            "task": request.task,
            "title": "에이전트 워크플로 결과",
            "intro": f"{len(steps)}개 에이전트가 순서대로 실행되었습니다. 각 단계는 이전 단계의 구조화된 출력을 입력으로 받았습니다.",
            "points": points,
            "conclusion": f"마지막 단계는 {final.get('tool', 'run_agent')} 도구와 {final.get('prompt', 'default_prompt')} 프롬프트를 선택해 완료했습니다.",
            "data": final.get("data", final),
            **({"html": final["html"]} if isinstance(final.get("html"), str) else {}),
        },
        "steps": steps,
        "cost": round(sum(step["price"] for step in steps), 3),
        "settlement": {
            "status": "ready",
            "policy": "submit only after the entire workflow succeeds",
            "usages": [step["settlementUsage"] for step in steps],
            "warning": "Estimated usage must be replaced with MCP/provider-reported outputTokens before a paid on-chain settlement.",
        },
    }
    yield {"type": "workflow.completed", "runId": run_id, "result": workflow_result}


async def execute_workflow(
    request: WorkflowRequest, generator: AgentTextGenerator = generate_agent_response,
) -> dict[str, Any]:
    """Run a workflow without streaming; retained for MCP clients and tests."""
    async for event in stream_workflow(request, generator):
        if event["type"] == "workflow.completed":
            return event["result"]
    raise RuntimeError("워크플로가 완료 이벤트 없이 종료되었습니다.")
