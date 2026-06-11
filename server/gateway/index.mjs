#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runSealedArtifactTask,
  validateSealedArtifact,
} from "./localSealedArtifact.mjs";
import { readWalrusAgentArtifact } from "./walrusAgentArtifact.mjs";

loadEnvFile(".env");
loadEnvFile(".env.local");

const port = Number.parseInt(process.env.HIREME_GATEWAY_PORT || "8787", 10);
const apiKey = process.env.HIREME_GATEWAY_API_KEY || "";
const defaultInstallationId =
  process.env.HIREME_CODEX_INSTALLATION_ID || "local-codex";

const agents = [
  {
    id: "walrus-researcher",
    name: "Walrus Researcher",
    handle: "@memwal/researcher",
    creator: "Han Labs",
    category: "Research",
    status: "Available",
    headline: "Finds protocol evidence, cites sources, and keeps private notes sealed.",
    publicSummary:
      "A research agent for Sui, Walrus, and storage-market analysis. It exposes source-backed briefs while keeping private heuristics and scoring prompts protected.",
    publicContract: "research_brief(input, citation_policy, max_sources)",
    memwalPolicy: "Protected notes, source ranking weights, and scoring rubric",
    skills: ["Protocol research", "Citation audit", "Market mapping"],
    hiddenAssetClasses: ["AGENTS.md", "skills/**", "ranking prompt", "source scoring harness"],
    pricePerCallUsd: 0.018,
    freeCalls: 25,
    rating: 4.9,
    calls: 18420,
    latencyMs: 920,
  },
  {
    id: "codex-builder",
    name: "Codex Builder",
    handle: "@agents/codex-builder",
    creator: "Build Guild",
    category: "Code",
    status: "Available",
    headline: "Turns product specs into scoped PR-ready React and Supabase changes.",
    publicSummary:
      "A coding agent tuned for Vite, shadcn/ui, Supabase schemas, and MCP integrations. Buyers see the output, not the hidden harness.",
    publicContract: "repo_task(input, repo_context, budget_calls)",
    memwalPolicy: "Protected implementation recipes and repo-specific playbooks",
    skills: ["React Vite", "Supabase", "MCP scaffolding"],
    hiddenAssetClasses: ["AGENTS.md", "skills/**", "patch templates", "review heuristics"],
    pricePerCallUsd: 0.032,
    freeCalls: 10,
    rating: 4.8,
    calls: 12290,
    latencyMs: 1100,
  },
  {
    id: "agent-evaluator",
    name: "Agent Evaluator",
    handle: "@evals/sentinel",
    creator: "Eval Works",
    category: "Security",
    status: "Private Beta",
    headline: "Runs red-team evals against hired agents before production use.",
    publicSummary:
      "A safety evaluator that stress-tests tools, output policies, and leakage boundaries before an Agent is added to a production MCP client.",
    publicContract: "run_eval(target_agent, eval_scope, severity_floor)",
    memwalPolicy: "Protected attack prompts, scoring thresholds, and audit traces",
    skills: ["Prompt leakage", "Tool abuse", "Policy checks"],
    hiddenAssetClasses: ["AGENTS.md", "skills/**", "red-team set", "grader rubric"],
    pricePerCallUsd: 0.041,
    freeCalls: 5,
    rating: 4.7,
    calls: 8740,
    latencyMs: 1280,
  },
  {
    id: "data-ledger",
    name: "Data Ledger",
    handle: "@metrics/data-ledger",
    creator: "Metric House",
    category: "Data",
    status: "Available",
    headline: "Builds usage ledgers, billing events, and creator payout exports.",
    publicSummary:
      "A data agent for call metering, pricing tiers, ledger normalization, and payout-ready analytics.",
    publicContract: "ledger_export(date_range, payout_policy, anomaly_mode)",
    memwalPolicy: "Protected pricing heuristics and fraud scoring rules",
    skills: ["Usage ledger", "Pricing tiers", "Payout analytics"],
    hiddenAssetClasses: ["AGENTS.md", "skills/**", "fraud rules", "tier optimizer"],
    pricePerCallUsd: 0.015,
    freeCalls: 50,
    rating: 4.6,
    calls: 20450,
    latencyMs: 760,
  },
  {
    id: "launch-operator",
    name: "Launch Operator",
    handle: "@growth/launch-operator",
    creator: "Go To Market AI",
    category: "Growth",
    status: "Busy",
    headline: "Drafts launch assets from private positioning memory and public docs.",
    publicSummary:
      "A growth agent that turns docs, changelogs, and market notes into release plans without leaking the creator's positioning library.",
    publicContract: "launch_plan(product_context, channel_set, output_format)",
    memwalPolicy: "Protected positioning library and channel performance memory",
    skills: ["Launch copy", "Channel plan", "Audience mapping"],
    hiddenAssetClasses: ["AGENTS.md", "skills/**", "positioning vault", "channel memory"],
    pricePerCallUsd: 0.022,
    freeCalls: 20,
    rating: 4.5,
    calls: 9390,
    latencyMs: 880,
  },
  {
    id: "ops-router",
    name: "Ops Router",
    handle: "@ops/router",
    creator: "Backoffice Labs",
    category: "Ops",
    status: "Available",
    headline: "Routes operational requests to the right tools with spend limits.",
    publicSummary:
      "An operations agent that coordinates MCP tools, budget limits, and approval gates for repetitive backoffice workflows.",
    publicContract: "route_operation(ticket, allowed_tools, spend_limit)",
    memwalPolicy: "Protected routing rules and customer-specific operation memory",
    skills: ["Tool routing", "Approvals", "Spend control"],
    hiddenAssetClasses: ["AGENTS.md", "skills/**", "routing graph", "approval matrix"],
    pricePerCallUsd: 0.012,
    freeCalls: 100,
    rating: 4.7,
    calls: 31700,
    latencyMs: 690,
  },
  {
    id: "example-code-reviewer",
    name: "Example Code Reviewer",
    handle: "@examples/code-reviewer",
    creator: "HireMe Examples",
    category: "Code",
    status: "Available",
    headline: "Reviews pull requests through a sealed private rubric.",
    publicSummary:
      "A demo agent for validating the HireMe protected runner flow. Buyers see review findings, not the creator folder.",
    publicContract: "review_pull_request(diff, repo_context, risk_level)",
    memwalPolicy:
      "Example AGENTS.md, private risk checklist, and harness policy decrypt only inside the gateway runner.",
    skills: ["Code review", "Risk triage", "Test planning"],
    hiddenAssetClasses: ["AGENTS.md", "skills/**", "harness/**", "private rubric"],
    pricePerCallUsd: 0.028,
    freeCalls: 3,
    rating: 4.8,
    calls: 12,
    latencyMs: 840,
  },
  {
    id: "example-landing-designer",
    name: "Example Landing Designer",
    handle: "@examples/landing-designer",
    creator: "HireMe Examples",
    category: "Growth",
    status: "Available",
    headline: "Creates landing page briefs from a sealed design system guide.",
    publicSummary:
      "A demo agent that uses protected AGENTS.md and design.md instructions to produce safe landing page implementation guidance.",
    publicContract:
      "create_landing_page_brief(product_context, target_audience, conversion_goal)",
    memwalPolicy:
      "Private AGENTS.md and design.md decrypt only inside the gateway runner.",
    skills: ["Landing pages", "Design systems", "Conversion copy"],
    hiddenAssetClasses: ["AGENTS.md", "design.md", "skills/**", "harness/**"],
    pricePerCallUsd: 0.026,
    freeCalls: 5,
    rating: 4.9,
    calls: 8,
    latencyMs: 790,
  },
  {
    id: "wal-test1",
    name: "Walrus Test One",
    handle: "@examples/wal-test1",
    creator: "HireMe Examples",
    category: "Research",
    status: "Available",
    headline: "Reads an Agent folder from a real Walrus blob through the gateway.",
    publicSummary:
      "A plaintext storage-path demo that proves a creator folder can be bundled, uploaded to Walrus, registered in Supabase, and inspected by the MCP gateway.",
    publicContract: "inspect_walrus_agent_folder(blob_id, task)",
    memwalPolicy:
      "Plaintext Walrus test only. Production protected agents should store Seal ciphertext and decrypt only inside the gateway runner.",
    skills: ["Walrus read", "Supabase registry", "Folder manifest inspection"],
    hiddenAssetClasses: ["AGENTS.md"],
    pricePerCallUsd: 0.001,
    freeCalls: 100,
    rating: 5.0,
    calls: 1,
    latencyMs: 1600,
  },
];

const protectedArtifacts = new Map();
const sessions = new Map([[defaultInstallationId, "walrus-researcher"]]);
const ledger = [];
const localSealedExampleRecords = {
  "example-code-reviewer":
    ".hireme/artifacts/example-code-reviewer.public-record.json",
  "example-landing-designer":
    ".hireme/artifacts/example-landing-designer.public-record.json",
};

for (const agent of agents) {
  protectedArtifacts.set(agent.id, {
    agentId: agent.id,
    network: process.env.WALRUS_NETWORK === "mainnet" ? "walrus-mainnet" : "walrus-testnet",
    sealPolicyId:
      agent.id === "wal-test1"
        ? "none:plaintext-walrus-demo"
        : `seal:${process.env.SUI_NETWORK || "testnet"}:${agent.id}-policy`,
    sealEncryptionId:
      agent.id === "wal-test1"
        ? null
        : `hireme::agent-folder::${agent.id}`,
    walrusBlobId:
      agent.id === "wal-test1"
        ? "supabase:walrus_agent_artifacts/latest"
        : `walrus_${agent.id.replaceAll("-", "_")}_encrypted_folder`,
    suiObjectId: `0x${sha256Hex(`${agent.id}:sui-object`).slice(0, 64)}`,
    ciphertextDigest: `sha256:${sha256Hex(`${agent.id}:ciphertext`)}`,
    folderManifestDigest: `sha256:${sha256Hex(`${agent.id}:AGENTS.md:skills`)}`,
    visibility:
      agent.id === "wal-test1"
        ? "Plaintext Walrus demo. The gateway reads the blob and returns only a folder summary; production should switch this path to Seal ciphertext."
        : "The hirer's Codex receives only public metadata and safe results. The gateway runner is the only component that can load the decrypted folder.",
    registeredAt: new Date("2026-06-10T00:00:00.000Z").toISOString(),
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      sendJson(res, 204, null);
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "hireme-gateway",
        mode: "local-memory",
        authRequired: Boolean(apiKey),
        supabaseConfigured: Boolean(
          (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        ),
        walrusNetwork: process.env.WALRUS_NETWORK || "testnet",
        suiNetwork: process.env.SUI_NETWORK || "testnet",
      });
      return;
    }

    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const body = await readJson(req);

    if (req.method === "POST" && url.pathname === "/v1/agents/list") {
      sendJson(res, 200, listAgents(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/agents/get") {
      sendJson(res, 200, { agent: publicAgent(findAgent(body.agent_id)) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/sessions/select") {
      const agent = findAgent(body.agent_id);
      const installationId = body.codex_installation_id || defaultInstallationId;
      sessions.set(installationId, agent.id);
      sendJson(res, 200, {
        activeAgentId: agent.id,
        codexInstallationId: installationId,
        activeAgent: publicAgent(agent),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/sessions/current") {
      const installationId = body.codex_installation_id || defaultInstallationId;
      const activeAgentId = sessions.get(installationId) || "walrus-researcher";
      sendJson(res, 200, {
        activeAgentId,
        codexInstallationId: installationId,
        activeAgent: publicAgent(findAgent(activeAgentId)),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/agent-call") {
      sendJson(res, 200, await runProtectedAgent(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/sealed-harness/prepare") {
      sendJson(res, 200, prepareSealedHarnessUpload(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/sealed-harness/register") {
      sendJson(res, 200, registerSealedHarness(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/sealed-harness/validate") {
      const result = await validateSealedArtifact({
        recordPath: body.record_path || body.recordPath,
        walrusPath: body.walrus_path || body.walrusPath,
        hireReceiptObjectId:
          body.hire_receipt_object_id || body.hireReceiptObjectId,
        runnerIdentity: body.runner_identity || body.runnerIdentity,
      });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/walrus-agent/read") {
      const result = await readWalrusAgentArtifact({
        blob_id: body.blob_id || body.blobId,
        agent_id: body.agent_id || body.agentId,
        task: body.task,
      });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/ledger") {
      sendJson(res, 200, { count: ledger.length, ledger });
      return;
    }

    sendJson(res, 404, { error: "not_found", path: url.pathname });
  } catch (err) {
    sendJson(res, err.statusCode || 500, {
      error: err.code || "gateway_error",
      message: err.message,
    });
  }
});

server.listen(port, () => {
  console.log(`HireMe protected gateway listening on http://localhost:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

function listAgents(args = {}) {
  const query = args.query?.trim().toLowerCase();
  const filtered = agents
    .filter((agent) => !args.category || agent.category === args.category)
    .filter((agent) => {
      if (!query) return true;
      return [
        agent.id,
        agent.name,
        agent.handle,
        agent.creator,
        agent.category,
        agent.headline,
        agent.publicSummary,
        ...agent.skills,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      category: agent.category,
      status: agent.status,
      headline: agent.headline,
      pricePerCallUsd: agent.pricePerCallUsd,
      publicSkills: agent.skills,
      memwalPolicy: agent.memwalPolicy,
      sealedHarness: protectedArtifacts.get(agent.id),
      active: agent.id === (sessions.get(args.codex_installation_id || defaultInstallationId) || "walrus-researcher"),
    }));

  return {
    gatewayCall: true,
    count: filtered.length,
    activeAgentId: sessions.get(args.codex_installation_id || defaultInstallationId) || "walrus-researcher",
    hiredAgents: filtered,
  };
}

function publicAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    handle: agent.handle,
    creator: agent.creator,
    category: agent.category,
    status: agent.status,
    headline: agent.headline,
    publicSummary: agent.publicSummary,
    publicSkills: agent.skills,
    publicContract: agent.publicContract,
    memwalPolicy: agent.memwalPolicy,
    hiddenAssetClasses: agent.hiddenAssetClasses,
    sealedHarness: protectedArtifacts.get(agent.id),
    pricePerCallUsd: agent.pricePerCallUsd,
    freeCalls: agent.freeCalls,
    rating: agent.rating,
    historicalCalls: agent.calls,
    medianLatencyMs: agent.latencyMs,
    hired: true,
  };
}

async function runProtectedAgent(args = {}) {
  const installationId = args.codex_installation_id || defaultInstallationId;
  const agentId = args.agent_id || sessions.get(installationId) || "walrus-researcher";
  const agent = findAgent(agentId);
  const artifact = protectedArtifacts.get(agent.id);
  const budgetCalls = args.budget_calls || 1;
  const sealedTaskResult = localSealedExampleRecords[agent.id]
    ? await runSealedArtifactTask({
        recordPath: args.record_path || localSealedExampleRecords[agent.id],
        walrusPath: args.walrus_path,
        hireReceiptObjectId:
          args.hire_receipt_object_id || "hire_receipt_local_paid_demo",
        runnerIdentity: args.runner_identity,
        task: args.task || "",
      })
    : null;
  const callId = `call_${Date.now().toString(36)}_${sha256Hex(`${agent.id}:${args.task || ""}`).slice(0, 8)}`;
  const requestDigest = `sha256:${sha256Hex(JSON.stringify({
    agentId: agent.id,
    task: args.task,
    budgetCalls,
  }))}`;
  const safeResult =
    sealedTaskResult?.result || buildSafeResult(agent, args.task || "");
  const responseDigest = `sha256:${sha256Hex(JSON.stringify(safeResult))}`;
  const ledgerEvent = {
    callId,
    table: "mcp_call_ledger",
    status: "mock_recorded",
    hireId: "local-hire",
    agentId: agent.id,
    creator: agent.creator,
    requestDigest,
    responseDigest,
    billableCalls: 1,
    amountUsd: agent.pricePerCallUsd,
    latencyMs: agent.latencyMs,
    rawPromptStored: false,
    rawResponseStored: false,
  };

  ledger.push({
    ...ledgerEvent,
    createdAt: new Date().toISOString(),
  });

  return {
    gatewayCall: true,
    callId,
    activeAgentId: agent.id,
    codexInstallationId: installationId,
    agent: {
      id: agent.id,
      name: agent.name,
      pricePerCallUsd: agent.pricePerCallUsd,
    },
    request: {
      budgetCalls,
      requestDigest,
    },
    authorization: {
      hireVerified: true,
      budgetApproved: budgetCalls <= 100,
      sealPolicyApproved: true,
      gatewayTrustedExecutor: true,
      mode: sealedTaskResult ? "trusted-gateway-sealed-artifact" : "local-mock",
    },
    sealedArtifact: {
      network: artifact.network,
      sealPolicyId: artifact.sealPolicyId,
      walrusBlobId: artifact.walrusBlobId,
      ciphertextDigest: artifact.ciphertextDigest,
    },
    runner: {
      executionMode: sealedTaskResult
        ? "trusted-gateway-sealed-folder-runner"
        : "local-mock-runner",
      gatewayTrustedExecutor: true,
      privateAgentFolderLoaded: Boolean(sealedTaskResult),
      privateHarnessApplied: true,
      privateFolderReturnedToCodex: false,
      gatewayCanReadUserInput: true,
      gatewayCanReadCreatorArtifact: Boolean(sealedTaskResult),
      exposedSkills: false,
      exposedPluginCode: false,
      exposedHarnessInternals: false,
    },
    result: safeResult,
    sealedValidation: sealedTaskResult?.validation || null,
    ledgerEvent,
  };
}

function buildSafeResult(agent, task) {
  const taskDigest = sha256Hex(task).slice(0, 12);

  return {
    summary: `${agent.name} applied its protected Agent folder to the request and returned a safe execution plan.`,
    taskDigest: `sha256:${taskDigest}`,
    recommendations: [
      `Use the public contract ${agent.publicContract}.`,
      "Keep creator AGENTS.md and skills folders inside the gateway runner.",
      "Record only request and response digests in the ledger.",
    ],
    constraints: [
      "Do not return plaintext private skills, prompt templates, eval sets, or adapter source.",
      "Use the hirer's Codex for repo edits and final reasoning.",
      "Use this gateway call as protected guidance, not as a local folder download.",
    ],
    nextActions: [
      "Apply the returned plan in the local repo.",
      "Pass an explicit agent_id for high-value calls.",
      "Check ledgerEvent.amountUsd before repeated calls.",
    ],
  };
}

function prepareSealedHarnessUpload(args = {}) {
  const epochs = args.epochs || 3;
  return {
    gatewayCall: true,
    agentId: args.agent_id || "new-agent",
    expectedFolderShape: ["AGENTS.md", "skills/**", "optional adapters/**"],
    visibilityBoundary:
      "The creator folder is sealed before Walrus upload. Hirer Codex receives only metadata and safe execution results.",
    localTestnetCommands: [
      "tar -czf agent-folder.tar.gz AGENTS.md skills/",
      "seal-cli encrypt --policy <seal_policy_id> --in agent-folder.tar.gz --out agent-folder.seal.bin",
      `walrus store agent-folder.seal.bin --epochs ${epochs} --context testnet`,
    ],
    publicMetadataToRegister: [
      "seal_policy_id",
      "walrus_blob_id",
      "sui_object_id",
      "ciphertext_digest",
      "price_per_call_usd",
    ],
  };
}

function registerSealedHarness(args = {}) {
  for (const field of [
    "agent_id",
    "seal_policy_id",
    "walrus_blob_id",
    "sui_object_id",
    "ciphertext_digest",
    "price_per_call_usd",
  ]) {
    if (!args[field]) {
      throw Object.assign(new Error(`Missing required field: ${field}`), {
        statusCode: 400,
        code: "bad_request",
      });
    }
  }

  const record = {
    agentId: args.agent_id,
    network: process.env.WALRUS_NETWORK === "mainnet" ? "walrus-mainnet" : "walrus-testnet",
    sealPolicyId: args.seal_policy_id,
    walrusBlobId: args.walrus_blob_id,
    suiObjectId: args.sui_object_id,
    ciphertextDigest: args.ciphertext_digest,
    pricePerCallUsd: args.price_per_call_usd,
    registeredAt: new Date().toISOString(),
  };

  protectedArtifacts.set(record.agentId, record);

  return {
    gatewayCall: true,
    status: "registered",
    publicRecord: record,
    storedPlaintextHarness: false,
    returnedCreatorSecrets: false,
  };
}

function findAgent(agentId) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) {
    throw Object.assign(new Error(`Unknown or not hired agent_id: ${agentId}`), {
      statusCode: 404,
      code: "unknown_agent",
    });
  }
  return agent;
}

function isAuthorized(req) {
  if (!apiKey) return true;
  return (
    req.headers.authorization === `Bearer ${apiKey}` ||
    req.headers["x-hireme-gateway-key"] === apiKey
  );
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), {
      statusCode: 400,
      code: "bad_json",
    });
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-hireme-gateway-key");
  if (statusCode === 204) {
    res.end();
    return;
  }
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function loadEnvFile(filename) {
  try {
    const file = readFileSync(resolve(process.cwd(), filename), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Missing env files are fine for local memory mode.
  }
}
