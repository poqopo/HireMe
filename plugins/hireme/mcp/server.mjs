#!/usr/bin/env node

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
    harnessSummary: "retrieval + citation verifier + confidence scorer",
    memwalPolicy: "Protected notes, source ranking weights, and scoring rubric",
    skills: ["Protocol research", "Citation audit", "Market mapping"],
    protectedAssets: ["ranking prompt", "source scoring harness", "private memory"],
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
    harnessSummary: "repo scanner + patch planner + regression checklist",
    memwalPolicy: "Protected implementation recipes and repo-specific playbooks",
    skills: ["React Vite", "Supabase", "MCP scaffolding"],
    protectedAssets: ["patch templates", "review heuristics", "tool routing"],
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
    harnessSummary: "attack corpus + leakage grader + policy diff",
    memwalPolicy: "Protected attack prompts, scoring thresholds, and audit traces",
    skills: ["Prompt leakage", "Tool abuse", "Policy checks"],
    protectedAssets: ["red-team set", "grader rubric", "blocked examples"],
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
    harnessSummary: "event normalizer + anomaly detector + payout exporter",
    memwalPolicy: "Protected pricing heuristics and fraud scoring rules",
    skills: ["Usage ledger", "Pricing tiers", "Payout analytics"],
    protectedAssets: ["fraud rules", "tier optimizer", "SQL templates"],
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
    harnessSummary: "positioning memory + asset planner + channel formatter",
    memwalPolicy: "Protected positioning library and channel performance memory",
    skills: ["Launch copy", "Channel plan", "Audience mapping"],
    protectedAssets: ["positioning vault", "channel memory", "copy variants"],
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
    harnessSummary: "policy router + approval gate + tool budgeter",
    memwalPolicy: "Protected routing rules and customer-specific operation memory",
    skills: ["Tool routing", "Approvals", "Spend control"],
    protectedAssets: ["routing graph", "approval matrix", "budget heuristics"],
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
    harnessSummary: "private rubric + risk-review skill + redacted finding formatter",
    memwalPolicy:
      "Example AGENTS.md, private risk checklist, and harness policy decrypt only inside the gateway runner.",
    skills: ["Code review", "Risk triage", "Test planning"],
    protectedAssets: ["AGENTS.md", "skills/**", "harness/**", "private rubric"],
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
    harnessSummary:
      "private AGENTS.md + design.md guide + landing page brief formatter",
    memwalPolicy:
      "Private AGENTS.md and design.md decrypt only inside the gateway runner.",
    skills: ["Landing pages", "Design systems", "Conversion copy"],
    protectedAssets: ["AGENTS.md", "design.md", "skills/**", "harness/**"],
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
    harnessSummary:
      "private Aster X1 product dossier + launch playbook + preorder-page formatter",
    memwalPolicy:
      "Private Aster X1 product dossier, launch playbook, and preorder skill decrypt only inside the gateway runner.",
    skills: ["Smartphone preorder pages", "Launch offer mechanics", "Product detail conversion"],
    protectedAssets: [
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
    harnessSummary: "Supabase blob registry + Walrus archive reader + folder manifest summarizer",
    memwalPolicy:
      "Plaintext Walrus test only. Production protected agents should store platform-managed ciphertext and decrypt only inside the gateway runner.",
    skills: ["Walrus read", "Supabase registry", "Folder manifest inspection"],
    protectedAssets: ["AGENTS.md"],
    pricePerCallUsd: 0.001,
    freeCalls: 100,
    rating: 5.0,
    calls: 1,
    latencyMs: 1600,
  },
];

let activeAgentId = "walrus-researcher";
const sealedHarnessRegistry = [
  {
    agentId: "walrus-researcher",
    network: "walrus-testnet",
    sealPolicyId: "platform:agent:walrus-researcher",
    walrusBlobId: "walrus_researcher_encrypted_bundle",
    suiObjectId: "0x9f1d4c739f6f3c9b72c8d2c64ad93f459081dfe2aa49c881d2df0672b591021a",
    ciphertextDigest:
      "sha256:2b5a8d1f84d83a9a8d33270c0a7fdc3d5d48f7d72f184a35a18f2453ff4fb01d",
    registeredAt: "2026-06-10T00:00:00.000Z",
  },
  {
    agentId: "wal-test1",
    network: "walrus-testnet",
    sealPolicyId: "none:plaintext-walrus-demo",
    walrusBlobId: "supabase:walrus_agent_artifacts/latest",
    suiObjectId: "registered-after-upload",
    ciphertextDigest: "not-applicable-plaintext-demo",
    registeredAt: "2026-06-11T00:00:00.000Z",
  },
];

const gatewayUrl =
  process.env.HIREME_MCP_GATEWAY_URL || "http://localhost:8787";
const gatewayApiKey = process.env.HIREME_GATEWAY_API_KEY || "";
const codexInstallationId =
  process.env.HIREME_CODEX_INSTALLATION_ID || "local-codex";

const inputSchemas = {
  hireme_request: {
    type: "object",
    properties: {
      request: {
        type: "string",
        minLength: 1,
        description:
          "Plain-language user request, for example: example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해.",
      },
      agent_id: {
        type: "string",
        description:
          "Optional explicit agent id. If omitted, HireMe infers one from the request.",
      },
      budget_calls: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Optional maximum billable MCP calls.",
      },
      hire_receipt_object_id: {
        type: "string",
        description:
          "Optional paid hire receipt. Local protected example agents default to hire_receipt_local_paid_demo.",
      },
    },
    required: ["request"],
  },
  hireme_list_hired_agents: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["Research", "Code", "Data", "Security", "Growth", "Ops"],
      },
      query: { type: "string" },
    },
  },
  hireme_get_agent: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description: "Agent id, for example codex-builder",
      },
    },
    required: ["agent_id"],
  },
  hireme_select_agent: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description: "Agent id to make active for this Codex MCP session",
      },
    },
    required: ["agent_id"],
  },
  hireme_current_agent: {
    type: "object",
    properties: {},
  },
  hireme_call_agent: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description: "Optional explicit agent id. Uses active agent when omitted.",
      },
      task: {
        type: "string",
        minLength: 1,
        description: "The task to send to the hired agent",
      },
      budget_calls: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Maximum billable MCP calls for this request",
      },
      record_path: {
        type: "string",
        description:
          "Optional public artifact record path for protected example agents.",
      },
      hire_receipt_object_id: {
        type: "string",
        description:
          "Optional paid hire receipt object id for protected example agents.",
      },
    },
    required: ["task"],
  },
  hireme_call_walrus_agent: {
    type: "object",
    properties: {
      blob_id: {
        type: "string",
        description:
          "Optional Walrus blob id. If omitted, pass agent_id so the gateway can look up the latest blob in Supabase.",
      },
      agent_id: {
        type: "string",
        description:
          "Optional registry agent id, for example wal-test1. Used to look up the latest Walrus blob id in Supabase.",
      },
      task: {
        type: "string",
        description:
          "Task-specific question to answer after the gateway reads the Walrus Agent folder.",
      },
    },
  },
  hireme_read_memwal: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description: "Agent id whose memWal record should be read safely through the gateway.",
      },
      record_path: {
        type: "string",
        description: "Optional public memWal record path.",
      },
      hire_receipt_object_id: {
        type: "string",
        description: "Paid hire receipt or execution-ticket object id. Local demo accepts hire_receipt_* values.",
      },
    },
  },
  hireme_prepare_sealed_harness_upload: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description: "Draft agent id for the protected Harness registration",
      },
      epochs: {
        type: "integer",
        minimum: 1,
        maximum: 53,
        description: "Walrus storage duration in epochs",
      },
    },
  },
  hireme_register_sealed_harness: {
    type: "object",
    properties: {
      agent_id: { type: "string" },
      policy_id: { type: "string" },
      encryption_provider: { type: "string" },
      platform_kms_key_id: { type: "string" },
      ciphertext_format: { type: "string" },
      seal_policy_id: { type: "string" },
      seal_package_id: { type: "string" },
      seal_approve_target: { type: "string" },
      seal_encryption_id: { type: "string" },
      walrus_blob_id: { type: "string" },
      sui_object_id: { type: "string" },
      ciphertext_digest: { type: "string" },
      seal_threshold: { type: "integer", minimum: 1 },
      seal_key_server_ids: {
        type: "array",
        items: { type: "string" },
      },
      price_per_call_usd: { type: "number", minimum: 0 },
    },
    required: [
      "agent_id",
      "walrus_blob_id",
      "sui_object_id",
      "ciphertext_digest",
      "price_per_call_usd",
    ],
  },
  hireme_validate_sealed_harness: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description:
          "Optional protected example agent id. Use example-landing-designer for the design.md landing page demo.",
      },
      record_path: {
        type: "string",
        description:
          "Path to the public artifact record. Defaults to the example code reviewer record.",
      },
      walrus_path: {
        type: "string",
        description:
          "Optional local Walrus ciphertext path. Usually inferred from the public record.",
      },
      hire_receipt_object_id: {
        type: "string",
        description:
          "Paid hire receipt or execution-ticket object id. Local demo accepts hire_receipt_* values.",
      },
    },
  },
  hireme_connection_help: {
    type: "object",
    properties: {},
  },
};

const tools = [
  {
    name: "hireme_request",
    title: "Route a plain-language HireMe request",
    description:
      "Use this for natural requests like 'example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해'. It infers the agent, default demo hire receipt, and calls the protected gateway.",
    inputSchema: inputSchemas.hireme_request,
  },
  {
    name: "hireme_list_hired_agents",
    title: "List hired HireMe agents",
    description:
      "List the current user's hired protected agents with public skills, pricing, and memWal protection summaries.",
    inputSchema: inputSchemas.hireme_list_hired_agents,
  },
  {
    name: "hireme_get_agent",
    title: "Get HireMe agent profile",
    description:
      "Inspect one hired agent's public profile, pricing, public skills, and protection policy.",
    inputSchema: inputSchemas.hireme_get_agent,
  },
  {
    name: "hireme_select_agent",
    title: "Select active HireMe agent",
    description:
      "Set the active agent for this Codex MCP session so later calls can omit agent_id.",
    inputSchema: inputSchemas.hireme_select_agent,
  },
  {
    name: "hireme_current_agent",
    title: "Get active HireMe agent",
    description: "Return the session-local active HireMe agent.",
    inputSchema: inputSchemas.hireme_current_agent,
  },
  {
    name: "hireme_call_agent",
    title: "Call a hired HireMe agent",
    description:
      "Call an explicitly selected or session-active protected agent. Returns mock output and a ledger event in this demo.",
    inputSchema: inputSchemas.hireme_call_agent,
  },
  {
    name: "hireme_call_walrus_agent",
    title: "Read a Walrus Agent folder",
    description:
      "Ask the gateway to read a Walrus-stored Agent folder by blob_id or Supabase agent_id, inspect its structure, and return a safe summary.",
    inputSchema: inputSchemas.hireme_call_walrus_agent,
  },
  {
    name: "hireme_read_memwal",
    title: "Read protected memWal memory",
    description:
      "Ask the gateway to decrypt a platform-managed memWal snapshot and return only safe memory metadata.",
    inputSchema: inputSchemas.hireme_read_memwal,
  },
  {
    name: "hireme_prepare_sealed_harness_upload",
    title: "Prepare protected Harness upload",
    description:
      "Return the platform-managed encryption + Walrus upload boundary for a creator Harness bundle. Does not accept or expose plaintext Harness content.",
    inputSchema: inputSchemas.hireme_prepare_sealed_harness_upload,
  },
  {
    name: "hireme_register_sealed_harness",
    title: "Register protected Harness metadata",
    description:
      "Register only public metadata for an encrypted Harness already protected with platform-managed encryption and stored on Walrus.",
    inputSchema: inputSchemas.hireme_register_sealed_harness,
  },
  {
    name: "hireme_validate_sealed_harness",
    title: "Validate protected Harness through gateway",
    description:
      "Validate a protected Agent folder through the gateway runner. Requires a paid hire receipt and returns only safe metadata, never AGENTS.md or skills content.",
    inputSchema: inputSchemas.hireme_validate_sealed_harness,
  },
  {
    name: "hireme_connection_help",
    title: "Show HireMe plugin help",
    description: "Return plugin install, selection, and verification hints.",
    inputSchema: inputSchemas.hireme_connection_help,
  },
];

const localSealedExampleRecords = {
  "example-code-reviewer":
    ".hireme/artifacts/example-code-reviewer.public-record.json",
  "example-landing-designer":
    ".hireme/artifacts/example-landing-designer.public-record.json",
  "example-aster-x1-launcher":
    ".hireme/artifacts/example-aster-x1-launcher.public-record.json",
};

function sealedHarnessFor(agentId) {
  return (
    sealedHarnessRegistry.find((item) => item.agentId === agentId) || {
      agentId,
      network: "walrus-testnet",
      sealPolicyId: `platform:agent:${agentId}`,
      walrusBlobId: `walrus_${agentId}_encrypted_bundle`,
      suiObjectId: "pending",
      ciphertextDigest: "pending",
      registeredAt: null,
    }
  );
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
    publicContract: agent.harnessSummary,
    memwalPolicy: agent.memwalPolicy,
    hiddenAssetClasses: agent.protectedAssets,
    sealedHarness: sealedHarnessFor(agent.id),
    pricePerCallUsd: agent.pricePerCallUsd,
    freeCalls: agent.freeCalls,
    rating: agent.rating,
    historicalCalls: agent.calls,
    medianLatencyMs: agent.latencyMs,
    hired: true,
  };
}

function findAgent(agentId) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) {
    throw new Error(`Unknown or not hired agent_id: ${agentId}`);
  }
  return agent;
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

async function callGateway(path, body = {}, options = {}) {
  if (process.env.HIREME_MCP_GATEWAY_DISABLED === "1") return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs || 450,
  );

  try {
    const headers = {
      "content-type": "application/json",
    };

    if (gatewayApiKey) {
      headers.authorization = `Bearer ${gatewayApiKey}`;
      headers["x-hireme-gateway-key"] = gatewayApiKey;
    }

    const response = await fetch(`${gatewayUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        codex_installation_id: codexInstallationId,
        ...body,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gateway ${response.status}: ${errorBody}`);
    }

    return await response.json();
  } catch (err) {
    if (process.env.HIREME_MCP_GATEWAY_REQUIRED === "1") {
      throw err;
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
      sealedHarness: sealedHarnessFor(agent.id),
      active: agent.id === activeAgentId,
    }));

  return textResult({
    count: filtered.length,
    activeAgentId,
    hiredAgents: filtered,
  });
}

async function callTool(name, args = {}) {
  switch (name) {
    case "hireme_request": {
      const walrusRequest = routeWalrusNaturalRequest(
        args.request,
        args.agent_id,
      );
      if (walrusRequest) {
        const gateway = await callGateway("/v1/walrus-agent/read", walrusRequest, {
          timeoutMs: Number(process.env.HIREME_MCP_WALRUS_TIMEOUT_MS || 60_000),
        });
        if (gateway) {
          return textResult({
            routedBy: "hireme_request",
            naturalRequest: args.request,
            inferredAgentId: walrusRequest.agent_id || null,
            walrusBlobId: walrusRequest.blob_id || null,
            ...gateway,
          });
        }
        return textResult({
          status: "gateway_required",
          routedBy: "hireme_request",
          reason:
            "Walrus Agent folder reads require the protected gateway so Codex does not fetch creator folders directly.",
          runGateway: "npm run gateway:dev",
          retryTool: "hireme_call_walrus_agent",
          payload: walrusRequest,
        });
      }
      const routed = routeNaturalRequest(args.request, args.agent_id);
      const callArgs = {
        agent_id: routed.agentId,
        task: routed.task,
        budget_calls: args.budget_calls || 1,
        hire_receipt_object_id:
          args.hire_receipt_object_id || defaultHireReceiptFor(routed.agentId),
      };
      const gateway = await callGateway("/v1/agent-call", callArgs);
      if (gateway) {
        activeAgentId = gateway.activeAgentId || routed.agentId;
        return textResult({
          routedBy: "hireme_request",
          naturalRequest: args.request,
          inferredAgentId: routed.agentId,
          task: routed.task,
          ...gateway,
        });
      }
      return textResult({
        status: "gateway_required",
        routedBy: "hireme_request",
        inferredAgentId: routed.agentId,
        task: routed.task,
        reason:
          "Natural HireMe requests for protected agents require the protected gateway.",
        runGateway: "npm run gateway:dev",
        retryTool: "hireme_request",
      });
    }
    case "hireme_list_hired_agents": {
      const gateway = await callGateway("/v1/agents/list", args);
      if (gateway) return textResult(gateway);
      return listAgents(args);
    }
    case "hireme_get_agent": {
      const gateway = await callGateway("/v1/agents/get", args);
      if (gateway) return textResult(gateway.agent || gateway);
      return textResult(publicAgent(findAgent(args.agent_id)));
    }
    case "hireme_select_agent": {
      const gateway = await callGateway("/v1/sessions/select", args);
      if (gateway) {
        activeAgentId = gateway.activeAgentId || args.agent_id;
        return textResult(gateway);
      }
      const agent = findAgent(args.agent_id);
      activeAgentId = agent.id;
      return textResult({
        activeAgentId,
        activeAgent: publicAgent(agent),
        note: "Active agent updated for this MCP server process. Production should persist this per user and Codex installation.",
      });
    }
    case "hireme_current_agent": {
      const gateway = await callGateway("/v1/sessions/current", args);
      if (gateway) {
        activeAgentId = gateway.activeAgentId || activeAgentId;
        return textResult(gateway);
      }
      return textResult({
        activeAgentId,
        activeAgent: publicAgent(findAgent(activeAgentId)),
      });
    }
    case "hireme_call_agent": {
      const gateway = await callGateway("/v1/agent-call", {
        agent_id: args.agent_id || activeAgentId,
        ...args,
      });
      if (gateway) {
        activeAgentId = gateway.activeAgentId || args.agent_id || activeAgentId;
        return textResult(gateway);
      }
      const agent = findAgent(args.agent_id || activeAgentId);
      const callId = `call_${Date.now().toString(36)}`;
      const budgetCalls = args.budget_calls || 1;
      const fallbackPayload = {
        type: "protected_agent_guidance",
        summary:
          "Demo response: the selected protected agent accepted the task. Production will execute the encrypted Agent folder inside the MCP gateway and return only safe output.",
        recommendations: [
          `Use the public contract ${agent.harnessSummary}.`,
          "Start npm run gateway:dev for protected artifact execution.",
          "Keep creator AGENTS.md, skills, and harness files out of the local Codex plugin.",
        ],
      };
      return textResult({
        callId,
        activeAgentId,
        agent: {
          id: agent.id,
          name: agent.name,
          pricePerCallUsd: agent.pricePerCallUsd,
        },
        request: {
          task: args.task,
          budgetCalls,
        },
        protection: {
          codexPluginContainsCreatorSecrets: false,
          memwalPolicy: agent.memwalPolicy,
          sealPolicyId: sealedHarnessFor(agent.id).sealPolicyId,
          walrusBlobId: sealedHarnessFor(agent.id).walrusBlobId,
          exposedSkills: false,
          exposedPluginCode: false,
          exposedHarnessInternals: false,
          protectedAssetsReturned: false,
        },
        result: fallbackPayload,
        jsonOutput: {
          schema: "hireme.protected_agent_json_output.v1",
          type: fallbackPayload.type,
          generatedBy: "hireme-mcp-local-fallback",
          executionMode: "local-fallback",
          agent: {
            id: agent.id,
            name: agent.name,
            publicContract: agent.harnessSummary,
          },
          input: {
            task: args.task,
            budgetCalls,
            plaintextTaskVisibleToGateway: false,
          },
          harness: {
            publicContract: agent.harnessSummary,
            protectedAssetClasses: agent.protectedAssets,
            rawHarnessReturned: false,
            rawAgentsReturned: false,
            rawSkillsReturned: false,
          },
          payload: fallbackPayload,
          localCodex: {
            shouldAct: true,
            instruction:
              "Use jsonOutput.payload as demo guidance only. Start the HireMe gateway for protected Agent execution.",
            preferredSource: "jsonOutput.payload",
            blockedSources: ["AGENTS.md", "skills/**", "harness/**"],
          },
        },
        ledgerEvent: {
          table: "mcp_call_ledger",
          status: "mock_recorded",
          billableCalls: 1,
          amountUsd: agent.pricePerCallUsd,
        },
      });
    }
    case "hireme_call_walrus_agent": {
      const payload = {
        blob_id: args.blob_id || args.blobId,
        agent_id: args.agent_id || args.agentId,
        task: args.task || "Describe this Walrus Agent folder.",
      };
      const gateway = await callGateway("/v1/walrus-agent/read", payload, {
        timeoutMs: Number(process.env.HIREME_MCP_WALRUS_TIMEOUT_MS || 60_000),
      });
      if (gateway) return textResult(gateway);
      return textResult({
        status: "gateway_required",
        reason:
          "Walrus Agent folder reads require the protected gateway. The Codex plugin should not download or inspect creator folders directly.",
        runGateway: "npm run gateway:dev",
        retryTool: "hireme_call_walrus_agent",
        payload,
      });
    }
    case "hireme_read_memwal": {
      const payload = {
        agent_id: args.agent_id || args.agentId,
        record_path: args.record_path || args.recordPath,
        hire_receipt_object_id:
          args.hire_receipt_object_id ||
          args.hireReceiptObjectId ||
          "hire_receipt_local_paid_demo",
      };
      const gateway = await callGateway("/v1/memwal/read", payload, {
        timeoutMs: Number(process.env.HIREME_MCP_MEMWAL_TIMEOUT_MS || 60_000),
      });
      if (gateway) return textResult(gateway);
      return textResult({
        status: "gateway_required",
        reason:
          "memWal reads require the protected gateway. The Codex plugin must not decrypt private memory locally.",
        runGateway: "npm run gateway:dev",
        retryTool: "hireme_read_memwal",
        payload,
      });
    }
    case "hireme_prepare_sealed_harness_upload": {
      const gateway = await callGateway("/v1/sealed-harness/prepare", args);
      if (gateway) return textResult(gateway);
      const epochs = args.epochs || 3;
      return textResult({
        agentId: args.agent_id || "new-agent",
        expectedFolderShape: ["AGENTS.md", "skills/**", "optional adapters/**"],
        visibilityBoundary:
          "Do not ship creator AGENTS.md, skills, plugin files, prompts, or Harness code to the hirer's Codex installation. Encrypt the folder first, store only ciphertext on Walrus, and let the gateway decrypt it after platform access approval.",
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
      });
    }
    case "hireme_register_sealed_harness": {
      const gateway = await callGateway("/v1/sealed-harness/register", args);
      if (gateway) return textResult(gateway);
      const record = {
        agentId: args.agent_id,
        network: "walrus-testnet",
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
      sealedHarnessRegistry.push(record);
      return textResult({
        status: "registered",
        publicRecord: record,
        storedPlaintextHarness: false,
        returnedCreatorSecrets: false,
      });
    }
    case "hireme_validate_sealed_harness": {
      const agentId = args.agent_id || "example-code-reviewer";
      const payload = {
        record_path:
          args.record_path ||
          localSealedExampleRecords[agentId] ||
          localSealedExampleRecords["example-code-reviewer"],
        walrus_path: args.walrus_path,
        hire_receipt_object_id:
          args.hire_receipt_object_id || "hire_receipt_local_paid_demo",
      };
      const gateway = await callGateway("/v1/sealed-harness/validate", payload);
      if (gateway) return textResult(gateway);
      return textResult({
        status: "gateway_required",
        reason:
          "Protected Harness validation requires the gateway because the MCP server must not decrypt or inspect creator folders locally.",
        runGateway: "npm run gateway:dev",
        retryTool: "hireme_validate_sealed_harness",
        payload,
      });
    }
    case "hireme_connection_help":
      return textResult({
        marketplace: "codex plugin marketplace add /Users/hanlab/Desktop/HireMe",
        install: "codex plugin add hireme --marketplace hireme-local",
        verify: "Start a new Codex session and run /mcp.",
        naturalRequests:
          "For plain user wording, call hireme_request. Example: request='example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해'.",
        walrusAgent:
          "For the plaintext Walrus storage demo, call hireme_call_walrus_agent with agent_id='wal-test1' or a direct blob_id. The gateway reads Supabase and Walrus; Codex does not download the creator folder.",
        switching:
          "Use hireme_list_hired_agents, then hireme_select_agent, then hireme_call_agent. For high-stakes calls, pass agent_id explicitly.",
        protectedExample:
          "Run npm run platform:encrypt, start npm run gateway:dev, then call hireme_validate_sealed_harness with hire_receipt_object_id='hire_receipt_local_paid_demo'.",
        privacy:
          "Creator AGENTS.md and skills folders must never be shipped as Codex skills/plugins to hirers. The installed plugin is only a public connector to the protected MCP gateway.",
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function routeNaturalRequest(request, explicitAgentId) {
  const text = String(request || "").trim();
  if (!text) {
    throw new Error("request is required");
  }

  const agentId = explicitAgentId || inferAgentId(text);

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
    task: text
      .replace(/hireme_request/gi, "")
      .replace(/wal[_-]?test1/gi, "")
      .replace(/blob[_\s-]?id\s*(?:는|은|:|=|is)?\s*[A-Za-z0-9_-]{20,}/gi, "")
      .replace(/\s+/g, " ")
      .trim() || "Describe this Walrus Agent folder.",
  };
}

function inferAgentId(request) {
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

  return activeAgentId;
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, err) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: err instanceof Error ? err.message : String(err),
    },
  });
}

async function handleRequest(message) {
  if (!message || typeof message !== "object") return;
  if (!("id" in message)) return;

  try {
    switch (message.method) {
      case "initialize":
        result(message.id, {
          protocolVersion: message.params?.protocolVersion || "2024-11-05",
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: "hireme",
            version: "0.1.0",
          },
          instructions:
            "HireMe exposes hired protected AI agents. For plain-language delegation such as 'example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해', call hireme_request with the user's sentence as request. Use hireme_call_agent only when you already have structured agent_id/task arguments. Never request or reveal creator AGENTS.md files, private skills folders, design.md, Harness internals, plugin source, or protected memWal/Walrus artifacts.",
        });
        break;
      case "tools/list":
        result(message.id, { tools });
        break;
      case "tools/call":
        result(
          message.id,
          await callTool(message.params?.name, message.params?.arguments || {}),
        );
        break;
      default:
        error(message.id, new Error(`Unsupported method: ${message.method}`));
    }
  } catch (err) {
    error(message.id, err);
  }
}

let buffer = "";
let pendingRequests = 0;
let stdinEnded = false;

function maybeExit() {
  if (stdinEnded && pendingRequests === 0) {
    process.exit(0);
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) {
      try {
        pendingRequests += 1;
        void handleRequest(JSON.parse(line)).finally(() => {
          pendingRequests -= 1;
          maybeExit();
        });
      } catch (err) {
        error(null, err);
      }
    }
    newlineIndex = buffer.indexOf("\n");
  }
});

process.stdin.on("end", () => {
  stdinEnded = true;
  maybeExit();
});

console.error("HireMe plugin MCP server running on stdio");
