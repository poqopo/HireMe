import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { sealAgentFolder } from "../apps/gateway/src/localSealedArtifact.mjs";

const port = 18788;
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = "protected-artifact-smoke-key";

const sealed = await sealAgentFolder({
  folderPath: "examples/code-reviewer-agent",
  agentId: "example-code-reviewer",
  pricePerCallUsd: 28,
  epochs: 3,
});
const walrusCiphertext = await readFile(sealed.walrusPath, "utf8");

if (!walrusCiphertext.includes('"format": "hireme.platform_encryption.v1"')) {
  throw new Error("Protected Walrus object did not use the platform ciphertext envelope");
}
if (
  walrusCiphertext.includes("Private Operating Notes") ||
  walrusCiphertext.includes("Hidden Scoring Criteria") ||
  walrusCiphertext.includes("AGENTS.md")
) {
  throw new Error("Protected Walrus object leaked protected plaintext");
}

const gateway = spawn("node", ["apps/gateway/src/index.mjs"], {
  env: {
    ...process.env,
    HIREME_GATEWAY_PORT: String(port),
    HIREME_GATEWAY_API_KEY: gatewayKey,
  },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForGateway(gatewayUrl);

  const valid = await postJson(`${gatewayUrl}/v1/sealed-harness/validate`, {
    record_path: sealed.recordPath,
    hire_receipt_object_id: "hire_receipt_local_paid_demo",
  });

  const serialized = JSON.stringify(valid);
  if (!valid.gatewayOnlyDecrypt || !valid.runner?.decryptedInRunnerOnly) {
    throw new Error("Gateway did not validate through the protected runner boundary");
  }
  if (
    valid.sealEncryption?.provider !== "platform_encryption" ||
    !valid.sealEncryption?.platformKmsKeyId ||
    valid.sealEncryption?.ciphertextFormat !== "hireme.platform_encryption.v1" ||
    valid.sealEncryption?.plaintextInWalrus !== false
  ) {
    throw new Error("Gateway validation did not report platform-managed encryption metadata");
  }
  if (valid.runner.privateFolderReturnedToHirer !== false) {
    throw new Error("Gateway response claims the private folder was returned");
  }
  if (
    serialized.includes("Private Operating Notes") ||
    serialized.includes("Hidden Scoring Criteria") ||
    serialized.includes("contentBase64")
  ) {
    throw new Error("Gateway validation leaked protected folder plaintext");
  }

  const invalid = await postJson(
    `${gatewayUrl}/v1/sealed-harness/validate`,
    {
      record_path: sealed.recordPath,
      hire_receipt_object_id: "unpaid",
    },
    { expectOk: false },
  );

  if (invalid.status !== 400 || !invalid.body.includes("paid hire receipt")) {
    throw new Error("Gateway did not reject validation without a paid receipt");
  }

  console.log("HireMe protected artifact smoke test passed.");
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

async function postJson(url, body, options = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${gatewayKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (options.expectOk === false) {
    return { status: response.status, body: text };
  }

  if (!response.ok) {
    throw new Error(`Gateway request failed: ${response.status} ${text}`);
  }

  return JSON.parse(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
