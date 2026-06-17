import { spawn } from "node:child_process";
import { once } from "node:events";

const port = 18788;
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = "sui-payment-smoke-key";
const treasuryAddress = `0x${"1".repeat(64)}`;
const hirerAddress = `0x${"2".repeat(64)}`;
const fakeTxDigest = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmno";

const gateway = spawn("node", ["apps/gateway/src/index.mjs"], {
  env: {
    ...process.env,
    HIREME_GATEWAY_PORT: String(port),
    HIREME_GATEWAY_API_KEY: gatewayKey,
    HIREME_OAUTH_ALLOW_DEMO_LOGIN: "1",
    HIREME_PLATFORM_TREASURY_SUI_ADDRESS: treasuryAddress,
    HIREME_DEFAULT_HIRE_PRICE_SUI: "0.05",
    HIREME_SUI_PAYMENT_VERIFICATION_MODE: "mock_success",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForGateway(gatewayUrl);

  const intent = await postJson(`${gatewayUrl}/v1/payments/sui/intent`, gatewayKey, {
    agent_id: "codex-builder",
    hirer_id: "sui-smoke-hirer",
    wallet_address: hirerAddress,
  });

  if (
    intent.status !== "requires_payment" ||
    intent.intent?.amountMist !== "50000000" ||
    intent.transaction?.recipientAddress !== treasuryAddress
  ) {
    throw new Error("SUI payment intent did not return expected transfer details");
  }

  const confirmed = await postJson(`${gatewayUrl}/v1/payments/sui/confirm`, gatewayKey, {
    intent_id: intent.intent.intentId,
    tx_digest: fakeTxDigest,
    hirer_id: "sui-smoke-hirer",
    wallet_address: hirerAddress,
  });

  if (
    confirmed.status !== "confirmed" ||
    confirmed.access?.accessType !== "hired" ||
    confirmed.access?.paymentTxDigest !== fakeTxDigest ||
    confirmed.verification?.status !== "verified" ||
    confirmed.verification?.verificationMode !== "mock_success" ||
    confirmed.settlement?.status !== "settled"
  ) {
    throw new Error("SUI payment confirmation did not activate hire access and settlement");
  }

  const summary = await postJson(`${gatewayUrl}/v1/settlements/sui/summary`, gatewayKey, {
    agent_id: "codex-builder",
  });

  if (
    summary.totals?.creatorAmountMist !== "50000000" ||
    !summary.events?.some((event) => event.txDigest === fakeTxDigest)
  ) {
    throw new Error("SUI settlement summary did not include the confirmed payment");
  }

  console.log("SUI payment smoke passed");
} finally {
  gateway.kill("SIGTERM");
  await once(gateway, "exit").catch(() => {});
}

async function waitForGateway(url) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Retry until the child process starts listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Gateway did not start in time");
}

async function postJson(url, key, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "x-hireme-gateway-key": key,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
