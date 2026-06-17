import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const port = Number.parseInt(process.env.HIREME_PLATFORM_SMOKE_PORT || "19789", 10);
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = process.env.HIREME_GATEWAY_API_KEY || "platform-encryption-smoke-key";
const allowLocalFallback = /^(1|true|yes)$/i.test(
  process.env.HIREME_ALLOW_LOCAL_WALRUS_FALLBACK || "",
);
const agentId = `platform-walrus-smoke-${Date.now().toString(36)}`;

const gateway = spawn("node", ["apps/gateway/src/index.mjs"], {
  env: {
    ...process.env,
    HIREME_GATEWAY_PORT: String(port),
    HIREME_GATEWAY_API_KEY: gatewayKey,
    HIREME_WALRUS_REQUIRED: allowLocalFallback ? "0" : "1",
    HIREME_ALLOW_LOCAL_DEMO_RECEIPT: "1",
  },
  stdio: ["ignore", "pipe", "inherit"],
});
gateway.stdout.on("data", (chunk) => {
  if (/^(1|true|yes)$/i.test(process.env.HIREME_PLATFORM_SMOKE_DEBUG || "")) {
    process.stderr.write(chunk);
  }
});

try {
  await waitForGateway(gatewayUrl);

  const archiveBytes = await readFile("examples/minimal-agent.tar.gz");
  const metadata = {
    agent_id: agentId,
    name: "Platform Walrus Smoke",
    creator: "Smoke Test",
    category: "Code",
    headline: "Verifies platform_encryption.v1 Walrus storage and call-time decrypt.",
    public_summary:
      "Temporary smoke-test Agent for encrypted Walrus artifact registration.",
    public_mcp_contract: "platform_walrus_smoke(task)",
    skills: ["Platform encryption", "Walrus storage", "Gateway decrypt"],
    price_per_1m_tokens_sui: 5,
  };
  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  form.append(
    "harness",
    new Blob([archiveBytes], { type: "application/gzip" }),
    "minimal-agent.tar.gz",
  );

  const createResult = await postMultipart(`${gatewayUrl}/v1/agents/create`, form);
  const storageProvider = createResult.upload?.storageProvider;
  if (!allowLocalFallback && storageProvider !== "walrus") {
    throw new Error(`Expected real Walrus storage, got ${storageProvider || "unknown"}`);
  }
  if (createResult.protectedArtifact?.encryptionProvider !== "platform_encryption") {
    throw new Error("Created artifact did not use platform_encryption provider");
  }
  if (createResult.protectedArtifact?.ciphertextFormat !== "hireme.platform_encryption.v1") {
    throw new Error("Created artifact did not use hireme.platform_encryption.v1 format");
  }

  const callResult = await postJson(`${gatewayUrl}/v1/agent-call`, {
    agent_id: agentId,
    task: "Verify the protected Harness is loaded and return safe guidance only.",
    hire_receipt_object_id: "hire_receipt_local_paid_demo",
  });
  if (callResult.authorization?.mode !== "trusted-gateway-protected-artifact") {
    throw new Error("Agent call did not use the protected artifact execution path");
  }
  if (callResult.platformEncryption?.gatewayDecryptedAtCallTime !== true) {
    throw new Error("Agent call did not decrypt platform artifact at call time");
  }
  if (callResult.platformValidation?.rawAgentsMdReturned !== false) {
    throw new Error("Agent call returned raw AGENTS.md");
  }

  console.log(JSON.stringify({
    status: "ok",
    agentId,
    storageProvider,
    walrusBlobId: createResult.protectedArtifact?.walrusBlobId,
    ciphertextFormat: callResult.platformEncryption?.ciphertextFormat,
    gatewayDecryptedAtCallTime:
      callResult.platformEncryption?.gatewayDecryptedAtCallTime,
    rawAgentsMdReturned: callResult.platformValidation?.rawAgentsMdReturned,
  }, null, 2));
} finally {
  await stopGateway();
}

async function stopGateway() {
  if (gateway.exitCode !== null || gateway.signalCode !== null) return;
  gateway.kill("SIGINT");
  const exited = await Promise.race([
    once(gateway, "exit"),
    sleep(3000).then(() => false),
  ]);
  if (exited !== false) return;
  if (gateway.exitCode === null && gateway.signalCode === null) {
    gateway.kill("SIGTERM");
    await Promise.race([once(gateway, "exit"), sleep(2000)]);
  }
}

async function waitForGateway(url) {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await sleep(250);
  }
  throw new Error(`Gateway did not start at ${url}`);
}

async function postMultipart(url, form) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-hireme-gateway-key": gatewayKey,
    },
    body: form,
  });
  return readJsonResponse(response);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hireme-gateway-key": gatewayKey,
    },
    body: JSON.stringify(body),
  });
  return readJsonResponse(response);
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}
