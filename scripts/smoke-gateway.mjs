import { spawn } from "node:child_process";
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

const gateway = spawn("node", ["server/gateway/index.mjs"], {
  env: {
    ...process.env,
    HIREME_GATEWAY_PORT: String(port),
    HIREME_GATEWAY_API_KEY: gatewayKey,
  },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForGateway(gatewayUrl);

  const directCall = await postJson(`${gatewayUrl}/v1/agent-call`, gatewayKey, {
    agent_id: "codex-builder",
    task: "Create a billing ledger schema",
    budget_calls: 3,
  });

  if (!directCall.gatewayCall || !directCall.runner?.privateHarnessApplied) {
    throw new Error("Gateway direct call did not run through protected runner");
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
    throw new Error("Gateway example agent call did not validate the sealed artifact");
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

  const pluginOutput = await runPluginThroughGateway(gatewayUrl, gatewayKey);
  const responses = pluginOutput
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const callResult = responses.find((response) => response.id === 4);
  const validateResult = responses.find((response) => response.id === 5);
  const naturalResult = responses.find((response) => response.id === 6);
  const text = callResult?.result?.content?.[0]?.text || "";
  const validateText = validateResult?.result?.content?.[0]?.text || "";
  const naturalText = naturalResult?.result?.content?.[0]?.text || "";

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
