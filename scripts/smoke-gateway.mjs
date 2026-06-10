import { spawn } from "node:child_process";
import { once } from "node:events";

const port = 18787;
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = "smoke-test-key";

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

  const pluginOutput = await runPluginThroughGateway(gatewayUrl, gatewayKey);
  const responses = pluginOutput
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const callResult = responses.find((response) => response.id === 4);
  const text = callResult?.result?.content?.[0]?.text || "";

  if (!text.includes('"gatewayCall": true')) {
    throw new Error("Plugin MCP call did not route through the gateway");
  }

  if (!text.includes('"privateFolderReturnedToCodex": false')) {
    throw new Error("Gateway response did not preserve private folder boundary");
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
