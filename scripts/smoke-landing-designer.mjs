import { spawn } from "node:child_process";
import { once } from "node:events";
import { sealAgentFolder } from "../server/gateway/localSealedArtifact.mjs";

const port = 19879;
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = "landing-designer-smoke-key";

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

  const call = await postJson(`${gatewayUrl}/v1/agent-call`, {
    agent_id: "example-landing-designer",
    task: "Create an example landing page for a usage-based AI billing product.",
    budget_calls: 1,
    hire_receipt_object_id: "hire_receipt_local_paid_demo",
  });

  const serialized = JSON.stringify(call);
  if (call.result?.type !== "landing_page_brief") {
    throw new Error("Landing designer did not return a landing page brief");
  }
  if (!call.result?.privateReferencesApplied?.designMd) {
    throw new Error("Landing designer did not apply the sealed design.md reference");
  }
  if (
    call.jsonOutput?.schema !== "hireme.protected_agent_json_output.v1" ||
    call.jsonOutput?.payload?.type !== "landing_page_brief" ||
    call.jsonOutput?.localCodex?.shouldAct !== true
  ) {
    throw new Error("Landing designer did not return local Codex JSON output");
  }
  if (!call.sealedValidation?.gatewayOnlyDecrypt) {
    throw new Error("Landing designer did not validate through gateway-only decrypt");
  }
  if (
    serialized.includes("## Overview") ||
    serialized.includes("Full private design guide") ||
    serialized.includes("contentBase64")
  ) {
    throw new Error("Landing designer leaked protected design guide content");
  }

  console.log("HireMe landing designer smoke test passed.");
} finally {
  gateway.kill("SIGTERM");
  await once(gateway, "exit").catch(() => {});
}

async function waitForGateway(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.service === "hireme-gateway") return;
      }
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Gateway did not become ready");
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${gatewayKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gateway request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
