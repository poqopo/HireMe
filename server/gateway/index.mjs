#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  runSealedArtifactTask,
  validateSealedArtifact,
} from "./localSealedArtifact.mjs";
import { readMemWalSnapshot, writeUserMemWalResult } from "./memWal.mjs";
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
    headline: "Finds protocol evidence, cites sources, and keeps private notes protected.",
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
    headline: "Reviews pull requests through a protected private rubric.",
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
    headline: "Creates landing page briefs from a protected design system guide.",
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
    id: "example-aster-x1-launcher",
    name: "Example Aster X1 Launch Agent",
    handle: "@examples/aster-x1-launcher",
    creator: "HireMe Examples",
    category: "Growth",
    status: "Available",
    headline: "Builds Aster X1 preorder pages from a protected product dossier.",
    publicSummary:
      "A narrow demo agent for a single smartphone launch. Buyers receive preorder-page output, not the private product dossier or launch playbook.",
    publicContract: "create_aster_x1_preorder_page(task, market, launch_window)",
    memwalPolicy:
      "Private Aster X1 product dossier, launch playbook, and preorder-page skill decrypt only inside the gateway runner.",
    skills: ["Smartphone preorder pages", "Launch offer mechanics", "Product detail conversion"],
    hiddenAssetClasses: [
      "AGENTS.md",
      "product-dossier.json",
      "launch-playbook.json",
      "visual-layout-harness.json",
      "skills/**",
      "harness/**",
    ],
    pricePerCallUsd: 0.034,
    freeCalls: 3,
    rating: 5.0,
    calls: 2,
    latencyMs: 810,
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
      "Plaintext Walrus test only. Production protected agents should store platform-managed ciphertext and decrypt only inside the gateway runner.",
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
const agentEntitlements = new Map();
const oauthClients = new Map();
const oauthCodes = new Map();
const oauthTokens = new Map();
const oauthGoogleStates = new Map();
const oauthLoginSessions = new Map();
const oauthScopes = ["hireme:agents", "hireme:call", "hireme:manage"];
const localSealedExampleRecords = {
  "example-code-reviewer":
    ".hireme/artifacts/example-code-reviewer.public-record.json",
  "example-landing-designer":
    ".hireme/artifacts/example-landing-designer.public-record.json",
  "example-aster-x1-launcher":
    ".hireme/artifacts/example-aster-x1-launcher.public-record.json",
};

for (const agent of agents) {
  protectedArtifacts.set(agent.id, {
    agentId: agent.id,
    network: process.env.WALRUS_NETWORK === "mainnet" ? "walrus-mainnet" : "walrus-testnet",
    encryptionProvider: agent.id === "wal-test1" ? "none" : "platform-managed-envelope",
    platformKmsKeyId:
      agent.id === "wal-test1"
        ? null
        : process.env.HIREME_PLATFORM_KMS_KEY_ID || "platform:local-dev-key",
    ciphertextFormat:
      agent.id === "wal-test1" ? "plaintext-walrus-folder-demo" : "hireme.platform-ciphertext-envelope.v1",
    policyId:
      agent.id === "wal-test1"
        ? "none:plaintext-walrus-demo"
        : `platform:agent:${agent.id}`,
    sealPolicyId:
      agent.id === "wal-test1"
        ? "none:plaintext-walrus-demo"
        : `platform:agent:${agent.id}`,
    sealEncryptionId:
      agent.id === "wal-test1"
        ? null
        : `hireme::agent-folder::${agent.id}`,
    sealPackageId:
      agent.id === "wal-test1"
        ? null
        : process.env.HIREME_SEAL_PACKAGE_ID || null,
    sealApproveTarget:
      agent.id === "wal-test1"
        ? null
        : process.env.HIREME_SEAL_APPROVE_TARGET ||
          (process.env.HIREME_SEAL_PACKAGE_ID
            ? `${process.env.HIREME_SEAL_PACKAGE_ID}::access::seal_approve`
            : null),
    sealThreshold:
      agent.id === "wal-test1" ? null : readPlatformThreshold(),
    sealKeyServerIds:
      agent.id === "wal-test1" ? [] : readSealKeyServerIds(),
    walrusBlobId:
      agent.id === "wal-test1"
        ? "supabase:walrus_agent_artifacts/latest"
        : `walrus_${agent.id.replaceAll("-", "_")}_encrypted_folder`,
    suiObjectId: `0x${sha256Hex(`${agent.id}:sui-object`).slice(0, 64)}`,
    ciphertextDigest: `sha256:${sha256Hex(`${agent.id}:ciphertext`)}`,
    folderManifestDigest: `sha256:${sha256Hex(`${agent.id}:AGENTS.md:skills`)}`,
    visibility:
      agent.id === "wal-test1"
        ? "Plaintext Walrus demo. The gateway reads the blob and returns only a folder summary; production should switch this path to platform-managed ciphertext."
        : "The hirer's Codex receives only public metadata and safe results. The gateway runner is the only component that can load the decrypted folder.",
    registeredAt: new Date("2026-06-10T00:00:00.000Z").toISOString(),
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      if (url.pathname === "/oauth/web-session") {
        sendWebSessionJson(req, res, 204, null);
        return;
      }
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

    if (
      req.method === "GET" &&
      (url.pathname === "/.well-known/oauth-authorization-server" ||
        url.pathname === "/.well-known/openid-configuration")
    ) {
      sendJson(res, 200, oauthAuthorizationServerMetadata(req));
      return;
    }

    if (
      req.method === "GET" &&
      (url.pathname === "/.well-known/oauth-protected-resource" ||
        url.pathname === "/.well-known/oauth-protected-resource/mcp")
    ) {
      sendJson(res, 200, oauthProtectedResourceMetadata(req));
      return;
    }

    if (req.method === "POST" && url.pathname === "/oauth/register") {
      sendJson(res, 201, await registerOAuthClient(req));
      return;
    }

    if (url.pathname === "/oauth/web-session") {
      await handleWebOAuthSession(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/oauth/authorize") {
      await renderOAuthAuthorize(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/oauth/approve") {
      await approveOAuthAuthorization(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/oauth/token") {
      sendJson(res, 200, await issueOAuthToken(req));
      return;
    }

    if (req.method === "GET" && url.pathname === "/oauth/google/start") {
      await startGoogleOAuth(req, res, url);
      return;
    }

    if (req.method === "GET" && url.pathname === "/oauth/google/callback") {
      await finishGoogleOAuth(req, res, url);
      return;
    }

    if (url.pathname === "/mcp") {
      await handleHttpMcp(req, res);
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

    if (req.method === "POST" && url.pathname === "/v1/agents/register") {
      sendJson(res, 200, await registerAgentFromMcp(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/agents/try") {
      sendJson(res, 200, await grantAgentAccess({ ...body, access_type: "trial" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/agents/hire") {
      sendJson(res, 200, await grantAgentAccess({ ...body, access_type: "hired" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/my/agents") {
      sendJson(res, 200, await listMyAgents(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/me/wallet") {
      sendJson(res, 200, await linkSuiWallet(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/whoami") {
      sendJson(res, 200, gatewayWhoami(body));
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

    if (req.method === "POST" && url.pathname === "/v1/memwal/read") {
      const result = await readMemWalSnapshot({
        recordPath:
          body.record_path ||
          body.recordPath ||
          `.hireme/memwal/${body.agent_id || body.agentId || "example-code-reviewer"}.memwal-record.json`,
        hireReceiptObjectId:
          body.hire_receipt_object_id ||
          body.hireReceiptObjectId ||
          "hire_receipt_local_paid_demo",
        runnerIdentity: body.runner_identity,
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
    const errorUrl = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );
    if (errorUrl.pathname === "/oauth/web-session") {
      sendWebSessionJson(req, res, err.statusCode || 500, {
        error: err.code || "gateway_error",
        message: err.message,
      });
      return;
    }
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

const httpMcpTools = [
  {
    name: "hireme_whoami",
    title: "Show connected HireMe identity",
    description:
      "Return the OAuth-connected HireMe identity that Codex is using for Agent entitlements and calls.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "hireme_request",
    title: "Route a plain-language HireMe request",
    description:
      "Infer the Agent from a natural request and call it through the protected HireMe gateway.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", minLength: 1 },
        agent_id: { type: "string" },
        budget_calls: { type: "integer", minimum: 1 },
      },
      required: ["request"],
    },
  },
  {
    name: "hireme_list_hired_agents",
    title: "List HireMe marketplace agents",
    description: "List public Agent cards, pricing, and protected artifact metadata.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string" },
      },
    },
  },
  {
    name: "hireme_list_my_agents",
    title: "List my usable HireMe agents",
    description:
      "List Try/Hire entitlements for the OAuth-connected HireMe user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "hireme_get_agent",
    title: "Get HireMe agent profile",
    description: "Inspect one Agent's public metadata and protection policy.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "hireme_select_agent",
    title: "Select active HireMe agent",
    description: "Set the active Agent for this OAuth-connected Codex client.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "hireme_current_agent",
    title: "Get active HireMe agent",
    description: "Return the active Agent for this OAuth-connected Codex client.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "hireme_call_agent",
    title: "Call a hired HireMe agent",
    description:
      "Call an explicitly selected protected Agent using the OAuth-connected user's entitlement.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        task: { type: "string" },
        budget_calls: { type: "integer", minimum: 1 },
        hire_receipt_object_id: { type: "string" },
      },
      required: ["task"],
    },
  },
  {
    name: "hireme_register_agent",
    title: "Register a paid protected HireMe agent",
    description:
      "Register public Agent metadata and encrypted Walrus artifact references. Do not send plaintext private files.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        name: { type: "string" },
        creator: { type: "string" },
        category: { type: "string" },
        headline: { type: "string" },
        public_summary: { type: "string" },
        public_mcp_contract: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        protected_asset_classes: { type: "array", items: { type: "string" } },
        price_per_call_usd: { type: "number", minimum: 0 },
        walrus_blob_id: { type: "string" },
        sui_object_id: { type: "string" },
        ciphertext_digest: { type: "string" },
      },
      required: [
        "agent_id",
        "name",
        "creator",
        "category",
        "headline",
        "public_summary",
        "public_mcp_contract",
        "skills",
        "price_per_call_usd",
        "walrus_blob_id",
        "sui_object_id",
        "ciphertext_digest",
      ],
    },
  },
  {
    name: "hireme_call_walrus_agent",
    title: "Read a Walrus Agent folder",
    description:
      "Ask the gateway to inspect a Walrus-stored Agent folder and return only a safe summary.",
    inputSchema: {
      type: "object",
      properties: {
        blob_id: { type: "string" },
        agent_id: { type: "string" },
        task: { type: "string" },
      },
    },
  },
  {
    name: "hireme_read_memwal",
    title: "Read protected memWal memory",
    description: "Read safe metadata from a user-scoped memWal result record.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        record_path: { type: "string" },
        hire_receipt_object_id: { type: "string" },
      },
    },
  },
  {
    name: "hireme_validate_sealed_harness",
    title: "Validate protected Agent harness",
    description:
      "Validate a protected local demo artifact and return only safe metadata.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        record_path: { type: "string" },
        walrus_path: { type: "string" },
        hire_receipt_object_id: { type: "string" },
      },
    },
  },
];

function oauthAuthorizationServerMetadata(req) {
  const baseUrl = gatewayBaseUrl(req);
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: oauthScopes,
  };
}

function oauthProtectedResourceMetadata(req) {
  const baseUrl = gatewayBaseUrl(req);
  return {
    resource: `${baseUrl}/mcp`,
    resource_name: "HireMe MCP",
    authorization_servers: [baseUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: oauthScopes,
  };
}

async function registerOAuthClient(req) {
  const body = await readJson(req);
  const redirectUris = normalizeRedirectUris(body.redirect_uris || body.redirectUris);
  if (!redirectUris.length) {
    throw Object.assign(new Error("redirect_uris must include at least one URI"), {
      statusCode: 400,
      code: "bad_oauth_client",
    });
  }

  const clientId = randomOAuthId("client");
  const client = {
    clientId,
    clientName: body.client_name || body.clientName || "Codex",
    redirectUris,
    tokenEndpointAuthMethod: "none",
    createdAt: new Date().toISOString(),
  };
  oauthClients.set(clientId, client);
  await persistOAuthClient(client);

  return {
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

async function handleWebOAuthSession(req, res) {
  if (req.method === "GET") {
    const loginSession = await readOAuthLoginSession(req);
    sendWebSessionJson(req, res, 200, {
      authenticated: Boolean(loginSession),
      user: loginSession
        ? {
            email: loginSession.email,
            hirerId: loginSession.hirerId,
            subject: loginSession.subject,
            provider: loginSession.provider,
            name: loginSession.name || null,
            suiAddress: loginSession.suiAddress || null,
          }
        : null,
    });
    return;
  }

  if (req.method === "DELETE") {
    const sessionId = readOAuthSessionCookie(req);
    if (sessionId) {
      oauthLoginSessions.delete(sessionId);
      await deleteStoredOAuthLoginSession(sessionId);
    }
    res.setHeader("set-cookie", clearOAuthSessionCookies());
    sendWebSessionJson(req, res, 200, { authenticated: false });
    return;
  }

  if (req.method !== "POST") {
    sendWebSessionJson(req, res, 405, { error: "method_not_allowed" });
    return;
  }

  const body = await readJson(req);
  const accessToken = String(body.access_token || body.accessToken || "");
  if (!accessToken) {
    throw Object.assign(new Error("access_token is required"), {
      statusCode: 400,
      code: "bad_request",
    });
  }

  const user = await verifySupabaseUserAccessToken(accessToken);
  const requestedSuiAddress = normalizeSuiAddress(
    body.sui_address || body.suiAddress || body.wallet_address || body.walletAddress,
  );
  const requestedDisplayName = normalizeDisplayName(
    body.display_name || body.displayName || body.name,
  );
  const profile = await upsertSupabaseProfileForOAuthUser(user, {
    suiAddress: requestedSuiAddress,
    displayName: requestedDisplayName,
  });
  const suiAddress = profile?.sui_address || requestedSuiAddress || null;
  const displayName =
    profile?.display_name ||
    requestedDisplayName ||
    user.user_metadata?.hireme_display_name ||
    "";
  const email = user.email || user.user_metadata?.email || user.id;
  const sessionId = randomOAuthId("web");
  const loginSession = {
    id: sessionId,
    provider:
      user.app_metadata?.provider ||
      user.app_metadata?.providers?.[0] ||
      "supabase",
    subject: `supabase:${user.id}`,
    email,
    name: displayName || user.email || user.id,
    hirerId: normalizeHirerId(email),
    suiAddress,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  oauthLoginSessions.set(sessionId, loginSession);
  await persistOAuthLoginSession(loginSession);
  res.setHeader("set-cookie", oauthSessionCookies(sessionId, 7 * 24 * 60 * 60));
  sendWebSessionJson(req, res, 200, {
    authenticated: true,
    user: {
      email: loginSession.email,
      hirerId: loginSession.hirerId,
      subject: loginSession.subject,
      provider: loginSession.provider,
      name: loginSession.name || null,
      suiAddress: loginSession.suiAddress || null,
    },
  });
}

async function renderOAuthAuthorize(req, res, url) {
  const params = await parseOAuthAuthorizeParams(url.searchParams);
  const baseUrl = gatewayBaseUrl(req);
  const loginSession = await readOAuthLoginSession(req);
  const demoLoginAllowed = isDemoOAuthLoginAllowed();
  if (!loginSession && !demoLoginAllowed) {
    redirectToWebLogin(req, res, `${baseUrl}/oauth/authorize${url.search}`);
    return;
  }

  sendHtml(res, 200, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connect HireMe to Codex</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0d253d; background: #f6f8fb; }
      main { width: min(440px, calc(100vw - 32px)); border: 1px solid #dde3ee; border-radius: 14px; background: white; padding: 28px; box-shadow: 0 18px 60px rgba(13, 37, 61, 0.08); }
      h1 { margin: 0 0 10px; font-size: 24px; font-weight: 500; letter-spacing: 0; }
      p { margin: 0 0 18px; color: #526173; line-height: 1.55; }
      .muted { color: #6b7280; font-size: 13px; }
      .identity { margin: 16px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fbfbff; font-size: 14px; }
      input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 12px; font-size: 14px; }
      button, a.button { width: 100%; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; border: 0; border-radius: 999px; background: #533afd; color: white; font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer; }
      a.secondary { margin-bottom: 10px; background: #0d253d; }
      .stack { display: grid; gap: 10px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Connect HireMe to Codex</h1>
      <p>Codex is requesting access to your HireMe Agents through the local MCP gateway.</p>
      <div class="identity">
        <div><strong>Client</strong>: ${escapeHtml(params.client.clientName)}</div>
        <div><strong>Scopes</strong>: ${escapeHtml(params.scope || oauthScopes.join(" "))}</div>
        ${
          loginSession
            ? `<div><strong>Signed in</strong>: ${escapeHtml(loginSession.name || loginSession.email)}</div><div class="muted">${escapeHtml(loginSession.email || "")}</div>`
            : `<div><strong>Sign in</strong>: local demo identity</div>`
        }
      </div>
      <div class="stack">
        ${
          loginSession || demoLoginAllowed
            ? oauthApprovalForm(params, loginSession)
            : `<p class="muted">Sign in on HireMe web first, then return to this Codex connection request.</p>`
        }
      </div>
      <p class="muted">This grants Codex access to call HireMe MCP tools as your HireMe user. Creator private Agent folders remain behind the gateway.</p>
    </main>
  </body>
</html>`);
}

function oauthApprovalForm(params, loginSession) {
  return `<form method="post" action="/oauth/approve" class="stack">
    ${hiddenInput("client_id", params.clientId)}
    ${hiddenInput("redirect_uri", params.redirectUri)}
    ${hiddenInput("scope", params.scope)}
    ${hiddenInput("state", params.state)}
    ${hiddenInput("resource", params.resource)}
    ${hiddenInput("code_challenge", params.codeChallenge)}
    ${hiddenInput("code_challenge_method", params.codeChallengeMethod)}
    ${
      loginSession
        ? hiddenInput("login_session_id", loginSession.id)
        : `<input name="email" value="local-hirer" aria-label="HireMe user" />`
    }
    <button type="submit">Connect</button>
  </form>`;
}

async function approveOAuthAuthorization(req, res) {
  const form = await readForm(req);
  const params = await parseOAuthAuthorizeParams(new URLSearchParams({
    response_type: "code",
    client_id: form.client_id || "",
    redirect_uri: form.redirect_uri || "",
    scope: form.scope || "",
    state: form.state || "",
    resource: form.resource || "",
    code_challenge: form.code_challenge || "",
    code_challenge_method: form.code_challenge_method || "plain",
  }));
  const loginSession =
    form.login_session_id && (await getOAuthLoginSession(form.login_session_id));
  if (!loginSession && !isDemoOAuthLoginAllowed()) {
    throw Object.assign(
      new Error("HireMe web login is required before approving Codex access"),
      {
        statusCode: 401,
        code: "web_login_required",
      },
    );
  }
  const email = String(loginSession?.email || form.email || "local-hirer").trim();
  const subject = loginSession?.subject || `local:${email}`;
  const hirerId = normalizeHirerId(loginSession?.hirerId || form.hirer_id || email);
  const suiAddress = loginSession?.suiAddress || null;
  const code = randomOAuthId("code");

  const codeRecord = {
    code,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    resource: params.resource,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    subject,
    email,
    hirerId,
    suiAddress,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  oauthCodes.set(code, codeRecord);
  await persistOAuthAuthorizationCode(codeRecord);

  const redirectUrl = new URL(params.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (params.state) redirectUrl.searchParams.set("state", params.state);
  res.statusCode = 302;
  res.setHeader("location", redirectUrl.toString());
  res.end();
}

async function issueOAuthToken(req) {
  const body = await readJsonOrForm(req);
  if (body.grant_type !== "authorization_code") {
    throw Object.assign(new Error("Only authorization_code grant is supported"), {
      statusCode: 400,
      code: "unsupported_grant_type",
    });
  }

  const codeRecord =
    oauthCodes.get(body.code) || (await readStoredOAuthAuthorizationCode(body.code));
  if (!codeRecord || codeRecord.expiresAt < Date.now()) {
    throw Object.assign(new Error("Invalid or expired authorization code"), {
      statusCode: 400,
      code: "invalid_grant",
    });
  }

  if (body.client_id !== codeRecord.clientId) {
    throw Object.assign(new Error("client_id does not match authorization code"), {
      statusCode: 400,
      code: "invalid_grant",
    });
  }

  if (body.redirect_uri !== codeRecord.redirectUri) {
    throw Object.assign(new Error("redirect_uri does not match authorization code"), {
      statusCode: 400,
      code: "invalid_grant",
    });
  }

  if (codeRecord.codeChallenge) {
    const verifier = String(body.code_verifier || "");
    const expected =
      codeRecord.codeChallengeMethod === "S256"
        ? sha256Base64Url(verifier)
        : verifier;
    if (expected !== codeRecord.codeChallenge) {
      throw Object.assign(new Error("Invalid PKCE verifier"), {
        statusCode: 400,
        code: "invalid_grant",
      });
    }
  }

  oauthCodes.delete(body.code);
  await deleteStoredOAuthAuthorizationCode(body.code);
  const accessToken = randomOAuthId("token");
  const expiresIn = Number.parseInt(process.env.HIREME_OAUTH_TOKEN_TTL || "3600", 10);
  const tokenSession = {
    accessToken,
    clientId: codeRecord.clientId,
    subject: codeRecord.subject,
    email: codeRecord.email,
    hirerId: codeRecord.hirerId,
    suiAddress: codeRecord.suiAddress || null,
    scope: codeRecord.scope,
    resource: codeRecord.resource,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresIn * 1000,
  };
  oauthTokens.set(accessToken, tokenSession);
  await persistOAuthAccessToken(accessToken, tokenSession);

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: codeRecord.scope,
  };
}

async function startGoogleOAuth(req, res, url) {
  const returnTo = url.searchParams.get("return_to") || `${gatewayBaseUrl(req)}/oauth/authorize`;
  if (!isGoogleOAuthConfigured()) {
    const redirect = new URL(returnTo);
    redirect.searchParams.set("google", "not_configured");
    res.statusCode = 302;
    res.setHeader("location", redirect.toString());
    res.end();
    return;
  }

  const baseUrl = gatewayBaseUrl(req);
  const state = randomOAuthId("google");
  oauthGoogleStates.set(state, {
    returnTo,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", process.env.HIREME_GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", `${baseUrl}/oauth/google/callback`);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  res.statusCode = 302;
  res.setHeader("location", googleUrl.toString());
  res.end();
}

async function finishGoogleOAuth(req, res, url) {
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const stateRecord = oauthGoogleStates.get(state);
  if (!stateRecord || stateRecord.expiresAt < Date.now() || !code) {
    throw Object.assign(new Error("Invalid Google OAuth callback"), {
      statusCode: 400,
      code: "bad_google_oauth_callback",
    });
  }
  oauthGoogleStates.delete(state);

  const baseUrl = gatewayBaseUrl(req);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.HIREME_GOOGLE_CLIENT_ID,
      client_secret: process.env.HIREME_GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${baseUrl}/oauth/google/callback`,
    }),
  });
  if (!tokenResponse.ok) {
    throw Object.assign(
      new Error(`Google token exchange failed: ${tokenResponse.status}`),
      { statusCode: 502, code: "google_oauth_failed" },
    );
  }
  const token = await tokenResponse.json();
  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!userResponse.ok) {
    throw Object.assign(
      new Error(`Google userinfo failed: ${userResponse.status}`),
      { statusCode: 502, code: "google_oauth_failed" },
    );
  }
  const profile = await userResponse.json();
  const email = profile.email || profile.sub;
  const sessionId = randomOAuthId("login");
  const loginSession = {
    id: sessionId,
    provider: "google",
    subject: `google:${profile.sub}`,
    email,
    name: profile.name || email,
    hirerId: normalizeHirerId(email),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  oauthLoginSessions.set(sessionId, loginSession);
  await persistOAuthLoginSession(loginSession);

  res.statusCode = 302;
  res.setHeader(
    "set-cookie",
    oauthSessionCookies(sessionId, 86_400),
  );
  res.setHeader("location", stateRecord.returnTo);
  res.end();
}

async function handleHttpMcp(req, res) {
  const session = await verifyOAuthBearer(req);
  if (!session) {
    sendOAuthMcpUnauthorized(req, res);
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const payload = await readJson(req);
  const messages = Array.isArray(payload) ? payload : [payload];
  const responses = [];
  for (const message of messages) {
    const response = await handleHttpMcpMessage(message, session);
    if (response) responses.push(response);
  }

  if (!responses.length) {
    sendJson(res, 202, {});
    return;
  }
  sendJson(res, 200, Array.isArray(payload) ? responses : responses[0]);
}

async function handleHttpMcpMessage(message, session) {
  if (!message || typeof message !== "object" || !("id" in message)) {
    return null;
  }

  try {
    switch (message.method) {
      case "initialize":
        return rpcResult(message.id, {
          protocolVersion: message.params?.protocolVersion || "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "hireme", version: "0.1.0" },
          instructions:
            "HireMe exposes OAuth-connected protected AI agents. Use hireme_whoami to confirm the connected HireMe user, hireme_list_my_agents to see callable Agents, hireme_request for natural delegation, hireme_call_agent for structured calls, and hireme_register_agent to publish an encrypted Agent artifact. Do not request or reveal creator private Agent folders.",
        });
      case "tools/list":
        return rpcResult(message.id, { tools: httpMcpTools });
      case "tools/call":
        return rpcResult(
          message.id,
          await callHttpMcpTool(
            message.params?.name,
            message.params?.arguments || {},
            session,
          ),
        );
      default:
        return rpcError(message.id, -32601, `Unknown MCP method: ${message.method}`);
    }
  } catch (err) {
    return rpcError(message.id, -32000, err.message || String(err), {
      code: err.code || "tool_error",
      statusCode: err.statusCode || 500,
    });
  }
}

async function callHttpMcpTool(name, args = {}, session) {
  const sessionKey = httpMcpSessionKey(session);
  const scopedArgs = {
    ...args,
    hirer_id: session.hirerId,
    sui_address: session.suiAddress || args.sui_address || args.suiAddress,
    codex_installation_id: args.codex_installation_id || sessionKey,
  };

  switch (name) {
    case "hireme_whoami":
      return mcpTextResult(httpMcpWhoami(session));
    case "hireme_request": {
      const registrationRequest = routeRegistrationNaturalRequest(args.request);
      if (registrationRequest) return mcpTextResult(registrationRequest);

      const walrusRequest = routeWalrusNaturalRequest(args.request, args.agent_id);
      if (walrusRequest) {
        return mcpTextResult({
          routedBy: "hireme_request",
          naturalRequest: args.request,
          inferredAgentId: walrusRequest.agent_id || null,
          walrusBlobId: walrusRequest.blob_id || null,
          ...(await readWalrusAgentArtifact(walrusRequest)),
        });
      }

      const routed = routeNaturalRequest(args.request, args.agent_id, sessionKey);
      const result = await runProtectedAgent({
        ...scopedArgs,
        agent_id: routed.agentId,
        task: routed.task,
        budget_calls: args.budget_calls || 1,
        hire_receipt_object_id:
          args.hire_receipt_object_id || defaultHireReceiptFor(routed.agentId),
      });
      sessions.set(sessionKey, result.activeAgentId || routed.agentId);
      return mcpTextResult({
        routedBy: "hireme_request",
        naturalRequest: args.request,
        inferredAgentId: routed.agentId,
        task: routed.task,
        ...result,
      });
    }
    case "hireme_list_hired_agents":
      return mcpTextResult(listAgents(scopedArgs));
    case "hireme_list_my_agents":
      return mcpTextResult(await listMyAgents(scopedArgs));
    case "hireme_get_agent":
      return mcpTextResult(publicAgent(await findOrHydrateAgent(args.agent_id)));
    case "hireme_select_agent": {
      const agent = await findOrHydrateAgent(args.agent_id);
      sessions.set(sessionKey, agent.id);
      return mcpTextResult({
        activeAgentId: agent.id,
        codexInstallationId: sessionKey,
        activeAgent: publicAgent(agent),
      });
    }
    case "hireme_current_agent": {
      const activeAgentId = sessions.get(sessionKey) || "walrus-researcher";
      return mcpTextResult({
        activeAgentId,
        codexInstallationId: sessionKey,
        activeAgent: publicAgent(await findOrHydrateAgent(activeAgentId)),
      });
    }
    case "hireme_call_agent":
      return mcpTextResult(await runProtectedAgent({
        ...scopedArgs,
        agent_id: args.agent_id || sessions.get(sessionKey) || "walrus-researcher",
      }));
    case "hireme_register_agent":
      return mcpTextResult(await registerAgentFromMcp(scopedArgs));
    case "hireme_call_walrus_agent":
      return mcpTextResult(await readWalrusAgentArtifact({
        blob_id: args.blob_id || args.blobId,
        agent_id: args.agent_id || args.agentId,
        task: args.task || "Describe this Walrus Agent folder.",
      }));
    case "hireme_read_memwal":
      return mcpTextResult(await readMemWalSnapshot({
        recordPath:
          args.record_path ||
          args.recordPath ||
          `.hireme/memwal/${args.agent_id || args.agentId || "example-code-reviewer"}.memwal-record.json`,
        hireReceiptObjectId:
          args.hire_receipt_object_id ||
          args.hireReceiptObjectId ||
          "hire_receipt_local_paid_demo",
        runnerIdentity: args.runner_identity,
      }));
    case "hireme_validate_sealed_harness": {
      const agentId = args.agent_id || "example-code-reviewer";
      return mcpTextResult(await validateSealedArtifact({
        recordPath:
          args.record_path ||
          localSealedExampleRecords[agentId] ||
          localSealedExampleRecords["example-code-reviewer"],
        walrusPath: args.walrus_path,
        hireReceiptObjectId:
          args.hire_receipt_object_id || "hire_receipt_local_paid_demo",
        runnerIdentity: args.runner_identity,
      }));
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), {
        statusCode: 404,
        code: "unknown_tool",
      });
  }
}

async function parseOAuthAuthorizeParams(searchParams) {
  const params = {
    responseType: searchParams.get("response_type") || "code",
    clientId: searchParams.get("client_id") || "",
    redirectUri: searchParams.get("redirect_uri") || "",
    scope: searchParams.get("scope") || oauthScopes.join(" "),
    state: searchParams.get("state") || "",
    resource: searchParams.get("resource") || "",
    codeChallenge: searchParams.get("code_challenge") || "",
    codeChallengeMethod: searchParams.get("code_challenge_method") || "plain",
  };

  if (params.responseType !== "code") {
    throw Object.assign(new Error("Only response_type=code is supported"), {
      statusCode: 400,
      code: "unsupported_response_type",
    });
  }
  if (!params.clientId || !params.redirectUri) {
    throw Object.assign(new Error("client_id and redirect_uri are required"), {
      statusCode: 400,
      code: "bad_oauth_request",
    });
  }
  params.client = await getOAuthClientForAuthorize(
    params.clientId,
    params.redirectUri,
  );
  return params;
}

async function getOAuthClientForAuthorize(clientId, redirectUri) {
  let client = oauthClients.get(clientId) || (await readStoredOAuthClient(clientId));
  if (!client && isLocalRedirectUri(redirectUri)) {
    client = {
      clientId,
      clientName: "Codex Local Client",
      redirectUris: [redirectUri],
      tokenEndpointAuthMethod: "none",
      createdAt: new Date().toISOString(),
      autoRegistered: true,
    };
    oauthClients.set(clientId, client);
    await persistOAuthClient(client);
  }
  if (!client) {
    throw Object.assign(new Error("Unknown OAuth client"), {
      statusCode: 400,
      code: "invalid_client",
    });
  }
  if (!client.redirectUris.includes(redirectUri)) {
    throw Object.assign(new Error("redirect_uri is not registered for this client"), {
      statusCode: 400,
      code: "invalid_redirect_uri",
    });
  }
  return client;
}

async function verifyOAuthBearer(req) {
  const authorization = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return null;
  const session =
    oauthTokens.get(match[1]) || (await readStoredOAuthAccessToken(match[1]));
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    oauthTokens.delete(match[1]);
    await deleteStoredOAuthAccessToken(match[1]);
    return null;
  }
  await touchStoredOAuthAccessToken(match[1]);
  return session;
}

function sendOAuthMcpUnauthorized(req, res) {
  const baseUrl = gatewayBaseUrl(req);
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"`,
  );
  sendJson(res, 401, {
    error: "unauthorized",
    message: "Run codex mcp login for the HireMe HTTP MCP server.",
    resource_metadata: `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
  });
}

function httpMcpWhoami(session) {
  return {
    gatewayCall: true,
    auth: {
      mode: "oauth_bearer",
      authenticated: true,
      tokenReturned: false,
    },
    user: {
      hirerId: session.hirerId,
      email: session.email || null,
      subject: session.subject,
      suiAddress: session.suiAddress || null,
    },
    codex: {
      mcpServer: "hireme",
      clientId: session.clientId,
      sessionKey: httpMcpSessionKey(session),
    },
    access: {
      scopes: String(session.scope || "")
        .split(/\s+/)
        .filter(Boolean),
      resource: session.resource || null,
      tokenExpiresAt: new Date(session.expiresAt).toISOString(),
    },
  };
}

function routeRegistrationNaturalRequest(request) {
  const text = String(request || "").trim();
  if (!text || !/(등록|publish|register|마켓플레이스|marketplace)/i.test(text)) {
    return null;
  }
  return {
    status: "registration_fields_required",
    routedBy: "hireme_request",
    naturalRequest: text,
    retryTool: "hireme_register_agent",
    requiredFields: httpMcpTools.find((tool) => tool.name === "hireme_register_agent")
      ?.inputSchema.required,
    priceFormat: "$0.005/call",
    flow: [
      "Encrypt the working Agent folder with the platform-managed envelope.",
      "Upload the ciphertext to Walrus and keep only blob/object/digest metadata.",
      "Call hireme_register_agent with public card metadata, price_per_call_usd, and encrypted artifact references.",
    ],
  };
}

function routeNaturalRequest(request, explicitAgentId, sessionKey) {
  const text = String(request || "").trim();
  const agentId = explicitAgentId || inferAgentId(text, sessionKey);
  return {
    agentId,
    task: stripDelegationPrefix(text, agentId),
  };
}

function routeWalrusNaturalRequest(request, explicitAgentId) {
  const text = String(request || "").trim();
  const normalized = text.toLowerCase();
  const mentionsWalrusAgent =
    explicitAgentId === "wal-test1" ||
    /wal[_-]?test1|blob\s*id|blobid|walrus[_\s-]?blob/.test(normalized);
  if (!mentionsWalrusAgent) return null;

  const blobIdMatch =
    /(?:blob[_\s-]?id|walrus[_\s-]?blob[_\s-]?id)\s*(?:는|은|:|=|is)?\s*([A-Za-z0-9_-]{20,})/i.exec(
      text,
    );

  return {
    blob_id: blobIdMatch?.[1],
    agent_id: explicitAgentId || (/wal[_-]?test1/.test(normalized) ? "wal-test1" : undefined),
    task:
      text
        .replace(/hireme_request/gi, "")
        .replace(/wal[_-]?test1/gi, "")
        .replace(/blob[_\s-]?id\s*(?:는|은|:|=|is)?\s*[A-Za-z0-9_-]{20,}/gi, "")
        .replace(/\s+/g, " ")
        .trim() || "Describe this Walrus Agent folder.",
  };
}

function inferAgentId(request, sessionKey) {
  const normalized = request.toLowerCase();
  const directMatch = agents.find((agent) => {
    const aliases = [
      agent.id,
      agent.name,
      agent.handle,
      agent.handle.replace(/^@/, ""),
    ].map((value) => value.toLowerCase());
    return aliases.some((alias) => normalized.includes(alias));
  });
  if (directMatch) return directMatch.id;
  if (/aster\s*x1|preorder|프리오더|사전\s*예약|런칭|launch/.test(normalized)) {
    return "example-aster-x1-launcher";
  }
  if (
    /랜딩|landing|상세\s*페이지|상세\s*랜딩|페이지\s*만들|홈페이지|hero|cta|핸드폰|휴대폰|phone|mobile/.test(
      normalized,
    )
  ) {
    return "example-landing-designer";
  }
  if (/리뷰|review|pull request|pr\b|diff|migration|코드/.test(normalized)) {
    return "example-code-reviewer";
  }
  if (/wal[_-]?test1|blob\s*id|blobid|walrus[_\s-]?blob/.test(normalized)) {
    return "wal-test1";
  }
  return sessions.get(sessionKey) || "walrus-researcher";
}

function stripDelegationPrefix(request, agentId) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) return request;
  return request
    .replace(new RegExp(escapeRegExp(agent.id), "ig"), "")
    .replace(new RegExp(escapeRegExp(agent.name), "ig"), "")
    .replace(new RegExp(escapeRegExp(agent.handle), "ig"), "")
    .replace(/에게|한테|으로|로|한\s*번|좀|부탁해|해줘|라고\s*해|만들어달라고\s*해/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || request;
}

function defaultHireReceiptFor(agentId) {
  return localSealedExampleRecords[agentId] ? "hire_receipt_local_paid_demo" : undefined;
}

function httpMcpSessionKey(session) {
  return `oauth:${session.hirerId}:${session.clientId}`;
}

function mcpTextResult(value) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function rpcResult(id, value) {
  return { jsonrpc: "2.0", id, result: value };
}

function rpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
}

function normalizeRedirectUris(value) {
  const list = Array.isArray(value) ? value : [value].filter(Boolean);
  return list
    .map((item) => String(item || "").trim())
    .filter((item) => {
      try {
        const parsed = new URL(item);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    });
}

function isLocalRedirectUri(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function readOAuthLoginSession(req) {
  const sessionId = readOAuthSessionCookie(req);
  const session = sessionId && (await getOAuthLoginSession(sessionId));
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    oauthLoginSessions.delete(sessionId);
    await deleteStoredOAuthLoginSession(sessionId);
    return null;
  }
  return session;
}

function readOAuthSessionCookie(req) {
  const cookies = parseCookies(req);
  return cookies.hireme_web_session || cookies.hireme_oauth_session || null;
}

function redirectToWebLogin(req, res, returnTo) {
  const loginUrl = new URL("/login", webAppBaseUrl(req));
  loginUrl.searchParams.set("return_to", returnTo);
  res.statusCode = 302;
  res.setHeader("location", loginUrl.toString());
  res.end();
}

function webAppBaseUrl(req) {
  return (
    process.env.HIREME_WEB_APP_URL ||
    process.env.VITE_HIREME_WEB_APP_URL ||
    req.headers["x-hireme-web-origin"] ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

async function verifySupabaseUserAccessToken(accessToken) {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !anonKey) {
    throw Object.assign(
      new Error("Supabase URL and anon key are required for web login sessions"),
      {
        statusCode: 500,
        code: "supabase_auth_not_configured",
      },
    );
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw Object.assign(new Error("Invalid Supabase user access token"), {
      statusCode: 401,
      code: "invalid_supabase_session",
    });
  }
  return data.user;
}

async function upsertSupabaseProfileForOAuthUser(
  user,
  { suiAddress, displayName } = {},
) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const explicitDisplayName = normalizeDisplayName(displayName);
  const resolvedDisplayName =
    explicitDisplayName ||
    normalizeDisplayName(user.user_metadata?.hireme_display_name) ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    user.id;
  const profile = {
    id: user.id,
    display_name: resolvedDisplayName,
    updated_at: new Date().toISOString(),
    wallet_metadata: {
      authProvider:
        user.app_metadata?.provider ||
        user.app_metadata?.providers?.[0] ||
        "supabase",
    },
  };
  if (suiAddress) {
    profile.sui_address = suiAddress;
    profile.zklogin_provider = "enoki_google";
    profile.zklogin_subject = user.user_metadata?.provider_id || user.id;
    profile.zklogin_last_connected_at = new Date().toISOString();
    profile.wallet_metadata.suiAddressSource = "enoki";
  }

  try {
    const { data, error } = await admin
      .from("profiles")
      .upsert(profile, { onConflict: "id" })
      .select("id, display_name, sui_address")
      .single();
    if (error) return null;

    if (suiAddress || explicitDisplayName) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          ...(explicitDisplayName
            ? { hireme_display_name: explicitDisplayName }
            : {}),
          ...(suiAddress ? { sui_address: suiAddress } : {}),
        },
      });
    }

    return data;
  } catch {
    return null;
  }
}

async function linkSuiWallet(args = {}) {
  const accessToken = String(args.access_token || args.accessToken || "");
  const suiAddress = normalizeSuiAddress(
    args.sui_address || args.suiAddress || args.wallet_address || args.walletAddress,
  );
  if (!accessToken) {
    throw Object.assign(new Error("access_token is required"), {
      statusCode: 400,
      code: "bad_request",
    });
  }
  if (!suiAddress) {
    throw Object.assign(new Error("valid sui_address is required"), {
      statusCode: 400,
      code: "bad_sui_address",
    });
  }

  const user = await verifySupabaseUserAccessToken(accessToken);
  const profile = await upsertSupabaseProfileForOAuthUser(user, {
    suiAddress,
    displayName: args.display_name || args.displayName || args.name,
  });
  const email = user.email || user.user_metadata?.email || user.id;
  const hirerId = normalizeHirerId(email);
  for (const session of oauthLoginSessions.values()) {
    if (session.hirerId === hirerId || session.subject === `supabase:${user.id}`) {
      session.suiAddress = suiAddress;
      await persistOAuthLoginSession(session);
    }
  }

  return {
    gatewayCall: true,
    linked: true,
    hirerId,
    email,
    suiAddress: profile?.sui_address || suiAddress,
  };
}

async function persistOAuthClient(client) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { error } = await admin.from("oauth_mcp_clients").upsert(
      {
        client_id: client.clientId,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod || "none",
        metadata: {
          autoRegistered: client.autoRegistered === true,
        },
      },
      { onConflict: "client_id" },
    );
    return error ? null : client;
  } catch {
    return null;
  }
}

async function readStoredOAuthClient(clientId) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("oauth_mcp_clients")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error || !data) return null;
    const client = {
      clientId: data.client_id,
      clientName: data.client_name,
      redirectUris: Array.isArray(data.redirect_uris) ? data.redirect_uris : [],
      tokenEndpointAuthMethod: data.token_endpoint_auth_method || "none",
      createdAt: data.created_at,
      autoRegistered: data.metadata?.autoRegistered === true,
    };
    oauthClients.set(client.clientId, client);
    return client;
  } catch {
    return null;
  }
}

async function persistOAuthLoginSession(session) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { error } = await admin.from("oauth_mcp_login_sessions").upsert(
      {
        session_id: session.id,
        provider: session.provider,
        subject: session.subject,
        email: session.email,
        display_name: session.name,
        hirer_identity: session.hirerId,
        sui_address: session.suiAddress || null,
        expires_at: new Date(session.expiresAt).toISOString(),
      },
      { onConflict: "session_id" },
    );
    return error ? null : session;
  } catch {
    return null;
  }
}

async function getOAuthLoginSession(sessionId) {
  const memorySession = oauthLoginSessions.get(sessionId);
  if (memorySession) return memorySession;
  const storedSession = await readStoredOAuthLoginSession(sessionId);
  if (storedSession) oauthLoginSessions.set(storedSession.id, storedSession);
  return storedSession;
}

async function readStoredOAuthLoginSession(sessionId) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("oauth_mcp_login_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.session_id,
      provider: data.provider,
      subject: data.subject,
      email: data.email,
      name: data.display_name || data.email || data.subject,
      hirerId: data.hirer_identity,
      suiAddress: data.sui_address || null,
      expiresAt: Date.parse(data.expires_at),
    };
  } catch {
    return null;
  }
}

async function deleteStoredOAuthLoginSession(sessionId) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await admin
      .from("oauth_mcp_login_sessions")
      .delete()
      .eq("session_id", sessionId);
  } catch {
    // Persistence cleanup is best-effort.
  }
}

async function persistOAuthAuthorizationCode(record) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { error } = await admin.from("oauth_mcp_authorization_codes").upsert(
      {
        code: record.code,
        client_id: record.clientId,
        redirect_uri: record.redirectUri,
        scope: record.scope,
        resource: record.resource,
        code_challenge: record.codeChallenge,
        code_challenge_method: record.codeChallengeMethod,
        subject: record.subject,
        email: record.email,
        hirer_identity: record.hirerId,
        sui_address: record.suiAddress || null,
        expires_at: new Date(record.expiresAt).toISOString(),
      },
      { onConflict: "code" },
    );
    return error ? null : record;
  } catch {
    return null;
  }
}

async function readStoredOAuthAuthorizationCode(code) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("oauth_mcp_authorization_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error || !data) return null;
    const record = {
      code: data.code,
      clientId: data.client_id,
      redirectUri: data.redirect_uri,
      scope: data.scope,
      resource: data.resource,
      codeChallenge: data.code_challenge,
      codeChallengeMethod: data.code_challenge_method || "plain",
      subject: data.subject,
      email: data.email,
      hirerId: data.hirer_identity,
      suiAddress: data.sui_address || null,
      createdAt: Date.parse(data.created_at),
      expiresAt: Date.parse(data.expires_at),
    };
    oauthCodes.set(record.code, record);
    return record;
  } catch {
    return null;
  }
}

async function deleteStoredOAuthAuthorizationCode(code) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await admin
      .from("oauth_mcp_authorization_codes")
      .delete()
      .eq("code", code);
  } catch {
    // Persistence cleanup is best-effort.
  }
}

async function persistOAuthAccessToken(accessToken, session) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { error } = await admin.from("oauth_mcp_access_tokens").upsert(
      {
        token_hash: oauthTokenHash(accessToken),
        client_id: session.clientId,
        subject: session.subject,
        email: session.email,
        hirer_identity: session.hirerId,
        sui_address: session.suiAddress || null,
        scope: session.scope,
        resource: session.resource,
        expires_at: new Date(session.expiresAt).toISOString(),
      },
      { onConflict: "token_hash" },
    );
    return error ? null : session;
  } catch {
    return null;
  }
}

async function readStoredOAuthAccessToken(accessToken) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("oauth_mcp_access_tokens")
      .select("*")
      .eq("token_hash", oauthTokenHash(accessToken))
      .maybeSingle();
    if (error || !data) return null;
    return {
      accessToken: null,
      clientId: data.client_id,
      subject: data.subject,
      email: data.email,
      hirerId: data.hirer_identity,
      suiAddress: data.sui_address || null,
      scope: data.scope,
      resource: data.resource,
      createdAt: Date.parse(data.created_at),
      expiresAt: Date.parse(data.expires_at),
    };
  } catch {
    return null;
  }
}

async function touchStoredOAuthAccessToken(accessToken) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await admin
      .from("oauth_mcp_access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token_hash", oauthTokenHash(accessToken));
  } catch {
    // Last-used telemetry is best-effort.
  }
}

async function deleteStoredOAuthAccessToken(accessToken) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await admin
      .from("oauth_mcp_access_tokens")
      .delete()
      .eq("token_hash", oauthTokenHash(accessToken));
  } catch {
    // Persistence cleanup is best-effort.
  }
}

function oauthTokenHash(accessToken) {
  return `sha256:${sha256Hex(`oauth-token:${accessToken}`)}`;
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      cookies[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(
        part.slice(index + 1),
      );
      return cookies;
    }, {});
}

function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.HIREME_GOOGLE_CLIENT_ID &&
      process.env.HIREME_GOOGLE_CLIENT_SECRET,
  );
}

function isDemoOAuthLoginAllowed() {
  return process.env.HIREME_OAUTH_ALLOW_DEMO_LOGIN === "1";
}

function gatewayBaseUrl(req) {
  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    `localhost:${port}`;
  const protocol =
    req.headers["x-forwarded-proto"] ||
    (String(host).startsWith("localhost") || String(host).startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${protocol}://${host}`;
}

function randomOAuthId(prefix) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

function sha256Base64Url(value) {
  return createHash("sha256").update(value).digest("base64url");
}

function hiddenInput(name, value) {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value || "")}" />`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

async function grantAgentAccess(args = {}) {
  const agent = await findOrHydrateAgent(args.agent_id || args.agentId);
  const hirerId = readHirerId(args);
  const ownerSuiAddress =
    normalizeSuiAddress(
      args.sui_address || args.suiAddress || args.wallet_address || args.walletAddress,
    ) ||
    existingSuiAddressForHirer(hirerId) ||
    null;
  const accessType = args.access_type === "trial" ? "trial" : "hired";
  const now = new Date();
  const existing =
    (await readStoredAgentEntitlement(agent, hirerId)) ||
    agentEntitlements.get(entitlementKey(hirerId, agent.id));
  const trialCalls =
    accessType === "trial"
      ? Math.max(1, Math.trunc(readOptionalNumber(args.trial_calls, 3)))
      : null;
  const record = {
    id:
      existing?.id ||
      `access_${Date.now().toString(36)}_${sha256Hex(`${hirerId}:${agent.id}`).slice(0, 8)}`,
    hirerId,
    agentId: agent.id,
    status: "active",
    accessType,
    source: args.source || (accessType === "trial" ? "web_try" : "web_hire"),
    receiptObjectId:
      args.hire_receipt_object_id ||
      (existing?.accessType === accessType ? existing?.receiptObjectId : null) ||
      `hire_receipt_${accessType}_${sha256Hex(`${hirerId}:${agent.id}`).slice(0, 12)}`,
    trialCallsRemaining:
      accessType === "trial"
        ? Math.max(existing?.trialCallsRemaining ?? 0, trialCalls)
        : null,
    pricePerCallUsd: agent.pricePerCallUsd,
    ownerSuiAddress: ownerSuiAddress || existing?.ownerSuiAddress || null,
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt:
      accessType === "trial"
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null,
  };

  const storedRecord = await persistAgentEntitlement(record, agent);
  const finalRecord = storedRecord || record;
  agentEntitlements.set(entitlementKey(hirerId, agent.id), finalRecord);

  return {
    gatewayCall: true,
    status: accessType === "trial" ? "trial_ready" : "hired",
    access: publicEntitlement(finalRecord),
    agent: publicAgent(agent),
    codex: codexCallHint(finalRecord, agent),
  };
}

async function listMyAgents(args = {}) {
  const hirerId = readHirerId(args);
  const storedRecords = await listStoredAgentEntitlements(hirerId);
  const recordsByKey = new Map();

  for (const record of storedRecords) {
    recordsByKey.set(entitlementKey(record.hirerId, record.agentId), record);
    agentEntitlements.set(entitlementKey(record.hirerId, record.agentId), record);
  }

  for (const record of agentEntitlements.values()) {
    if (record.hirerId !== hirerId || record.status !== "active") continue;
    const key = entitlementKey(record.hirerId, record.agentId);
    if (!recordsByKey.has(key)) {
      recordsByKey.set(key, record);
    }
  }

  const records = [];
  for (const record of recordsByKey.values()) {
    if (record.status !== "active") continue;
    try {
      const agent = await findOrHydrateAgent(record.agentId);
      records.push({
        ...publicEntitlement(record),
        agent: publicAgent(agent),
        codex: codexCallHint(record, agent),
      });
    } catch {
      // Skip stale entitlement rows whose Agent was archived or removed.
    }
  }

  records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    gatewayCall: true,
    hirerId,
    count: records.length,
    agents: records,
  };
}

function gatewayWhoami(args = {}) {
  const hirerId = readHirerId(args);
  return {
    gatewayCall: true,
    auth: {
      mode: apiKey ? "gateway_api_key" : "local_open_gateway",
      authenticated: true,
      apiKeyReturned: false,
      emailAvailable: false,
      reason:
        "This /v1/whoami path is used by the local stdio plugin. Use the OAuth HTTP MCP server hireme to get a Google-backed email identity.",
    },
    user: {
      hirerId,
      email: args.email || null,
      walletAddress: args.wallet_address || args.walletAddress || args.wallet || null,
      suiAddress:
        normalizeSuiAddress(
          args.sui_address || args.suiAddress || args.wallet_address || args.walletAddress,
        ) || null,
    },
    codex: {
      mcpServer: "hireme",
      recommendedMcpServerForGoogleIdentity: "hireme",
      installationId: args.codex_installation_id || defaultInstallationId,
      activeAgentId:
        sessions.get(args.codex_installation_id || defaultInstallationId) ||
        "walrus-researcher",
    },
    gateway: {
      url: args.gateway_url || null,
      supabaseConfigured: Boolean(createSupabaseAdminClient()),
    },
  };
}

async function runProtectedAgent(args = {}) {
  const installationId = args.codex_installation_id || defaultInstallationId;
  const agentId = args.agent_id || sessions.get(installationId) || "walrus-researcher";
  const agent = await findOrHydrateAgent(agentId);
  const artifact = protectedArtifacts.get(agent.id);
  const budgetCalls = args.budget_calls || 1;
  const hirerId = readHirerId(args);
  const hireReceiptObjectId =
    args.hire_receipt_object_id || args.hireReceiptObjectId || null;
  const access = await authorizeAgentCall({
    agent,
    hirerId,
    budgetCalls,
    hireReceiptObjectId,
  });
  const sealedTaskResult = localSealedExampleRecords[agent.id]
    ? await runSealedArtifactTask({
        recordPath: args.record_path || localSealedExampleRecords[agent.id],
        walrusPath: args.walrus_path,
        hireReceiptObjectId: hireReceiptObjectId || access.receiptObjectId,
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
  const sealEncryption =
    sealedTaskResult?.sealEncryption || {
      provider: artifact.encryptionProvider || artifact.sealProvider || "registered-metadata",
      ciphertextFormat: artifact.ciphertextFormat || artifact.sealCiphertextFormat || "pending",
      packageId: artifact.sealPackageId || null,
      sealApproveTarget: artifact.sealApproveTarget || null,
      policyId: artifact.policyId || artifact.sealPolicyId,
      encryptionId: artifact.sealEncryptionId,
      threshold: artifact.sealThreshold || null,
      keyServerIds: artifact.sealKeyServerIds || [],
      platformKmsKeyId: artifact.platformKmsKeyId || null,
      plaintextInWalrus: agent.id === "wal-test1",
    };
  const responseDigest = `sha256:${sha256Hex(JSON.stringify(safeResult))}`;
  const jsonOutput =
    sealedTaskResult?.jsonOutput ||
    buildGatewayJsonOutput({
      agent,
      task: args.task || "",
      budgetCalls,
      requestDigest,
      responseDigest,
      payload: safeResult,
    });
  const userMemWalResult = await writeUserMemWalResult({
    agentId: agent.id,
    hirerId,
    callId,
    requestDigest,
    responseDigest,
    hireReceiptObjectId: hireReceiptObjectId || access.receiptObjectId,
    result: safeResult,
    jsonOutput,
  });
  const ledgerEvent = {
    callId,
    table: "mcp_call_ledger",
    status: "mock_recorded",
    hireId: "local-hire",
    agentId: agent.id,
    creator: agent.creator,
    hirerId,
    accessId: access.id,
    accessType: access.accessType,
    requestDigest,
    responseDigest,
    userMemWalResultDigest: userMemWalResult.publicRecord.ciphertextDigest,
    userMemWalResultId: userMemWalResult.publicRecord.callId,
    billableCalls: 1,
    amountUsd: agent.pricePerCallUsd,
    latencyMs: agent.latencyMs,
    rawPromptStored: false,
    rawResponseStored: false,
    resultStoredInUserMemWal: true,
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
    userMemWal: {
      stored: true,
      kind: userMemWalResult.publicRecord.kind,
      visibility: userMemWalResult.publicRecord.visibility,
      hirerId: userMemWalResult.publicRecord.hirerId,
      recordPath: userMemWalResult.recordPath,
      ciphertextDigest: userMemWalResult.publicRecord.ciphertextDigest,
      plaintextStoredInDb: false,
      creatorCanReadPlaintext: false,
      publicCanReadPlaintext: false,
      safeSummary: userMemWalResult.publicRecord.safeSummary,
    },
    authorization: {
      hireVerified: true,
      accessId: access.id,
      accessType: access.accessType,
      receiptObjectId: access.receiptObjectId,
      trialCallsRemaining: access.trialCallsRemaining,
      budgetApproved: budgetCalls <= 100,
      sealPolicyApproved: true,
      platformAccessApproved: true,
      gatewayTrustedExecutor: true,
      mode: sealedTaskResult ? "trusted-gateway-protected-artifact" : "local-mock",
    },
    sealedArtifact: {
      network: artifact.network,
      encryptionProvider: sealEncryption.provider || artifact.encryptionProvider,
      platformKmsKeyId:
        sealEncryption.platformKmsKeyId || artifact.platformKmsKeyId || null,
      ciphertextFormat:
        sealEncryption.ciphertextFormat || artifact.ciphertextFormat || artifact.sealCiphertextFormat,
      policyId: sealEncryption.policyId || artifact.policyId || artifact.sealPolicyId,
      sealProvider: sealEncryption.provider,
      sealPolicyId: sealEncryption.policyId || artifact.sealPolicyId,
      sealEncryptionId: sealEncryption.encryptionId || artifact.sealEncryptionId,
      sealPackageId: sealEncryption.packageId || artifact.sealPackageId,
      sealApproveTarget: sealEncryption.sealApproveTarget || artifact.sealApproveTarget,
      sealCiphertextFormat: sealEncryption.ciphertextFormat || artifact.sealCiphertextFormat,
      sealThreshold: sealEncryption.threshold || artifact.sealThreshold || null,
      sealKeyServerIds: sealEncryption.keyServerIds || artifact.sealKeyServerIds || [],
      walrusBlobId:
        sealedTaskResult?.harness?.artifact?.walrusBlobId || artifact.walrusBlobId,
      ciphertextDigest:
        sealedTaskResult?.harness?.artifact?.ciphertextDigest || artifact.ciphertextDigest,
      plaintextInWalrus: sealEncryption.plaintextInWalrus === true,
    },
    sealEncryption,
    runner: {
      executionMode: sealedTaskResult
        ? "trusted-gateway-protected-folder-runner"
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
    jsonOutput,
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

function buildGatewayJsonOutput({
  agent,
  task,
  budgetCalls,
  requestDigest,
  responseDigest,
  payload,
}) {
  return {
    schema: "hireme.protected_agent_json_output.v1",
    type: payload.type || "protected_agent_guidance",
    generatedBy: "hireme-gateway",
    executionMode: "trusted-gateway-mvp",
    agent: {
      id: agent.id,
      name: agent.name,
      publicContract: agent.publicContract,
    },
    input: {
      task,
      taskDigest: `sha256:${sha256Hex(task)}`,
      budgetCalls,
      plaintextTaskVisibleToGateway: true,
    },
    harness: {
      publicContract: agent.publicContract,
      protectedAssetClasses: agent.hiddenAssetClasses,
      appliedPrivateReferences: {
        localSealedBundle: false,
      },
      rawHarnessReturned: false,
      rawAgentsReturned: false,
      rawSkillsReturned: false,
    },
    payload,
    localCodex: {
      shouldAct: true,
      instruction:
        "Use jsonOutput.payload as the Agent guidance for local workspace changes. Keep creator internals out of prompts, logs, and responses.",
      preferredSource: "jsonOutput.payload",
      blockedSources: ["AGENTS.md", "skills/**", "harness/**", "private prompts"],
    },
    proof: {
      gatewayTrustedExecutor: true,
      requestDigest,
      responseDigest,
      privateFolderReturnedToCodex: false,
    },
  };
}

function prepareSealedHarnessUpload(args = {}) {
  const epochs = args.epochs || 3;
  const agentId = args.agent_id || "new-agent";
  return {
    gatewayCall: true,
    agentId,
    expectedFolderShape: ["AGENTS.md", "skills/**", "optional adapters/**"],
    visibilityBoundary:
      "The creator folder is encrypted before Walrus upload. Hirer Codex receives only metadata and safe execution results.",
    platformEncryptionDemo: {
      command: "node scripts/seal-example-agent.mjs <agent-folder>",
      ciphertextFormat: "hireme.platform-ciphertext-envelope.v1",
      provider: "platform-managed-envelope",
      kmsKeyId: process.env.HIREME_PLATFORM_KMS_KEY_ID || "platform:local-dev-key",
      packageId: process.env.HIREME_SEAL_PACKAGE_ID || null,
      sealApproveTarget:
        process.env.HIREME_SEAL_APPROVE_TARGET ||
        (process.env.HIREME_SEAL_PACKAGE_ID
          ? `${process.env.HIREME_SEAL_PACKAGE_ID}::access::seal_approve`
          : null),
      walrusPath: ".hireme/local-walrus/<blob>.seal.json",
      note:
        "Local MVP uses platform-managed encryption with AES-GCM DEM. The plaintext folder is never written to Walrus or public metadata.",
    },
    localSealDemo: {
      compatibility: true,
      note: "Legacy response key kept for old clients. Use platformEncryptionDemo for the MVP provider.",
    },
    productionEncryptionSteps: [
      "Bundle the creator folder into bytes.",
      "Encrypt the bytes with the platform KMS provider. Optional later Seal mode can replace this provider.",
      `Store only the encrypted object on Walrus for ${epochs} epoch(s).`,
      "Register only public metadata in Supabase/Sui: provider, encryption id, Walrus blob id, object id, digest, price.",
      "At call time, the gateway verifies the paid hire receipt and decrypts inside the runner.",
    ],
    publicMetadataToRegister: [
      "encryption_provider",
      "platform_kms_key_id",
      "ciphertext_format",
      "policy_id",
      "seal_policy_id",
      "seal_package_id",
      "seal_approve_target",
      "seal_encryption_id",
      "walrus_blob_id",
      "sui_object_id",
      "ciphertext_digest",
      "seal_threshold",
      "seal_key_server_ids",
      "price_per_call_usd",
    ],
  };
}

async function registerAgentFromMcp(args = {}) {
  rejectPlaintextRegistrationFields(args);

  const requiredFields = [
    "agent_id",
    "name",
    "creator",
    "category",
    "headline",
    "public_summary",
    "public_mcp_contract",
    "skills",
    "price_per_call_usd",
    "walrus_blob_id",
    "sui_object_id",
    "ciphertext_digest",
  ];
  const missing = requiredFields.filter((field) => {
    const value = args[field];
    return value === undefined || value === null || value === "" ||
      (Array.isArray(value) && value.length === 0);
  });

  if (missing.length) {
    throw Object.assign(
      new Error(`Missing required registration field(s): ${missing.join(", ")}`),
      {
        statusCode: 400,
        code: "bad_request",
        requiredFields,
      },
    );
  }

  const agentId = normalizeSlug(args.agent_id, "agent");
  const pricePerCallUsd = readNonNegativeNumber(
    args.price_per_call_usd,
    "price_per_call_usd",
  );
  const skills = normalizeStringList(args.skills);
  if (!skills.length) {
    throw Object.assign(new Error("skills must include at least one public skill label"), {
      statusCode: 400,
      code: "bad_request",
    });
  }
  const hiddenAssetClasses =
    normalizeStringList(args.protected_asset_classes || args.protected_assets)
      .length > 0
      ? normalizeStringList(args.protected_asset_classes || args.protected_assets)
      : ["AGENTS.md", "skills/**", "harness/**", "private prompts"];
  const publicContract = String(args.public_mcp_contract).trim();
  const now = new Date().toISOString();

  const agent = {
    id: agentId,
    name: String(args.name).trim(),
    handle: normalizeHandle(args.handle, agentId),
    creator: String(args.creator).trim(),
    category: normalizeDisplayCategory(args.category),
    status: normalizeDisplayStatus(args.status),
    headline: String(args.headline).trim(),
    publicSummary: String(args.public_summary).trim(),
    publicContract,
    memwalPolicy:
      String(args.memwal_policy || "").trim() ||
      "Hirer-visible results are stored in hirer-scoped memWal records. Creator private files stay behind the gateway.",
    skills,
    hiddenAssetClasses,
    pricePerCallUsd,
    freeCalls: 0,
    rating: readOptionalNumber(args.rating, 0),
    calls: Math.max(0, Math.trunc(readOptionalNumber(args.historical_calls, 0))),
    latencyMs: Math.max(0, Math.trunc(readOptionalNumber(args.median_latency_ms, 0))),
  };

  upsertLocalAgent(agent);

  const artifact = {
    agentId,
    network:
      args.storage_network ||
      (process.env.WALRUS_NETWORK === "mainnet" ? "walrus-mainnet" : "walrus-testnet"),
    encryptionProvider: args.encryption_provider || "platform-managed-envelope",
    platformKmsKeyId:
      args.platform_kms_key_id ||
      process.env.HIREME_PLATFORM_KMS_KEY_ID ||
      "platform:local-dev-key",
    ciphertextFormat:
      args.ciphertext_format || "hireme.platform-ciphertext-envelope.v1",
    policyId: args.policy_id || args.seal_policy_id || `platform:agent:${agentId}`,
    sealPolicyId: args.seal_policy_id || args.policy_id || `platform:agent:${agentId}`,
    sealPackageId: args.seal_package_id || process.env.HIREME_SEAL_PACKAGE_ID || null,
    sealApproveTarget:
      args.seal_approve_target ||
      (args.seal_package_id || process.env.HIREME_SEAL_PACKAGE_ID
        ? `${args.seal_package_id || process.env.HIREME_SEAL_PACKAGE_ID}::access::seal_approve`
        : null),
    sealEncryptionId:
      args.seal_encryption_id || `hireme::agent-folder::${agentId}`,
    sealThreshold: args.seal_threshold || readPlatformThreshold(),
    sealKeyServerIds: args.seal_key_server_ids || readSealKeyServerIds(),
    walrusBlobId: String(args.walrus_blob_id).trim(),
    suiObjectId: String(args.sui_object_id).trim(),
    ciphertextDigest: String(args.ciphertext_digest).trim(),
    folderManifestDigest: args.folder_manifest_digest || null,
    pricePerCallUsd,
    visibility:
      "The hirer's Codex receives public metadata and safe results only. The gateway runner loads the protected Agent folder after access approval.",
    registeredAt: now,
  };

  protectedArtifacts.set(agentId, artifact);

  const supabase = await persistRegisteredAgentToSupabase({
    agent,
    artifact,
    args,
  });

  return {
    gatewayCall: true,
    status: "registered",
    registrationMode: "paid_protected_agent",
    registeredAt: now,
    publicAgent: publicAgent(agent),
    protectedArtifact: artifact,
    pricing: {
      unit: "mcp_call",
      display: `$${pricePerCallUsd.toFixed(3)}/call`,
      pricePerCallUsd,
      freeCalls: 0,
    },
    mcpPackage: `mcp://hireme/${agentId}`,
    storedPlaintextHarness: false,
    returnedCreatorSecrets: false,
    supabase,
    nextSteps: [
      "Call hireme_list_hired_agents to confirm the gateway registry entry.",
      "Open /agents or run npm run supabase:smoke when Supabase persistence is enabled.",
      "Call hireme_call_agent with the new agent_id after a paid hire receipt exists.",
    ],
  };
}

function registerSealedHarness(args = {}) {
  for (const field of [
    "agent_id",
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
    encryptionProvider: args.encryption_provider || "platform-managed-envelope",
    platformKmsKeyId: args.platform_kms_key_id || process.env.HIREME_PLATFORM_KMS_KEY_ID || "platform:local-dev-key",
    ciphertextFormat: args.ciphertext_format || "hireme.platform-ciphertext-envelope.v1",
    policyId: args.policy_id || args.seal_policy_id || `platform:agent:${args.agent_id}`,
    sealPolicyId: args.seal_policy_id || args.policy_id || `platform:agent:${args.agent_id}`,
    sealPackageId: args.seal_package_id || process.env.HIREME_SEAL_PACKAGE_ID || null,
    sealApproveTarget:
      args.seal_approve_target ||
      (args.seal_package_id || process.env.HIREME_SEAL_PACKAGE_ID
        ? `${args.seal_package_id || process.env.HIREME_SEAL_PACKAGE_ID}::access::seal_approve`
        : null),
    sealEncryptionId: args.seal_encryption_id || null,
    sealThreshold: args.seal_threshold || null,
    sealKeyServerIds: args.seal_key_server_ids || [],
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

async function persistRegisteredAgentToSupabase({ agent, artifact, args }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      status: "skipped",
      reason: "SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.",
    };
  }

  try {
    const creatorUser = await findOrCreateGatewayCreatorUser(admin, agent.creator);
    await supabaseMust(
      admin.from("profiles").upsert(
        {
          id: creatorUser.id,
          display_name: agent.creator,
          username: normalizeSlug(`${agent.creator}-mcp`, "creator-mcp"),
          avatar_url: null,
        },
        { onConflict: "id" },
      ),
      `upsert profile for ${agent.creator}`,
    );

    const teamRow = await upsertOptionalAgentTeam({
      admin,
      ownerId: creatorUser.id,
      agent,
      args,
    });

    const agentRow = await supabaseMustSingle(
      admin
        .from("agents")
        .upsert(
          {
            creator_id: creatorUser.id,
            team_id: teamRow?.id || null,
            team_role: String(args.team_role || "Specialist").trim(),
            listed_individually: args.listed_individually !== false,
            slug: agent.id,
            name: agent.name,
            handle: agent.handle,
            category: toDbCategory(agent.category),
            status: toDbStatus(agent.status),
            headline: agent.headline,
            public_summary: agent.publicSummary,
            public_skills: agent.skills,
            public_mcp_contract: agent.publicContract,
            accent: args.accent || null,
            rating: agent.rating,
            historical_calls: agent.calls,
            median_latency_ms: agent.latencyMs || null,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single(),
      `upsert agent ${agent.id}`,
    );

    const versionNumber = Math.max(
      1,
      Math.trunc(readOptionalNumber(args.version_number, 1)),
    );
    const versionRow = await supabaseMustSingle(
      admin
        .from("agent_versions")
        .upsert(
          {
            agent_id: agentRow.id,
            version_number: versionNumber,
            status: "published",
            public_mcp_contract: agent.publicContract,
            release_notes:
              args.release_notes || "Registered through HireMe MCP.",
            artifact_manifest: {
              publicSkills: agent.skills,
              protectedAssetClasses: agent.hiddenAssetClasses,
              registeredVia: "hireme_register_agent",
            },
            created_by: creatorUser.id,
            published_at: new Date().toISOString(),
          },
          { onConflict: "agent_id,version_number" },
        )
        .select("id")
        .single(),
      `upsert agent version for ${agent.id}`,
    );

    await supabaseMust(
      admin
        .from("agents")
        .update({ current_version_id: versionRow.id })
        .eq("id", agentRow.id),
      `set current version for ${agent.id}`,
    );

    await supabaseMust(
      admin.from("protected_artifacts").upsert(
        {
          agent_id: agentRow.id,
          agent_version_id: versionRow.id,
          kind: "agent_folder",
          network: artifact.network,
          seal_policy_id: artifact.sealPolicyId,
          seal_encryption_id: artifact.sealEncryptionId,
          walrus_blob_id: artifact.walrusBlobId,
          walrus_sui_object_id: artifact.suiObjectId,
          ciphertext_digest: artifact.ciphertextDigest,
          folder_manifest_digest: artifact.folderManifestDigest,
          metadata: {
            visibility: artifact.visibility,
            protectedAssetClasses: agent.hiddenAssetClasses,
            encryptionProvider: artifact.encryptionProvider,
            ciphertextFormat: artifact.ciphertextFormat,
            platformKmsKeyId: artifact.platformKmsKeyId,
            registeredVia: "hireme_register_agent",
          },
          created_by: creatorUser.id,
        },
        { onConflict: "agent_version_id,kind" },
      ),
      `upsert protected artifact for ${agent.id}`,
    );

    await supabaseMust(
      admin.from("agent_pricing").delete().eq("agent_id", agentRow.id),
      `clear pricing for ${agent.id}`,
    );

    await supabaseMust(
      admin.from("agent_pricing").insert({
        agent_id: agentRow.id,
        agent_version_id: versionRow.id,
        billing_unit: "mcp_call",
        price_per_mcp_call_usd: agent.pricePerCallUsd,
        free_calls: 0,
        max_budget_calls: Math.max(
          1,
          Math.trunc(readOptionalNumber(args.max_budget_calls, 100)),
        ),
        active: true,
      }),
      `insert pricing for ${agent.id}`,
    );

    return {
      status: "upserted",
      agentRowId: agentRow.id,
      agentVersionRowId: versionRow.id,
      teamRowId: teamRow?.id || null,
    };
  } catch (err) {
    return {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function upsertOptionalAgentTeam({ admin, ownerId, agent, args }) {
  if (!args.team_id && !args.team_name && !args.team_handle) {
    return null;
  }

  const teamSlug = normalizeSlug(args.team_id || args.team_slug || `${agent.id}-team`, "team");
  const teamName = String(args.team_name || `${agent.name} Team`).trim();
  const teamHandle = normalizeHandle(args.team_handle, `teams/${teamSlug}`);
  const teamSummary =
    String(args.team_public_summary || "").trim() ||
    `A paid team that routes MCP calls to ${agent.name} and related specialists.`;

  const teamRow = await supabaseMustSingle(
    admin
      .from("agent_teams")
      .upsert(
        {
          owner_id: ownerId,
          slug: teamSlug,
          name: teamName,
          handle: teamHandle,
          status: toDbStatus(agent.status),
          headline: String(args.team_headline || `${teamName} protected agents`).trim(),
          public_summary: teamSummary,
          public_skills: agent.skills,
          accent: args.team_accent || args.accent || null,
          rating: agent.rating,
          historical_calls: agent.calls,
          median_latency_ms: agent.latencyMs || null,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single(),
    `upsert team ${teamSlug}`,
  );

  await supabaseMust(
    admin.from("agent_team_pricing").delete().eq("team_id", teamRow.id),
    `clear team pricing for ${teamSlug}`,
  );

  await supabaseMust(
    admin.from("agent_team_pricing").insert({
      team_id: teamRow.id,
      billing_unit: "per_agent",
      base_price_usd: 0,
      included_calls: 0,
      overage_price_per_call_usd: agent.pricePerCallUsd,
      billing_note: `$${agent.pricePerCallUsd.toFixed(3)}/call through the executing agent ledger.`,
      active: true,
    }),
    `insert team pricing for ${teamSlug}`,
  );

  return teamRow;
}

function createSupabaseAdminClient() {
  const supabaseUrl = (
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findOrCreateGatewayCreatorUser(admin, creator) {
  const email = `${normalizeSlug(creator, "creator")}@hireme.mcp`;
  const existing = await findGatewayUserByEmail(admin, email);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: creator },
  });

  if (error) {
    const retryExisting = await findGatewayUserByEmail(admin, email);
    if (retryExisting) return retryExisting;
    throw new Error(`create auth user for ${creator}: ${error.message}`);
  }

  return data.user;
}

async function findGatewayUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      throw new Error(`list auth users: ${error.message}`);
    }
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function supabaseMust(builder, label) {
  const { error } = await builder;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

async function supabaseMustSingle(builder, label) {
  const { data, error } = await builder;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

function upsertLocalAgent(agent) {
  const index = agents.findIndex((item) => item.id === agent.id);
  if (index === -1) {
    agents.push(agent);
    return;
  }
  agents[index] = {
    ...agents[index],
    ...agent,
  };
}

function rejectPlaintextRegistrationFields(args) {
  const blockedFields = [
    "plaintext",
    "agents_md",
    "agentsMd",
    "skills_source",
    "skillsSource",
    "harness_source",
    "harnessSource",
    "private_prompt",
    "privatePrompt",
    "backup_key",
    "backupKey",
  ];
  const found = blockedFields.filter((field) => args[field] !== undefined);
  if (found.length) {
    throw Object.assign(
      new Error(
        `Do not send creator plaintext through MCP registration: ${found.join(", ")}`,
      ),
      {
        statusCode: 400,
        code: "plaintext_registration_rejected",
      },
    );
  }
}

function normalizeDisplayCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const categories = {
    research: "Research",
    code: "Code",
    data: "Data",
    security: "Security",
    growth: "Growth",
    ops: "Ops",
  };
  return categories[normalized] || "Ops";
}

function normalizeDisplayStatus(value) {
  const normalized = String(value || "Available").trim().toLowerCase();
  if (["private_beta", "private beta", "beta"].includes(normalized)) {
    return "Private Beta";
  }
  if (["busy", "paused"].includes(normalized)) return "Busy";
  return "Available";
}

function toDbCategory(category) {
  return String(category || "other").toLowerCase().replace(/\s+/g, "_");
}

function toDbStatus(status) {
  if (status === "Private Beta") return "private_beta";
  if (status === "Busy") return "paused";
  return "listed";
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to comma-separated parsing.
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSlug(value, fallback) {
  const slug = String(value || fallback || "agent")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64)
    .replace(/-+$/g, "");
  const safe = slug || fallback || "agent";
  if (safe.length >= 3) return safe;
  return `${safe}-agent`.slice(0, 64).replace(/-+$/g, "");
}

function normalizeHandle(value, fallbackSlug) {
  const raw = String(value || `@agents/${fallbackSlug}`).trim();
  const prefixed = raw.startsWith("@") ? raw : `@${raw}`;
  const handle = prefixed
    .toLowerCase()
    .replace(/[^@a-z0-9_./-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 81)
    .replace(/-+$/g, "");
  if (/^@[a-z0-9_./-]{2,80}$/.test(handle)) return handle;
  return `@agents/${normalizeSlug(fallbackSlug, "agent")}`.slice(0, 81);
}

function readNonNegativeNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw Object.assign(new Error(`${field} must be a non-negative number`), {
      statusCode: 400,
      code: "bad_request",
    });
  }
  return number;
}

function readOptionalNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function readStoredAgentEntitlement(agent, hirerId) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  try {
    const agentRow = await readSupabaseAgentRowBySlug(admin, agent.id);
    if (!agentRow) return null;

    const { data, error } = await admin
      .from("agent_entitlements")
      .select("*")
      .eq("agent_id", agentRow.id)
      .eq("hirer_identity", hirerId)
      .maybeSingle();

    if (error || !data) return null;
    return mapEntitlementRow(data, agent);
  } catch {
    return null;
  }
}

async function listStoredAgentEntitlements(hirerId) {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  try {
    const { data, error } = await admin
      .from("agent_entitlements")
      .select("*, agents!inner(slug)")
      .eq("hirer_identity", hirerId)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (error || !Array.isArray(data)) return [];

    const records = [];
    for (const row of data) {
      const agentSlug = row.agents?.slug || row.metadata?.agentSlug;
      if (!agentSlug) continue;
      try {
        const agent = await findOrHydrateAgent(agentSlug);
        records.push(mapEntitlementRow(row, agent));
      } catch {
        // Ignore stale entitlement rows for deleted or archived agents.
      }
    }
    return records;
  } catch {
    return [];
  }
}

async function persistAgentEntitlement(record, agent) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  try {
    const agentRow = await readSupabaseAgentRowBySlug(admin, agent.id);
    if (!agentRow) return null;

    const { data, error } = await admin
      .from("agent_entitlements")
      .upsert(
        {
          agent_id: agentRow.id,
          hirer_identity: record.hirerId,
          access_type: record.accessType,
          status: record.status,
          source: record.source || "gateway",
          receipt_object_id: record.receiptObjectId,
          trial_calls_remaining: record.trialCallsRemaining,
          price_per_call_usd: record.pricePerCallUsd,
          owner_sui_address: record.ownerSuiAddress || null,
          expires_at: record.expiresAt,
          metadata: {
            agentSlug: agent.id,
            codexTool: "hireme_call_agent",
            ownerSuiAddress: record.ownerSuiAddress || null,
          },
        },
        { onConflict: "agent_id,hirer_identity" },
      )
      .select("*")
      .single();

    if (error || !data) return null;
    return mapEntitlementRow(data, agent);
  } catch {
    return null;
  }
}

async function readSupabaseAgentRowBySlug(admin, agentId) {
  const slug = normalizeSlug(agentId, "agent");
  const { data, error } = await admin
    .from("agents")
    .select("id, slug, current_version_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

function mapEntitlementRow(row, agent) {
  return {
    id: row.id,
    hirerId: row.hirer_identity,
    agentId: agent.id,
    status: row.status === "active" ? "active" : row.status || "expired",
    accessType: row.access_type === "trial" ? "trial" : "hired",
    source: row.source || "gateway",
    receiptObjectId: row.receipt_object_id,
    trialCallsRemaining:
      row.trial_calls_remaining === null ||
      row.trial_calls_remaining === undefined
        ? null
        : Number(row.trial_calls_remaining),
    pricePerCallUsd: readOptionalNumber(
      row.price_per_call_usd,
      agent.pricePerCallUsd,
    ),
    ownerSuiAddress:
      row.owner_sui_address || row.metadata?.ownerSuiAddress || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    expiresAt: row.expires_at || null,
    storageSource: "supabase",
  };
}

async function authorizeAgentCall({
  agent,
  hirerId,
  budgetCalls,
  hireReceiptObjectId,
}) {
  if (String(hireReceiptObjectId || "").startsWith("hire_receipt_local_paid_demo")) {
    return {
      id: "local-paid-demo",
      hirerId,
      agentId: agent.id,
      accessType: "demo_receipt",
      receiptObjectId: hireReceiptObjectId,
      trialCallsRemaining: null,
    };
  }

  const record =
    (await readStoredAgentEntitlement(agent, hirerId)) ||
    agentEntitlements.get(entitlementKey(hirerId, agent.id));
  if (!record || record.status !== "active") {
    throw Object.assign(
      new Error(
        `No active Try/Hire entitlement for agent_id=${agent.id} and hirer_id=${hirerId}`,
      ),
      {
        statusCode: 402,
        code: "agent_access_required",
      },
    );
  }

  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
    record.status = "expired";
    record.updatedAt = new Date().toISOString();
    await persistAgentEntitlement(record, agent);
    agentEntitlements.set(entitlementKey(hirerId, agent.id), record);
    throw Object.assign(new Error(`Agent access expired for ${agent.id}`), {
      statusCode: 403,
      code: "agent_access_expired",
    });
  }

  if (record.accessType === "trial") {
    const remaining = record.trialCallsRemaining ?? 0;
    if (remaining < budgetCalls) {
      throw Object.assign(
        new Error(`Trial calls exhausted for agent_id=${agent.id}`),
        {
          statusCode: 402,
          code: "trial_calls_exhausted",
        },
      );
    }
    record.trialCallsRemaining = remaining - budgetCalls;
    record.updatedAt = new Date().toISOString();
    const storedRecord = await persistAgentEntitlement(record, agent);
    agentEntitlements.set(
      entitlementKey(hirerId, agent.id),
      storedRecord || record,
    );
    return storedRecord || record;
  }

  return record;
}

function publicEntitlement(record) {
  return {
    id: record.id,
    hirerId: record.hirerId,
    agentId: record.agentId,
    status: record.status,
    accessType: record.accessType,
    source: record.source || "gateway",
    storageSource: record.storageSource || "memory",
    receiptObjectId: record.receiptObjectId,
    trialCallsRemaining: record.trialCallsRemaining,
    pricePerCallUsd: record.pricePerCallUsd,
    ownerSuiAddress: record.ownerSuiAddress || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
  };
}

function codexCallHint(record, agent) {
  return {
    tool: "hireme_call_agent",
    agentId: agent.id,
    hirerId: record.hirerId,
    text: `HireMe MCP에서 ${agent.id} agent를 호출해줘. hirer_id는 ${record.hirerId}로 써.`,
    arguments: {
      agent_id: agent.id,
      task: "<your task>",
      hirer_id: record.hirerId,
      hire_receipt_object_id: record.receiptObjectId,
    },
  };
}

function readHirerId(args = {}) {
  const value =
    args.hirer_id ||
    args.hirerId ||
    args.user_id ||
    args.userId ||
    args.wallet_address ||
    args.walletAddress ||
    args.wallet ||
    args.email ||
    "local-hirer";
  return normalizeHirerId(value);
}

function normalizeSuiAddress(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  const normalized = text.startsWith("0x") ? text : `0x${text}`;
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) return "";
  return normalized;
}

function normalizeDisplayName(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length < 2 || text.length > 40) return "";
  return text;
}

function existingSuiAddressForHirer(hirerId) {
  for (const session of oauthLoginSessions.values()) {
    if (session.hirerId === hirerId && session.suiAddress) {
      return session.suiAddress;
    }
  }
  for (const record of agentEntitlements.values()) {
    if (record.hirerId === hirerId && record.ownerSuiAddress) {
      return record.ownerSuiAddress;
    }
  }
  return null;
}

function normalizeHirerId(value) {
  return String(value || "local-hirer")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._@-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "local-hirer";
}

function entitlementKey(hirerId, agentId) {
  return `${hirerId}:${agentId}`;
}

function readSealKeyServerIds() {
  const raw = process.env.HIREME_SEAL_KEY_SERVER_IDS;
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function readPlatformThreshold() {
  const raw = process.env.HIREME_PLATFORM_THRESHOLD || process.env.HIREME_SEAL_THRESHOLD;
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : null;
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

async function findOrHydrateAgent(agentId) {
  try {
    return findAgent(agentId);
  } catch (err) {
    if (err.code !== "unknown_agent") throw err;
  }

  const hydrated = await hydrateAgentFromSupabase(agentId);
  if (hydrated) return hydrated;
  return findAgent(agentId);
}

async function hydrateAgentFromSupabase(agentId) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const slug = normalizeSlug(agentId, "agent");
  const { data: row, error } = await admin
    .from("agent_marketplace_cards")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !row) return null;

  const { data: artifactRow } = await admin
    .from("protected_artifacts")
    .select("*")
    .eq("agent_id", row.id)
    .eq("kind", "agent_folder")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const agent = {
    id: row.slug || slug,
    name: row.name,
    handle: row.handle || `@agents/${row.slug || slug}`,
    creator: row.creator_name || "Unknown creator",
    category: normalizeDisplayCategory(row.category),
    status: normalizeDisplayStatus(row.status),
    headline: row.headline,
    publicSummary: row.public_summary,
    publicContract: row.public_mcp_contract,
    memwalPolicy:
      "Protected Skills, Harness logic, private prompts, and memory artifacts stay behind the MCP gateway.",
    skills: normalizeStringList(row.public_skills).length
      ? normalizeStringList(row.public_skills)
      : ["MCP"],
    hiddenAssetClasses: normalizeStringList(
      artifactRow?.metadata?.protectedAssetClasses,
    ).length
      ? normalizeStringList(artifactRow.metadata.protectedAssetClasses)
      : ["AGENTS.md", "skills/**", "private prompts", "harness internals"],
    pricePerCallUsd: readOptionalNumber(row.price_per_mcp_call_usd, 0),
    freeCalls: Math.trunc(readOptionalNumber(row.free_calls, 0)),
    rating: readOptionalNumber(row.rating, 0),
    calls: Math.trunc(readOptionalNumber(row.historical_calls, 0)),
    latencyMs: Math.trunc(readOptionalNumber(row.median_latency_ms, 0)),
  };

  upsertLocalAgent(agent);

  protectedArtifacts.set(agent.id, {
    agentId: agent.id,
    network: artifactRow?.network || "walrus-testnet",
    encryptionProvider:
      artifactRow?.encryption_provider || "platform-managed-envelope",
    platformKmsKeyId:
      artifactRow?.platform_kms_key_id ||
      process.env.HIREME_PLATFORM_KMS_KEY_ID ||
      "platform:local-dev-key",
    ciphertextFormat:
      artifactRow?.ciphertext_format || "hireme.platform-ciphertext-envelope.v1",
    policyId: artifactRow?.seal_policy_id || `platform:agent:${agent.id}`,
    sealPolicyId: artifactRow?.seal_policy_id || `platform:agent:${agent.id}`,
    sealEncryptionId:
      artifactRow?.seal_encryption_id || `hireme::agent-folder::${agent.id}`,
    sealPackageId: artifactRow?.seal_package_id || null,
    sealApproveTarget: artifactRow?.seal_approve_target || null,
    sealThreshold: artifactRow?.seal_threshold || null,
    sealKeyServerIds: artifactRow?.seal_key_server_ids || [],
    walrusBlobId: artifactRow?.walrus_blob_id || `gateway-managed:${agent.id}`,
    suiObjectId: artifactRow?.walrus_sui_object_id || row.current_version_id || "pending",
    ciphertextDigest:
      artifactRow?.ciphertext_digest || "registered-with-protected-artifacts",
    folderManifestDigest: artifactRow?.folder_manifest_digest || null,
    visibility:
      artifactRow?.metadata?.visibility ||
      "Marketplace cards expose capability, price, and safe metadata. Protected artifact details are resolved by the gateway at call time.",
    registeredAt: artifactRow?.created_at || new Date().toISOString(),
  });

  return agent;
}

function isAuthorized(req) {
  if (!apiKey) return true;
  return (
    req.headers.authorization === `Bearer ${apiKey}` ||
    req.headers["x-hireme-gateway-key"] === apiKey
  );
}

async function readText(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
}

async function readJson(req) {
  const body = await readText(req);
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

async function readForm(req) {
  const body = await readText(req);
  return Object.fromEntries(new URLSearchParams(body));
}

async function readJsonOrForm(req) {
  const body = await readText(req);
  if (!body.trim()) return {};
  if (String(req.headers["content-type"] || "").includes("application/json")) {
    try {
      return JSON.parse(body);
    } catch {
      throw Object.assign(new Error("Request body must be valid JSON"), {
        statusCode: 400,
        code: "bad_json",
      });
    }
  }
  return Object.fromEntries(new URLSearchParams(body));
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

function sendWebSessionJson(req, res, statusCode, payload) {
  const origin = req.headers.origin || webAppBaseUrl(req);
  res.statusCode = statusCode;
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("vary", "origin");
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
  if (statusCode === 204) {
    res.end();
    return;
  }
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
}

function oauthSessionCookies(sessionId, maxAgeSeconds) {
  return [
    `hireme_oauth_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`,
    `hireme_web_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`,
  ];
}

function clearOAuthSessionCookies() {
  return [
    "hireme_oauth_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
    "hireme_web_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
  ];
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
