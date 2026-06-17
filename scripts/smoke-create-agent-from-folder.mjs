import { spawn } from "node:child_process";
import { once } from "node:events";

const port = Number.parseInt(process.env.HIREME_CREATE_FOLDER_SMOKE_PORT || "19790", 10);
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = process.env.HIREME_GATEWAY_API_KEY || "create-folder-smoke-key";
const agentId = `folder-create-smoke-${Date.now().toString(36)}`;

const gateway = spawn("node", ["apps/gateway/src/index.mjs"], {
  env: {
    ...process.env,
    HIREME_GATEWAY_PORT: String(port),
    HIREME_GATEWAY_API_KEY: gatewayKey,
    HIREME_ALLOW_LOCAL_WALRUS_FALLBACK: "1",
    HIREME_WALRUS_REQUIRED: "0",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForGateway(gatewayUrl);

  const createResult = await postJson(`${gatewayUrl}/v1/agents/create-from-folder`, {
    folder_path: "examples/minimal-agent",
    agent_id: agentId,
    name: "Folder Create Smoke",
    creator: "Smoke Test",
    category: "Code",
    headline: "Creates a protected Agent from a local folder.",
    public_summary:
      "Temporary smoke-test Agent created by archiving a local folder through the MCP-compatible gateway path.",
    public_mcp_contract: "folder_create_smoke(task)",
    skills: ["Folder archive", "Platform encryption", "Walrus upload"],
    protected_asset_classes: ["AGENTS.md", "skills/**", "harness/**"],
    price_per_1m_tokens_sui: 5,
  });

  if (createResult.status !== "registered") {
    throw new Error(`Expected registered status, got ${createResult.status || "unknown"}`);
  }
  if (createResult.upload?.containsAgentsMd !== true) {
    throw new Error("Folder create upload did not contain AGENTS.md");
  }
  if (createResult.protectedArtifact?.encryptionProvider !== "platform_encryption") {
    throw new Error("Folder create did not use platform_encryption");
  }
  if (createResult.storedPlaintextHarness !== false) {
    throw new Error("Folder create response should not expose plaintext Harness");
  }

  console.log("Create Agent from folder smoke passed");
} finally {
  gateway.kill("SIGTERM");
  await once(gateway, "exit").catch(() => {});
}

async function waitForGateway(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Retry while the child process starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Gateway did not start at ${url}`);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${gatewayKey}`,
      "x-hireme-gateway-key": gatewayKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
