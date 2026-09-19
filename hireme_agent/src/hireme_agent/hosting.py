"""Agent-addressed HTTP MCP hosting backed by reviewed native stdio runtimes.

Compilation supplies public content/definitions; deployment-time bindings supply
executable code. No URL, executable, module or path is accepted from callers.
"""

from __future__ import annotations

import asyncio
import base64
import hmac
import json
import os
import re
import sys
import time
import uuid
from contextlib import AsyncExitStack, asynccontextmanager
from dataclasses import dataclass, field, replace as dataclass_replace
from pathlib import Path
from typing import Any

from github_mcp.snapshot import LocalSnapshotClient, analyze_local
from jsonschema import Draft202012Validator, ValidationError
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client
from mcp.server.lowlevel import Server
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from mcp.shared.exceptions import McpError
from starlette.requests import Request
from starlette.responses import JSONResponse

WORKSPACE = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class HostSettings:
    agents_root: Path = field(default_factory=lambda: Path(os.getenv("HIREME_AGENTS_ROOT", str(WORKSPACE / "agents"))))
    token: str = field(default_factory=lambda: os.getenv("HIREME_MCP_TOKEN", ""))
    timeout: float = 50
    global_concurrency: int = 4
    agent_concurrency: int = 2
    allowed_hosts: tuple[str, ...] = ("localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*", "[::1]", "[::1]:*")
    allowed_origins: tuple[str, ...] = ("http://localhost:*", "http://127.0.0.1:*")

    @classmethod
    def from_env(cls):
        settings = cls(
            timeout=float(os.getenv("HIREME_MCP_TIMEOUT", "50")),
            global_concurrency=int(os.getenv("HIREME_MCP_CONCURRENCY", "4")),
            agent_concurrency=int(os.getenv("HIREME_MCP_AGENT_CONCURRENCY", "2")),
        )
        if os.getenv("HIREME_MCP_ALLOWED_HOSTS"):
            settings = dataclass_replace(settings, allowed_hosts=tuple(filter(None, os.environ["HIREME_MCP_ALLOWED_HOSTS"].split(","))))
        if os.getenv("HIREME_MCP_ALLOWED_ORIGINS"):
            settings = dataclass_replace(settings, allowed_origins=tuple(filter(None, os.environ["HIREME_MCP_ALLOWED_ORIGINS"].split(","))))
        if not 0 < settings.timeout <= 300 or min(settings.global_concurrency, settings.agent_concurrency) < 1:
            raise ValueError("Invalid MCP timeout or concurrency settings")
        return settings


@dataclass(frozen=True)
class Deployment:
    folder: str
    workflow: str
    environment_keys: tuple[str, ...] = ()


# These sources were created and reviewed in this workspace. Imported metadata
# does not add deployment bindings and cannot authorize remote code execution.
REVIEWED_DEPLOYMENTS = (
    Deployment("crypto_news_research", "crypto_news"),
    Deployment("crypto_market_html", "crypto_html", ("COINGECKO_DEMO_API_KEY",)),
)

RUN_AGENT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "task": {"type": "string", "minLength": 1, "maxLength": 12000},
        "context": {"anyOf": [{"type": "object"}, {"type": "null"}], "default": None},
        "config": {"anyOf": [{"type": "object"}, {"type": "null"}], "default": None},
    }, "required": ["task"],
}


def protocol_error(message: str):
    return McpError(types.ErrorData(code=types.INVALID_PARAMS, message=message))


def tool_error_message(error: Exception) -> str:
    # Native MCP contexts wrap an invocation failure in nested task-group errors.
    while isinstance(error, ExceptionGroup) and len(error.exceptions) == 1:
        error = error.exceptions[0]
    if isinstance(error, ValidationError):
        return "Arguments do not match the registered tool schema"
    if isinstance(error, TimeoutError):
        return "Agent execution exceeded the configured request deadline"
    if isinstance(error, (ValueError, RuntimeError)):
        return str(error)
    return "Agent runtime failed"


class HostedAgent:
    def __init__(self, deployment: Deployment, settings: HostSettings, global_gate: asyncio.Semaphore):
        root = settings.agents_root.resolve()
        self.source = (root / deployment.folder).resolve()
        if not self.source.is_relative_to(root) or not (self.source / "agent.py").is_file():
            raise ValueError(f"Reviewed runtime is missing: {deployment.folder}")
        self.deployment, self.settings = deployment, settings
        self.repository = "https://github.com/hireme-demo/" + deployment.folder.replace("_", "-")
        self.bundle = analyze_local(self.source, self.repository, deployment.folder)
        self.name = self.bundle["manifest"]["serverName"]
        self.digest = self.bundle["manifest"]["source"]["snapshotDigest"]
        self.definitions = {item["name"]: item for item in self.bundle["tools"]}
        if len(self.definitions) != len(self.bundle["tools"]) or not self.bundle["manifest"]["coverage"]["complete"]:
            raise ValueError("Deployment requires unique tool names and complete analysis")
        for definition in self.definitions.values():
            if definition["schemaStatus"] != "draft":
                raise ValueError("Deployment contains unresolved tool input schemas")
            Draft202012Validator.check_schema(definition["inputSchema"])
        self.static_resources = {r["uri"]: r for r in self.bundle["contents"]["resources"]}
        self.prompt_definitions = {p["name"]: p for p in self.bundle["contents"]["prompts"]}
        self.global_gate, self.gate = global_gate, asyncio.Semaphore(settings.agent_concurrency)
        self.catalog = None

    def assert_snapshot(self):
        snapshot = LocalSnapshotClient(self.source, self.repository)
        if snapshot.digest != self.digest:
            raise RuntimeError("Agent source changed after registration; restart to register the new snapshot")

    @asynccontextmanager
    async def session(self):
        # Each request owns a child and a native MCP session. User invocations do
        # not share mutable process state. This is not a container security sandbox.
        async with asyncio.timeout(self.settings.timeout):
            async with self.global_gate, self.gate:
                await asyncio.to_thread(self.assert_snapshot)
                environment = {key: os.environ[key] for key in self.deployment.environment_keys if key in os.environ}
                params = StdioServerParameters(command=sys.executable, args=[str(self.source / "agent.py")],
                                                cwd=str(self.source), env=environment)
                async with stdio_client(params) as (read, write):
                    async with ClientSession(read, write) as client:
                        await client.initialize()
                        tools = {tool.name: tool for tool in (await client.list_tools()).tools}
                        bindings = {name: definition.get("originalName", name) for name, definition in self.definitions.items()}
                        if set(bindings.values()) != set(tools) or "run_agent" in tools:
                            raise RuntimeError("Compiled definitions differ from the reviewed runtime tool catalog")
                        self.catalog = {"tools": tools, "bindings": bindings,
                                        "resources": (await client.list_resources()).resources,
                                        "prompts": (await client.list_prompts()).prompts}
                        yield client

    async def ensure_catalog(self):
        if self.catalog is None:
            async with self.session():
                pass

    async def list_tools(self):
        await self.ensure_catalog()
        result = []
        for name, definition in self.definitions.items():
            upstream = self.catalog["tools"][self.catalog["bindings"][name]]
            # Publish runtime-validated schemas, while retaining compiler source
            # metadata. Both schemas are checked when actual requests execute.
            metadata = {**(upstream.meta or {}), "hireme": {"snapshotDigest": self.digest,
                        "source": definition["source"], "sourceSimulated": self.bundle["manifest"]["source"]["simulated"]}}
            result.append(upstream.model_copy(update={"name": name, "description": definition["description"], "meta": metadata}))
        result.append(types.Tool(name="run_agent", description=(
            "Execute this agent's reviewed workflow. config.mode is live (default) or demo. "
            "The news agent accepts config.date; the HTML agent requires context.news_digest. "
            "task labels the request; these sample recipes do not use an LLM to plan arbitrary tasks."
        ), inputSchema=RUN_AGENT_SCHEMA))
        return result

    async def call_native(self, client, name, arguments):
        definition = self.definitions.get(name)
        if definition is None:
            raise ValueError("Tool is not registered for this agent")
        Draft202012Validator(definition["inputSchema"]).validate(arguments)
        native_name = self.catalog["bindings"][name]
        Draft202012Validator(self.catalog["tools"][native_name].inputSchema).validate(arguments)
        return await client.call_tool(native_name, arguments)

    async def run_agent(self, client, arguments):
        Draft202012Validator(RUN_AGENT_SCHEMA).validate(arguments)
        context, config = arguments.get("context") or {}, arguments.get("config") or {}
        mode = config.get("mode", "live")
        if mode not in {"live", "demo"}:
            raise ValueError("config.mode must be live or demo")
        run_id, started, trace = "run_" + uuid.uuid4().hex, time.perf_counter(), []

        async def step(name, args):
            tick = time.perf_counter()
            call = await self.call_native(client, name, args)
            if call.isError:
                message = "; ".join(getattr(block, "text", "") for block in call.content)
                raise RuntimeError(f"{name} failed: {message}")
            if call.structuredContent is None:
                raise RuntimeError("Runtime returned no structured tool output")
            trace.append({"tool": name, "status": "succeeded", "durationMs": round((time.perf_counter() - tick) * 1000)})
            value = call.structuredContent
            return value["result"] if set(value) == {"result"} else value

        artifacts = []
        if self.deployment.workflow == "crypto_news":
            news = await step("fetch_today_crypto_news", {"date": config.get("date"), "mode": mode})
            evidence = await step("collect_article_evidence", {"news": news})
            digest = await step("summarize_crypto_news", {"news": news})
            result = await step("analyze_crypto_insights", {"news_digest": digest, "enriched_news": evidence})
        elif self.deployment.workflow == "crypto_html":
            digest = context.get("news_digest")
            if not isinstance(digest, dict):
                raise ValueError("context.news_digest must contain the news agent's research result")
            market = await step("fetch_market_snapshot", {"coins": config.get("coins"), "mode": mode})
            html = await step("build_crypto_market_html", {"news_digest": digest, "market_snapshot": market,
                                                          "title": config.get("title", "오늘의 코인 시장 브리핑")})
            result = {"newsDate": digest["date"], "marketSnapshot": market, "reportFormat": "html"}
            artifacts = [{"name": "report.html", "mimeType": "text/html", "text": html}]
        else:
            raise ValueError("No reviewed workflow adapter exists for this agent")
        output_tokens = max(1, (len(json.dumps(result, ensure_ascii=False).encode("utf-8")) + 3) // 4)
        return {"runId": run_id, "agentName": self.name, "version": self.digest, "status": "succeeded",
                "result": result, "artifacts": artifacts,
                "usage": {"durationMs": round((time.perf_counter() - started) * 1000),
                          "outputTokens": output_tokens}, "trace": trace}

    async def call_tool(self, name, arguments):
        if name != "run_agent" and name not in self.definitions:
            return types.CallToolResult(isError=True, content=[types.TextContent(type="text", text="Tool is not registered for this agent")])
        try:
            async with self.session() as client:
                if name == "run_agent":
                    return await self.run_agent(client, arguments)
                return await self.call_native(client, name, arguments)
        except Exception as exc:
            message = tool_error_message(exc)
        return types.CallToolResult(isError=True, content=[types.TextContent(type="text", text=message)])

    async def list_resources(self):
        await self.ensure_catalog()
        native = list(self.catalog["resources"])
        native_uris = {str(resource.uri) for resource in native}
        return native + [types.Resource(uri=r["uri"], name=r["name"], mimeType=r["mimeType"],
                                        description=f"Compiled {r['kind']} content")
                         for r in self.static_resources.values() if r["uri"] not in native_uris]

    async def read_resource(self, uri):
        text_uri = str(uri)
        if text_uri in self.static_resources:
            resource = self.static_resources[text_uri]
            return [ReadResourceContents(content=resource["text"], mime_type=resource["mimeType"])]
        await self.ensure_catalog()
        if text_uri not in {str(r.uri) for r in self.catalog["resources"]}:
            raise protocol_error("Resource is not registered for this agent")
        async with self.session() as client:
            result = await client.read_resource(text_uri)
        return [ReadResourceContents(content=c.text if isinstance(c, types.TextResourceContents) else base64.b64decode(c.blob),
                                     mime_type=c.mimeType) for c in result.contents]

    async def list_prompts(self):
        await self.ensure_catalog()
        native = list(self.catalog["prompts"])
        names = {p.name for p in native}
        for p in self.prompt_definitions.values():
            if p["name"] not in names and "template" in p:
                arguments = sorted(set(re.findall(r"\{\{\s*(\w+)\s*\}\}", p["template"])))
                native.append(types.Prompt(name=p["name"], description="Compiled reusable agent content",
                                           arguments=[types.PromptArgument(name=name, required=True) for name in arguments]))
        return native

    async def get_prompt(self, name, arguments):
        await self.ensure_catalog()
        arguments = arguments or {}
        if name in {p.name for p in self.catalog["prompts"]}:
            async with self.session() as client:
                return await client.get_prompt(name, arguments=arguments)
        prompt = self.prompt_definitions.get(name)
        if prompt is None or "template" not in prompt:
            raise protocol_error("Prompt is not registered for this agent")
        text = prompt["template"]
        keys = set(re.findall(r"\{\{\s*(\w+)\s*\}\}", text))
        if set(arguments) != keys:
            raise protocol_error("Prompt arguments must match the compiled template")
        text = re.sub(r"\{\{\s*(\w+)\s*\}\}", lambda match: arguments[match.group(1)], text)
        return types.GetPromptResult(messages=[types.PromptMessage(role="user", content=types.TextContent(type="text", text=text))])

    def mcp_server(self):
        instructions = "\n\n".join(r["text"] for r in self.static_resources.values() if r["kind"] == "instructions")
        server = Server(self.name, version="0.1.0", instructions=instructions)
        server.list_tools()(self.list_tools)
        server.call_tool()(self.call_tool)
        server.list_resources()(self.list_resources)
        server.read_resource()(self.read_resource)
        server.list_prompts()(self.list_prompts)
        server.get_prompt()(self.get_prompt)
        return server


class HostedMCPService:
    def __init__(self, settings: HostSettings | None = None):
        self.settings = settings or HostSettings.from_env()
        self.agents = {}
        self.managers = {}
        self.started = False

    @asynccontextmanager
    async def lifespan(self):
        # New managers for every lifespan; the SDK prohibits restarting an old one.
        gate = asyncio.Semaphore(self.settings.global_concurrency)
        agents = [HostedAgent(d, self.settings, gate) for d in REVIEWED_DEPLOYMENTS]
        self.agents = {agent.name: agent for agent in agents}
        security = TransportSecuritySettings(allowed_hosts=list(self.settings.allowed_hosts), allowed_origins=list(self.settings.allowed_origins))
        self.managers = {agent.name: StreamableHTTPSessionManager(agent.mcp_server(), json_response=True, stateless=True,
                                                                 security_settings=security, max_request_body_size=1024 * 1024)
                         for agent in agents}
        async with AsyncExitStack() as stack:
            for manager in self.managers.values():
                await stack.enter_async_context(manager.run())
            self.started = True
            try:
                yield
            finally:
                self.started = False

    def authorized(self, request: Request):
        if not self.settings.token:
            return True
        scheme, _, supplied = request.headers.get("authorization", "").partition(" ")
        return scheme.lower() == "bearer" and hmac.compare_digest(supplied.encode(), self.settings.token.encode())

    def describe(self):
        return [{"name": agent.name, "version": agent.digest, "status": "registered",
                 "endpoint": f"/agents/{agent.name}/mcp", "source": agent.bundle["manifest"]["source"],
                 "summary": agent.bundle["manifest"]["summary"], "workflow": agent.deployment.workflow}
                for agent in self.agents.values()]


class AgentMCPEndpoint:
    """ASGI endpoint, not a JSON REST wrapper: the official MCP transport handles requests."""

    def __init__(self, service: HostedMCPService):
        self.service = service

    async def __call__(self, scope, receive, send):
        request = Request(scope)
        if not self.service.authorized(request):
            await JSONResponse({"error": "MCP bearer authentication required"}, status_code=401,
                               headers={"WWW-Authenticate": "Bearer"})(scope, receive, send)
            return
        if not self.service.started:
            await JSONResponse({"error": "MCP host is not started"}, status_code=503)(scope, receive, send)
            return
        manager = self.service.managers.get(scope["path_params"]["agent_name"])
        if manager is None:
            await JSONResponse({"error": "Agent is not registered"}, status_code=404)(scope, receive, send)
            return
        await manager.handle_request(scope, receive, send)
