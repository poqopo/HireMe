import { createHash, createHmac, randomBytes } from "node:crypto";
import { runSealedArtifactTask } from "./localSealedArtifact.mjs";

const localAttestationFormat = "hireme.local-tee-attestation.v1";
const runnerProtocol = "hireme.attested-runner.v1";
const defaultRunnerId = "hireme-local-tee-runner";
const defaultRunnerImage = "hireme-attested-runner:v1";
const defaultRunnerIdentity = "hireme-local-protected-runner";

export function createLocalAttestationQuote({
  agentId,
  taskDigest,
  runnerId = process.env.HIREME_TEE_RUNNER_ID || defaultRunnerId,
} = {}) {
  const measurement = approvedMeasurement();
  const nonce = randomBytes(16).toString("hex");

  return {
    format: localAttestationFormat,
    mode: "local-mock",
    teeType: process.env.HIREME_TEE_TYPE || "mock-tee",
    runnerId,
    runnerImage: defaultRunnerImage,
    measurement,
    nonce,
    agentId: agentId || null,
    taskDigest: taskDigest || null,
    issuedAt: new Date().toISOString(),
    note:
      "Local mock quote. Production replaces this with Nitro/TDX/SGX remote attestation evidence.",
  };
}

export async function runAttestedAgentTask({
  agentId,
  task = "",
  recordPath,
  walrusPath,
  hireReceiptObjectId,
  attestationQuote,
  runnerId,
  runnerIdentity = process.env.HIREME_GATEWAY_RUNNER_ID || defaultRunnerIdentity,
}) {
  const taskDigest = `sha256:${sha256Hex(task)}`;
  const quote =
    attestationQuote ||
    createLocalAttestationQuote({
      agentId,
      taskDigest,
      runnerId,
    });
  const attestation = verifyAttestationQuote({
    quote,
    expectedAgentId: agentId,
    expectedTaskDigest: taskDigest,
  });

  const sealedTask = await runSealedArtifactTask({
    recordPath,
    walrusPath,
    hireReceiptObjectId,
    runnerIdentity,
    task,
  });
  const agentResult = sealedTask.result;
  const responseDigest = `sha256:${sha256Hex(JSON.stringify(agentResult))}`;
  const runnerSignature = signRunnerResult({
    agentId,
    taskDigest,
    responseDigest,
    quoteDigest: attestation.quoteDigest,
    hireReceiptObjectId,
  });

  const jsonOutput = {
    schema: "hireme.attested_agent_json_output.v1",
    protocol: runnerProtocol,
    status: "completed",
    agentId,
    taskDigest,
    internalLlmCalled: false,
    agentResult,
    proof: {
      responseDigest,
      runnerSignature,
      signedFields: [
        "agentId",
        "taskDigest",
        "responseDigest",
        "quoteDigest",
        "hireReceiptObjectId",
      ],
    },
  };

  return {
    gatewayCall: true,
    protocol: runnerProtocol,
    status: "completed",
    agentId,
    attestation,
    authorization: {
      hireReceiptVerified: true,
      sealPolicyApproved: true,
      attestedRunnerApproved: true,
      mode: "local-tee-attestation-mock",
    },
    runner: {
      id: attestation.runnerId,
      executionMode: "attested-tee-runner-local-mock",
      teeRequired: true,
      attestationVerified: attestation.verified,
      decryptedInside: "simulated-enclave",
      gatewayPlaintextAccess: false,
      hirerPlaintextAccess: false,
      creatorSecretsReturned: false,
      internalLlmCalled: false,
    },
    sealedValidation: sealedTask.validation,
    agentResult,
    jsonOutput,
    result: jsonOutput,
    privacy: {
      platformCanSeePlaintext: false,
      hirerCanSeePlaintext: false,
      plaintextLeavesRunner: false,
      localMockLimitation:
        "This local process simulates the TEE trust boundary. Production must enforce it with hardware attestation and Seal key-release policy.",
    },
  };
}

export function verifyAttestationQuote({
  quote,
  expectedAgentId,
  expectedTaskDigest,
} = {}) {
  if (!quote || typeof quote !== "object") {
    throw userError("Missing TEE attestation quote");
  }
  if (quote.format !== localAttestationFormat) {
    throw userError(`Unsupported attestation format: ${quote.format}`);
  }
  if (quote.measurement !== approvedMeasurement()) {
    throw userError("TEE runner measurement is not approved");
  }
  if (expectedAgentId && quote.agentId && quote.agentId !== expectedAgentId) {
    throw userError("TEE quote agent id mismatch");
  }
  if (
    expectedTaskDigest &&
    quote.taskDigest &&
    quote.taskDigest !== expectedTaskDigest
  ) {
    throw userError("TEE quote task digest mismatch");
  }

  return {
    verified: true,
    mode: quote.mode,
    teeType: quote.teeType,
    runnerId: quote.runnerId,
    runnerImage: quote.runnerImage,
    measurement: quote.measurement,
    approvedMeasurement: approvedMeasurement(),
    quoteDigest: `sha256:${sha256Hex(JSON.stringify(quote))}`,
    productionVerifier:
      "Replace local measurement matching with Nitro/TDX/SGX quote verification before releasing Seal key shares.",
  };
}

function approvedMeasurement() {
  return (
    process.env.HIREME_TEE_APPROVED_MEASUREMENT ||
    `sha256:${sha256Hex(defaultRunnerImage)}`
  );
}

function signRunnerResult(payload) {
  const key = process.env.HIREME_TEE_RUNNER_SIGNING_KEY || "local-tee-runner-dev-key";
  return `hmac-sha256:${createHmac("sha256", key)
    .update(JSON.stringify(payload))
    .digest("hex")}`;
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function userError(message) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: "bad_request",
  });
}
