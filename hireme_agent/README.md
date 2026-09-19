# HireMe Agent Runtime

`hireme_agent` is the runtime behind the playground. It executes a selected, acyclic list of agents in order. Before each agent runs, it selects one of that agent's discovered MCP tools and prompts; the prior step's structured output becomes the next step's context.

The runtime has two entry points:

```bash
cd hireme_agent
uv run --with-editable ../github_mcp --with-editable . hireme-agent-api
uv run --with-editable . hireme-agent-mcp
```

The HTTP API listens on `http://127.0.0.1:8000` by default. The web app proxies `POST /api/runs` to it; set `HIREME_AGENT_URL` when it runs elsewhere.

Set an OpenAI API key before running a workflow. It stays in the runtime process and is never sent to the browser:

```bash
export OPENAI_API_KEY="..."
export HIREME_OPENAI_MODEL="gpt-5" # optional
```


Each selected Agent now calls the OpenAI Responses API using its role, selected tool description, selected prompt, the user request, and the previous Agent output. If a hosted MCP tool is configured, its result is included in the model context before the response is generated.

`POST /agents/inspect` accepts a GitHub URL and invokes the separate `github_mcp` server over MCP stdio. The analysis only discovers metadata; it never executes the imported repository. Its resulting tools and prompts can be stored in the registry before an agent is runnable.

## Agent registry

`POST /agents/register` analyzes a GitHub repository and saves a server-owned Agent record in `agent_registry.json` (override its location with `HIREME_AGENT_REGISTRY_PATH`). At present, registration supports an existing Streamable HTTP MCP endpoint through `existing_server: true` and `server_url`. The chat API receives only the Agent ID; it resolves the saved endpoint and performs the MCP handshake itself. Browser-supplied URLs and credentials are never used for execution.

## Hosted MCP agents

The playground `/runs` and `/runs/stream` routes also default to live execution. They no longer force demo mode when calling a registered HTTP MCP agent. To request fixtures for tests, pass `config: {"mode": "demo"}` explicitly at the workflow level. Live requests reject responses explicitly marked as demo, including nested market snapshots. Network/API failures remain errors rather than being replaced with mock market data.

One HTTP process now serves the two reviewed crypto agents using the official MCP Streamable HTTP transport. The agent is selected by its endpoint, not by an executable or URL supplied in a request.

Start from the workspace root:

```sh
uv run --project hireme_agent hireme-agent-api
```

| Agent | MCP endpoint | Whole-agent result |
| --- | --- | --- |
| crypto_news_research_mcp | http://127.0.0.1:8000/agents/crypto_news_research_mcp/mcp | Article-grounded research JSON |
| crypto_market_html_mcp | http://127.0.0.1:8000/agents/crypto_market_html_mcp/mcp | Market metadata and an HTML artifact |

`GET /agents` lists registered names, versions, endpoints and compilation summaries. These URLs are MCP endpoints: use an MCP client and perform initialize before tools/list or tools/call. They are not JSON REST tool-invocation URLs.

Each endpoint exposes its own native Tools plus the standard `run_agent` Tool, native Resources/Prompts, and the compiler's static reference/instruction/skill/template content. Compiled prompt placeholders become required MCP prompt arguments. Server initialization also advertises the agent's instructions. Requests cannot access another agent's tools or native resource URIs.

### Run an entire agent

Call `run_agent` at the news endpoint:

```json
{
  "task": "오늘의 코인 기사 본문과 인사이트를 정리해줘",
  "config": {"mode": "demo"}
}
```

It actually executes fetch_today_crypto_news → collect_article_evidence → summarize_crypto_news → analyze_crypto_insights in one child MCP session. The response's `result` is the completed research JSON.

Pass that JSON to `run_agent` at the HTML endpoint:

```json
{
  "task": "리서치와 시세를 인터랙티브 HTML로 만들어줘",
  "context": {"news_digest": "REPLACE_WITH_THE_NEWS_RESULT_OBJECT"},
  "config": {"mode": "demo"}
}
```

`context.news_digest` must be the actual JSON object, not the placeholder string above. This agent executes fetch_market_snapshot → build_crypto_market_html and returns HTML in `artifacts[0].text`. Results include runId, agentName, source snapshot version, execution durations and per-tool trace.

`config.mode` defaults to `live`. `demo` uses the fictional 2026-09-19 data. The news agent also accepts `config.date`; the HTML agent accepts `config.coins` and `config.title`. `task` labels the request: these reviewed sample recipes do not infer arbitrary workflows from natural language and do not invoke an LLM. The news interpretation remains a rule-based draft. The separate `/runs` playground route retains its existing model/local-fallback behavior.

Reproduce the HTTP round-trip with the server running, from the workspace root:

```sh
uv run --project hireme_agent python hireme_agent/scripts/run_hosted_demo.py \
  --base-url http://127.0.0.1:8000 --mode demo \
  --output hireme_agent/output/hosted_mcp_demo
```

It saves news_run.json, html_run.json, report.html and receipt.json. Choose a new output directory when rerunning; existing files are preserved. The client reads HIREME_MCP_TOKEN from its environment when the server requires authentication.

### Registration and execution

At startup the host compiles the two reviewed source folders into in-memory manifest/contents/tools bundles using the same github_mcp analyzer. Deployment bindings are in `hosting.py`'s REVIEWED_DEPLOYMENTS. Tool definitions and actual runtime catalogs are checked, and incoming arguments must satisfy both compiled and native schemas. Published native Tool schemas include source/snapshot metadata.

Contents/Tools JSON describes an interface; it does not turn Markdown into executable code. A new agent requires reviewed executable runtime code, a deployment binding, and a reviewed workflow adapter for the whole-agent `run_agent` recipe. An imported GitHub analysis alone does not register or execute a repository. The samples' GitHub identities are explicitly simulated; the local content snapshot digest is the executable version identifier.

Before each native invocation, source content must still match the registered snapshot. Restart the server after intentionally changing source, instructions or templates. Each invocation gets a fresh child process/session; a run_agent recipe reuses its child for its own ordered steps. No result data is cached between users.

### Hosting configuration

Default binding is localhost. `.env.example` lists available settings. Pass environment variables explicitly or use uv's `--env-file` option; the app does not implicitly load a .env file.

For an external interface, set HIREME_MCP_TOKEN and the permitted public Host/Origin headers, then bind:

```sh
uv run --project hireme_agent hireme-agent-api --host 0.0.0.0 --port 8000
```

With a token configured, MCP endpoints, GET /agents, POST /runs and POST /agents/inspect require `Authorization: Bearer ...`; health stays public. A frontend server proxy must forward the bearer credential when configured. The CLI refuses an external bind without a token. For a public URL, terminate HTTPS at your hosting platform or reverse proxy and configure HIREME_MCP_ALLOWED_HOSTS/HIREME_MCP_ALLOWED_ORIGINS to that deployment. Exact configured browser origins are also enabled in CORS.

Default limits: 4 concurrent runtime sessions total, 2 per agent, a 50-second deadline per runtime operation (queue/startup included), and 1 MiB MCP request bodies. Agent secrets are injected only from the deployment's allowed environment keys; the news runtime receives no platform API keys.

This is a trusted-sample runtime: child processes share the host OS permissions and are not container sandboxes. Shared bearer authentication is included; multi-user permissions, per-agent containers, durable jobs and community-code deployment are not implemented. A container recipe is provided in Dockerfile; build from the workspace root so both Python packages and agent sources are present.

```sh
docker build -f hireme_agent/Dockerfile -t hireme-mcp .
docker run --rm -p 8000:8000 --env-file hireme_agent/.env hireme-mcp
```

The env file must contain a nonempty HIREME_MCP_TOKEN and matching allowed hosts/origins. No cloud service is deployed by these local source changes.

The runtime includes Python tzdata so Asia/Seoul also works on minimal container images. Docker CLI is unavailable in this workspace environment, so the image build itself has not been verified; the HTTP server and native MCP execution have been tested locally.

### Tests

```sh
uv run --project hireme_agent python -m unittest discover -s hireme_agent/tests -v
```

Tests start a real TCP HTTP server and MCP clients, run both child agents, and verify routing, source content, prompt rendering, whole-agent outputs, concurrent result separation, authentication, schema failures, runtime deadlines and snapshot binding.
