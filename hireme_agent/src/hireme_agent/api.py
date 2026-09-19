from __future__ import annotations

import argparse
import json
import os
import re
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from .github_bridge import GitHubMCPError, inspect_github_agent
from .hosting import AgentMCPEndpoint, HostedMCPService, HostSettings
from .model import ModelUnavailableError
from .orchestrator import AgentSelection, WorkflowRequest, execute_workflow, stream_workflow
from .agent_registry import AgentRegistry
from .registry import REGISTERED_HTTP_MCP_CONNECTIONS
from .settlement import create_settlement_receipt
from .sui_adapter import submit_receipt


def agent_id_for(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:72] or "agent"


def validate_server_url(url: str) -> str:
    parsed = urlsplit(url)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname or
            parsed.username or parsed.password or parsed.fragment):
        raise HTTPException(status_code=422, detail="server_url은 사용자 정보나 fragment 없는 http(s) URL이어야 합니다.")
    return url.rstrip("/")


def create_app(settings: HostSettings | None = None, registry_path=None) -> FastAPI:
    service = HostedMCPService(settings)
    registry = AgentRegistry(registry_path)
    application_registry_connections = REGISTERED_HTTP_MCP_CONNECTIONS
    for record in registry.all():
        execution = record.get("execution", {})
        if execution.get("kind") == "remote_mcp":
            application_registry_connections[record["id"]] = {"url": execution["url"]}

    @asynccontextmanager
    async def lifespan(application):
        async with service.lifespan():
            public_url = os.getenv(
                "HIREME_AGENT_PUBLIC_URL",
                f"http://127.0.0.1:{os.getenv('HIREME_AGENT_PORT', '8000')}",
            ).rstrip("/")
            if public_url:
                for name in service.agents:
                    config = {"url": f"{public_url}/agents/{name}/mcp"}
                    if name == "crypto_market_html_mcp":
                        config["context_key"] = "news_digest"
                    application_registry_connections.setdefault(name, config)
            yield

    application = FastAPI(title="HireMe Agent Runtime", version="0.1.0", lifespan=lifespan)
    application.state.mcp_host = service
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(dict.fromkeys(["http://localhost:3000", "http://127.0.0.1:3000"] +
                                        [origin for origin in service.settings.allowed_origins if not origin.endswith(":*")])),
        allow_methods=["POST", "GET", "DELETE", "OPTIONS"],
        allow_headers=["content-type", "authorization", "mcp-protocol-version", "mcp-session-id", "accept"],
        expose_headers=["mcp-session-id", "mcp-protocol-version"],
    )
    application.add_api_route("/health", health, methods=["GET"])

    async def require_auth(request: Request):
        if not service.authorized(request):
            raise HTTPException(status_code=401, detail="MCP bearer authentication required", headers={"WWW-Authenticate": "Bearer"})

    async def registered_run(request: WorkflowRequest) -> dict:
        resolved = []
        for agent in request.agents:
            registration = registry.get(agent.id)
            if registration is None:
                resolved.append(agent)
                continue
            resolved.append(agent.model_copy(update={
                "github_url": registration["github_url"],
                "analysis": registration["analysis"],
            }))
        result = await run_workflow(request.model_copy(update={"agents": resolved}))
        records = registry.all() + [
            {"id": name, "pricing": {"unit": "output token", "amount": 1}}
            for name in service.agents
        ]
        receipt = create_settlement_receipt(result, records)
        result["chainSettlement"] = (
            await submit_receipt(receipt)
            if receipt["status"] == "pending_chain_submission" and os.getenv("HIREME_SUI_PRIVATE_KEY")
            else receipt
        )
        return result

    async def registered_stream(request: WorkflowRequest) -> StreamingResponse:
        resolved = []
        for agent in request.agents:
            registration = registry.get(agent.id)
            resolved.append(agent if registration is None else agent.model_copy(update={
                "github_url": registration["github_url"], "analysis": registration["analysis"],
            }))
        resolved_request = request.model_copy(update={"agents": resolved})
        async def events():
            try:
                async for event in stream_workflow(resolved_request):
                    if event["type"] == "workflow.completed":
                        records = registry.all() + [
                            {"id": name, "pricing": {"unit": "output token", "amount": 1}}
                            for name in service.agents
                        ]
                        receipt = create_settlement_receipt(event["result"], records)
                        event["result"]["chainSettlement"] = (
                            await submit_receipt(receipt)
                            if receipt["status"] == "pending_chain_submission" and os.getenv("HIREME_SUI_PRIVATE_KEY")
                            else receipt
                        )
                    yield f"event: {event['type']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
            except Exception as exc:
                error = {"type": "workflow.failed", "error": str(exc)}
                yield f"event: workflow.failed\ndata: {json.dumps(error, ensure_ascii=False)}\n\n"
        return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

    async def register_agent(payload: dict, request: Request) -> dict:
        name = payload.get("name")
        github_url = payload.get("github_url")
        existing_server = payload.get("existing_server", False)
        server_url = payload.get("server_url")
        price_per_100m = payload.get("price_per_100m")
        if not isinstance(name, str) or not 2 <= len(name.strip()) <= 80:
            raise HTTPException(status_code=422, detail="name은 2~80자여야 합니다.")
        if not isinstance(github_url, str) or not github_url:
            raise HTTPException(status_code=422, detail="github_url이 필요합니다.")
        if not isinstance(existing_server, bool):
            raise HTTPException(status_code=422, detail="existing_server는 boolean이어야 합니다.")
        endpoint = validate_server_url(server_url) if existing_server and isinstance(server_url, str) else None
        if existing_server and not endpoint:
            raise HTTPException(status_code=422, detail="기존 서버를 사용하려면 server_url이 필요합니다.")
        if existing_server and (
            isinstance(price_per_100m, bool)
            or not isinstance(price_per_100m, (int, float))
            or price_per_100m < 0
        ):
            raise HTTPException(status_code=422, detail="price_per_100m은 0 이상의 숫자여야 합니다.")
        agent_id = agent_id_for(name)
        if registry.get(agent_id):
            raise HTTPException(status_code=409, detail="같은 이름의 에이전트가 이미 등록되어 있습니다.")
        hosted_url = str(request.base_url).rstrip("/") + f"/agents/{agent_id}/mcp"
        execution = (
            {"kind": "remote_mcp", "url": endpoint, "status": "ready"}
            if existing_server else
            {"kind": "hireme_hosted_demo", "url": hosted_url, "status": "ready"}
        )
        execution_url = execution["url"]
        try:
            analysis = await inspect_github_agent(github_url, name, execution_url)
        except GitHubMCPError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        record = {
            "id": agent_id,
            "name": name.strip(),
            "role": "Custom Agent",
            "price": 0.0,
            "github_url": github_url,
            "execution": execution,
            "pricing": {"unit": "100M tokens", "amount": float(price_per_100m)} if existing_server else None,
            "analysis": analysis,
        }
        try:
            registry.register(record)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if existing_server:
            application_registry_connections[agent_id] = {"url": execution_url}
        return {"agent": {
            "id": agent_id, "name": name.strip(), "role": "Custom Agent", "price": 0.0,
            "githubUrl": github_url, "serverUrl": execution_url, "hostedUrl": hosted_url,
            "existingServer": existing_server, "pricePer100M": float(price_per_100m) if existing_server else None,
            "analysis": analysis,
        }}

    async def run_registered_agent(agent_id: str, payload: dict) -> dict:
        registration = registry.get(agent_id)
        if registration is None:
            raise HTTPException(status_code=404, detail="등록된 에이전트를 찾을 수 없습니다.")
        task = payload.get("task")
        if not isinstance(task, str) or not task.strip():
            raise HTTPException(status_code=422, detail="task가 필요합니다.")
        agent = AgentSelection(
            id=registration["id"], name=registration["name"], role=registration["role"],
            price=registration["price"], github_url=registration["github_url"],
            analysis=registration["analysis"],
        )
        result = await run_workflow(WorkflowRequest(task=task, agents=[agent]))
        return {"status": "succeeded", "result": result["steps"][0]["output"]}

    async def delete_registered_agent(agent_id: str) -> dict:
        if not registry.delete(agent_id):
            raise HTTPException(status_code=404, detail="등록된 에이전트를 찾을 수 없습니다.")
        application_registry_connections.pop(agent_id, None)
        return {"deleted": agent_id}

    application.add_api_route("/runs", registered_run, methods=["POST"], dependencies=[Depends(require_auth)])
    application.add_api_route("/runs/stream", registered_stream, methods=["POST"], dependencies=[Depends(require_auth)])
    application.add_api_route("/agents/inspect", inspect_agent, methods=["POST"], dependencies=[Depends(require_auth)])
    application.add_api_route("/agents/register", register_agent, methods=["POST"], dependencies=[Depends(require_auth)])
    application.add_api_route("/agents/{agent_id}/run", run_registered_agent, methods=["POST"], dependencies=[Depends(require_auth)])
    application.add_api_route("/agents/registry/{agent_id}", delete_registered_agent, methods=["DELETE"], dependencies=[Depends(require_auth)])

    @application.get("/agents")
    async def hosted_agents(request: Request):
        if not service.authorized(request):
            return JSONResponse({"error": "MCP bearer authentication required"}, status_code=401,
                                headers={"WWW-Authenticate": "Bearer"})
        return {"agents": service.describe() + [{
            "name": record["id"], "displayName": record["name"], "status": "registered",
            "execution": record["execution"], "pricePer100M": (record.get("pricing") or {}).get("amount"),
            "summary": record["analysis"].get("manifest", {}).get("summary", {}),
        } for record in registry.all()]}

    application.router.routes.append(Route("/agents/{agent_name}/mcp", AgentMCPEndpoint(service), methods=["GET", "POST", "DELETE"]))
    return application


async def health() -> dict[str, str]:
    return {"status": "ok"}


async def run_workflow(request: WorkflowRequest) -> dict:
    try:
        return await execute_workflow(request)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


async def stream_run_workflow(request: WorkflowRequest) -> StreamingResponse:
    async def events():
        try:
            async for event in stream_workflow(request):
                yield f"event: {event['type']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
        except ModelUnavailableError as exc:
            error = {"type": "workflow.failed", "error": str(exc)}
            yield f"event: workflow.failed\ndata: {json.dumps(error, ensure_ascii=False)}\n\n"
        except Exception:
            error = {"type": "workflow.failed", "error": "워크플로 실행 중 오류가 발생했습니다."}
            yield f"event: workflow.failed\ndata: {json.dumps(error, ensure_ascii=False)}\n\n"
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


async def inspect_agent(payload: dict[str, str]) -> dict:
    github_url = payload.get("github_url")
    if not github_url:
        raise HTTPException(status_code=422, detail="github_url is required")
    try:
        return await inspect_github_agent(github_url, payload.get("agent_name"))
    except GitHubMCPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


app = create_app()


def main() -> None:
    import uvicorn
    parser = argparse.ArgumentParser(description="HireMe HTTP API and agent-addressed MCP host")
    parser.add_argument("--host", default=os.getenv("HIREME_AGENT_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("HIREME_AGENT_PORT", "8000")))
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    if args.host not in {"127.0.0.1", "localhost", "::1"} and not app.state.mcp_host.settings.token:
        parser.error("Set HIREME_MCP_TOKEN before binding the reviewed runtimes to an external interface")
    os.environ.setdefault("HIREME_AGENT_PUBLIC_URL", f"http://{args.host}:{args.port}")
    uvicorn.run("hireme_agent.api:app", host=args.host, port=args.port, reload=args.reload)
