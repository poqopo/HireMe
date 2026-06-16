import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { sealAgentFolder } from "../server/gateway/localSealedArtifact.mjs";

const port = 18787;
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = "smoke-test-key";

await sealAgentFolder({
  folderPath: "examples/code-reviewer-agent",
  agentId: "example-code-reviewer",
  pricePerCallUsd: 0.028,
  epochs: 3,
});
await sealAgentFolder({
  folderPath: "examples/landing-page-designer-agent",
  agentId: "example-landing-designer",
  pricePerCallUsd: 0.026,
  epochs: 3,
});
await sealAgentFolder({
  folderPath: "examples/aster-x1-launch-agent",
  agentId: "example-aster-x1-launcher",
  pricePerCallUsd: 0.034,
  epochs: 3,
});

const gateway = spawn("node", ["server/gateway/index.mjs"], {
  env: {
    ...process.env,
    HIREME_GATEWAY_PORT: String(port),
    HIREME_GATEWAY_API_KEY: gatewayKey,
    HIREME_OAUTH_ALLOW_DEMO_LOGIN: "1",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForGateway(gatewayUrl);

  await postJson(`${gatewayUrl}/v1/agents/hire`, gatewayKey, {
    agent_id: "codex-builder",
    hirer_id: "smoke-hirer",
  });

  const myAgents = await postJson(`${gatewayUrl}/v1/my/agents`, gatewayKey, {
    hirer_id: "smoke-hirer",
  });

  if (
    myAgents.hirerId !== "smoke-hirer" ||
    !myAgents.agents?.some((record) => record.agent?.id === "codex-builder")
  ) {
    throw new Error("Gateway my-agents list did not return the hired Agent");
  }

  const directCall = await postJson(`${gatewayUrl}/v1/agent-call`, gatewayKey, {
    agent_id: "codex-builder",
    hirer_id: "smoke-hirer",
    task: "Create a billing ledger schema",
    budget_calls: 3,
  });

  if (!directCall.gatewayCall || !directCall.runner?.privateHarnessApplied) {
    throw new Error("Gateway direct call did not run through protected runner");
  }

  const registeredAgent = await postJson(`${gatewayUrl}/v1/agents/register`, gatewayKey, {
    agent_id: "smoke-mcp-registrar",
    name: "Smoke MCP Registrar",
    creator: "HireMe Smoke",
    category: "Code",
    headline: "Registers a protected Agent through the gateway.",
    public_summary:
      "A smoke-test Agent registration that stores only public metadata and encrypted artifact references.",
    public_mcp_contract: "smoke_register(task)",
    skills: ["Registration", "Gateway smoke", "MCP metadata"],
    protected_asset_classes: ["AGENTS.md", "skills/**", "harness/**"],
    price_per_call_usd: 0.005,
    walrus_blob_id: "walrus_smoke_mcp_registrar_ciphertext",
    sui_object_id: "0x7c0ab0e58ef6d2f0f1340c9fa6b77175aa828d332bd4e30ed87189f0910f0aac",
    ciphertext_digest:
      "sha256:3d9d55d1f90fd5a6e9418636529234deaf27f3b51a962927d0c4f6c62c66e8a8",
  });

  if (
    registeredAgent.status !== "registered" ||
    registeredAgent.publicAgent?.id !== "smoke-mcp-registrar" ||
    registeredAgent.pricing?.display !== "$0.005/call" ||
    registeredAgent.storedPlaintextHarness !== false
  ) {
    throw new Error("Gateway did not register a paid protected Agent");
  }

  const registeredList = await postJson(`${gatewayUrl}/v1/agents/list`, gatewayKey, {
    query: "smoke-mcp-registrar",
  });

  if (!registeredList.hiredAgents?.some((agent) => agent.id === "smoke-mcp-registrar")) {
    throw new Error("Registered Agent was not visible in the gateway registry");
  }

  if (
    directCall.jsonOutput?.schema !== "hireme.protected_agent_json_output.v1" ||
    directCall.jsonOutput?.localCodex?.shouldAct !== true
  ) {
    throw new Error("Gateway direct call did not return local Codex JSON output");
  }

  const exampleCall = await postJson(`${gatewayUrl}/v1/agent-call`, gatewayKey, {
    agent_id: "example-code-reviewer",
    task: "Review a migration diff",
    budget_calls: 1,
    hire_receipt_object_id: "hire_receipt_local_paid_demo",
  });

  if (!exampleCall.sealedValidation?.gatewayOnlyDecrypt) {
    throw new Error("Gateway example agent call did not validate the protected artifact");
  }

  if (
    exampleCall.sealEncryption?.provider !== "platform-managed-envelope" ||
    !exampleCall.sealEncryption?.platformKmsKeyId ||
    !exampleCall.sealEncryption?.packageId ||
    !exampleCall.sealedArtifact?.sealPackageId ||
    exampleCall.jsonOutput?.proof?.walrusStoresCiphertextOnly !== true ||
    exampleCall.jsonOutput?.harness?.artifact?.plaintextInWalrus !== false
  ) {
    throw new Error("Gateway example agent call did not preserve platform encryption metadata");
  }

  if (
    !exampleCall.runner?.gatewayTrustedExecutor ||
    exampleCall.runner?.gatewayCanReadUserInput !== true ||
    exampleCall.runner?.privateFolderReturnedToCodex !== false
  ) {
    throw new Error("Gateway example agent call did not preserve the MVP trusted gateway boundary");
  }

  if (
    exampleCall.jsonOutput?.payload?.type !== "code_review_guidance" ||
    exampleCall.jsonOutput?.harness?.rawHarnessReturned !== false
  ) {
    throw new Error("Gateway example agent call did not return harness-based JSON output");
  }

  const asterCall = await postJson(`${gatewayUrl}/v1/agent-call`, gatewayKey, {
    agent_id: "example-aster-x1-launcher",
    task: "Create an Aster X1 preorder landing page",
    budget_calls: 1,
    hire_receipt_object_id: "hire_receipt_local_paid_demo",
  });

  if (
    asterCall.jsonOutput?.payload?.type !== "aster_x1_preorder_landing" ||
    asterCall.jsonOutput?.payload?.privateReferencesApplied?.productDossier !== true ||
    asterCall.jsonOutput?.payload?.privateReferencesApplied?.launchPlaybook !== true ||
    asterCall.jsonOutput?.payload?.privateReferencesApplied?.visualLayoutHarness !== true ||
    asterCall.jsonOutput?.payload?.mobileLayoutSystem?.stickyPreorderBar?.required !== true ||
    asterCall.runner?.privateFolderReturnedToCodex !== false
  ) {
    throw new Error("Gateway Aster X1 launch agent did not return specialized protected output");
  }

  await postJson(`${gatewayUrl}/v1/agents/hire`, gatewayKey, {
    agent_id: "codex-builder",
    hirer_id: "local-hirer",
  });

  const httpMcpOutput = await runHttpMcpOAuthFlow(gatewayUrl);
  const httpMcpTools = httpMcpOutput.tools?.result?.tools || [];
  const httpMcpMyAgentsText =
    httpMcpOutput.myAgents?.result?.content?.[0]?.text || "";
  const httpMcpCallText =
    httpMcpOutput.callAgent?.result?.content?.[0]?.text || "";
  const httpMcpWhoamiText =
    httpMcpOutput.whoami?.result?.content?.[0]?.text || "";

  if (
    httpMcpOutput.initialize?.result?.serverInfo?.name !== "hireme" ||
    !httpMcpTools.some((tool) => tool.name === "hireme_whoami") ||
    !httpMcpTools.some((tool) => tool.name === "hireme_list_my_agents") ||
    !httpMcpTools.some((tool) => tool.name === "hireme_call_agent")
  ) {
    throw new Error("HTTP MCP OAuth flow did not initialize HireMe tools");
  }

  if (
    !httpMcpWhoamiText.includes('"mode": "oauth_bearer"') ||
    !httpMcpWhoamiText.includes('"hirerId": "local-hirer"') ||
    httpMcpWhoamiText.includes("token_")
  ) {
    throw new Error("HTTP MCP OAuth whoami did not return the connected safe identity");
  }

  if (
    !httpMcpMyAgentsText.includes('"hirerId": "local-hirer"') ||
    !httpMcpMyAgentsText.includes('"id": "codex-builder"')
  ) {
    throw new Error("HTTP MCP OAuth flow did not list the connected user's Agents");
  }

  if (
    !httpMcpCallText.includes('"gatewayCall": true') ||
    !httpMcpCallText.includes('"activeAgentId": "codex-builder"')
  ) {
    throw new Error("HTTP MCP OAuth flow did not call the connected user's Agent");
  }

  const pluginOutput = await runPluginThroughGateway(gatewayUrl, gatewayKey);
  const responses = pluginOutput
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const callResult = responses.find((response) => response.id === 4);
  const validateResult = responses.find((response) => response.id === 5);
  const naturalResult = responses.find((response) => response.id === 6);
  const registerResult = responses.find((response) => response.id === 7);
  const myAgentsResult = responses.find((response) => response.id === 8);
  const whoamiResult = responses.find((response) => response.id === 9);
  const text = callResult?.result?.content?.[0]?.text || "";
  const validateText = validateResult?.result?.content?.[0]?.text || "";
  const naturalText = naturalResult?.result?.content?.[0]?.text || "";
  const registerText = registerResult?.result?.content?.[0]?.text || "";
  const myAgentsText = myAgentsResult?.result?.content?.[0]?.text || "";
  const whoamiText = whoamiResult?.result?.content?.[0]?.text || "";

  if (!text.includes('"gatewayCall": true')) {
    throw new Error("Plugin MCP call did not route through the gateway");
  }

  if (!text.includes('"schema": "hireme.protected_agent_json_output.v1"')) {
    throw new Error("Plugin MCP call did not return the protected JSON output schema");
  }

  if (!text.includes('"privateFolderReturnedToCodex": false')) {
    throw new Error("Gateway response did not preserve private folder boundary");
  }

  if (!validateText.includes('"gatewayOnlyDecrypt": true')) {
    throw new Error("Plugin MCP sealed validation did not route through the gateway");
  }

  if (
    !naturalText.includes('"inferredAgentId": "example-landing-designer"') ||
    !naturalText.includes('"type": "landing_page_brief"') ||
    !naturalText.includes('"shouldAct": true')
  ) {
    throw new Error("Plugin MCP natural request did not route to the landing designer");
  }

  if (!naturalText.includes('"walrusStoresCiphertextOnly": true')) {
    throw new Error("Plugin MCP protected request did not expose ciphertext proof metadata");
  }

  if (
    !registerText.includes('"status": "registered"') ||
    !registerText.includes('"id": "smoke-plugin-registrar"') ||
    !registerText.includes('"display": "$0.005/call"')
  ) {
    throw new Error("Plugin MCP register Agent call did not route through the gateway");
  }

  if (
    !myAgentsText.includes('"hirerId": "local-hirer"') ||
    !myAgentsText.includes('"id": "codex-builder"')
  ) {
    throw new Error("Plugin MCP my-agents call did not route through the gateway");
  }

  if (
    !whoamiText.includes('"gatewayCall": true') ||
    !whoamiText.includes('"hirerId": "local-hirer"') ||
    !whoamiText.includes('"apiKeyReturned": false')
  ) {
    throw new Error("Plugin MCP whoami did not route through the gateway safely");
  }

  console.log("HireMe gateway smoke test passed.");
} finally {
  gateway.kill("SIGTERM");
  await once(gateway, "exit").catch(() => {});
}

async function waitForGateway(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Gateway did not become ready");
}

async function postJson(url, key, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gateway request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function runHttpMcpOAuthFlow(gatewayUrl) {
  const authMetadata = await getJson(
    `${gatewayUrl}/.well-known/oauth-authorization-server`,
  );
  const resourceMetadata = await getJson(
    `${gatewayUrl}/.well-known/oauth-protected-resource/mcp`,
  );
  if (
    authMetadata.authorization_endpoint !== `${gatewayUrl}/oauth/authorize` ||
    resourceMetadata.resource !== `${gatewayUrl}/mcp`
  ) {
    throw new Error("OAuth discovery metadata did not advertise the HTTP MCP endpoint");
  }

  const unauthorized = await fetch(`${gatewayUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
  });
  if (
    unauthorized.status !== 401 ||
    !unauthorized.headers.get("www-authenticate")?.includes("oauth-protected-resource")
  ) {
    throw new Error("HTTP MCP endpoint did not require OAuth bearer auth");
  }

  const redirectUri = `${gatewayUrl}/oauth/smoke/callback`;
  const registeredClient = await postJsonNoAuth(`${gatewayUrl}/oauth/register`, {
    client_name: "HireMe Gateway Smoke Codex",
    redirect_uris: [redirectUri],
  });
  const codeVerifier = "hireme-smoke-code-verifier";
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const authParams = new URLSearchParams({
    response_type: "code",
    client_id: registeredClient.client_id,
    redirect_uri: redirectUri,
    scope: "hireme:agents hireme:call hireme:manage",
    state: "smoke-state",
    resource: `${gatewayUrl}/mcp`,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authorizePage = await fetch(`${gatewayUrl}/oauth/authorize?${authParams}`);
  if (!authorizePage.ok || !(await authorizePage.text()).includes("Connect HireMe to Codex")) {
    throw new Error("OAuth authorize page did not render the Codex consent screen");
  }

  const approveResponse = await fetch(`${gatewayUrl}/oauth/approve`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: registeredClient.client_id,
      redirect_uri: redirectUri,
      scope: "hireme:agents hireme:call hireme:manage",
      state: "smoke-state",
      resource: `${gatewayUrl}/mcp`,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      email: "local-hirer",
    }),
  });
  const callbackLocation = approveResponse.headers.get("location");
  if (approveResponse.status !== 302 || !callbackLocation) {
    throw new Error("OAuth approval did not redirect with an authorization code");
  }
  const callbackUrl = new URL(callbackLocation);
  const code = callbackUrl.searchParams.get("code");
  if (!code || callbackUrl.searchParams.get("state") !== "smoke-state") {
    throw new Error("OAuth approval callback did not include code and state");
  }

  const token = await postForm(`${gatewayUrl}/oauth/token`, {
    grant_type: "authorization_code",
    code,
    client_id: registeredClient.client_id,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  if (!token.access_token || token.token_type !== "Bearer") {
    throw new Error("OAuth token endpoint did not issue a bearer token");
  }

  return {
    initialize: await postMcp(gatewayUrl, token.access_token, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "hireme-smoke", version: "0.1.0" },
      },
    }),
    tools: await postMcp(gatewayUrl, token.access_token, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
    myAgents: await postMcp(gatewayUrl, token.access_token, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "hireme_list_my_agents",
        arguments: {},
      },
    }),
    whoami: await postMcp(gatewayUrl, token.access_token, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "hireme_whoami",
        arguments: {},
      },
    }),
    callAgent: await postMcp(gatewayUrl, token.access_token, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "hireme_call_agent",
        arguments: {
          agent_id: "codex-builder",
          task: "Create a billing ledger schema through HTTP MCP",
        },
      },
    }),
  };
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function postJsonNoAuth(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function postMcp(gatewayUrl, accessToken, message) {
  const response = await fetch(`${gatewayUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`HTTP MCP call failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function runPluginThroughGateway(gatewayUrl, gatewayKey) {
  const child = spawn("node", ["plugins/hireme/mcp/server.mjs"], {
    env: {
      ...process.env,
      HIREME_MCP_GATEWAY_URL: gatewayUrl,
      HIREME_GATEWAY_API_KEY: gatewayKey,
      HIREME_MCP_GATEWAY_REQUIRED: "1",
    },
    stdio: ["pipe", "pipe", "inherit"],
  });

  const requests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "hireme-gateway-smoke", version: "0.1.0" },
      },
    },
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "hireme_select_agent",
        arguments: { agent_id: "codex-builder" },
      },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "hireme_call_agent",
        arguments: {
          agent_id: "codex-builder",
          hirer_id: "local-hirer",
          task: "Create a billing ledger schema",
          budget_calls: 3,
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "hireme_validate_sealed_harness",
        arguments: {
          hire_receipt_object_id: "hire_receipt_local_paid_demo",
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "hireme_request",
        arguments: {
          request:
            "example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해",
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "hireme_register_agent",
        arguments: {
          agent_id: "smoke-plugin-registrar",
          name: "Smoke Plugin Registrar",
          creator: "HireMe Smoke",
          category: "Code",
          headline: "Registers a protected Agent from MCP.",
          public_summary:
            "A plugin smoke-test Agent registration that stores only public metadata and encrypted artifact references.",
          public_mcp_contract: "smoke_plugin_register(task)",
          skills: ["Registration", "Plugin smoke", "MCP metadata"],
          protected_asset_classes: ["AGENTS.md", "skills/**", "harness/**"],
          price_per_call_usd: 0.005,
          walrus_blob_id: "walrus_smoke_plugin_registrar_ciphertext",
          sui_object_id:
            "0xa2bd50242720676b86c4394109ad19cccf42d17eea7b2a765d0d281d732d74d4",
          ciphertext_digest:
            "sha256:d5cfe0ad2925e5779501738c799b53d018dd73c79024743dd7b05d2783efc039",
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "hireme_list_my_agents",
        arguments: {
          hirer_id: "local-hirer",
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "hireme_whoami",
        arguments: {
          hirer_id: "local-hirer",
        },
      },
    },
  ];

  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  for (const request of requests) {
    child.stdin.write(`${JSON.stringify(request)}\n`);
  }
  child.stdin.end();

  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`MCP server exited with code ${exitCode}`);
  }

  return stdout;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
