import { resolve } from "node:path";
import {
  listLocalSpecialistAgents,
  runLocalSpecialistAgent,
} from "./localSpecialistAgent.mjs";
import {
  consumeDbEntitlement,
  defaultDbAgents,
  getDbEntitlement,
  listDbAgents,
} from "./dbAgentSource.mjs";
import {
  callProtectedAgentRuntime,
  mockProtectedAgents,
} from "./protectedRuntimeTools.mjs";
import { appendUsageLedgerEntry } from "./usageLedger.mjs";
import { createSpecialistMemoryStore } from "./specialistMemory.mjs";

const sourceSchemaVersion = "hireme.agent_source.resolve.v1";
const sourceListSchemaVersion = "hireme.agent_source.list.v1";
const defaultLocalSpecialistRoot = process.env.HIREME_LOCAL_SPECIALIST_ROOT ||
  "examples/local-specialist-agents";
const defaultUserId = "local-dev-user";

export function createAgentSourceLayerTools({
  workspaceDir = process.cwd(),
  stateDir = ".hireme/standalone-agent/default",
  localSpecialistOptions = {},
  marketplaceOptions = {},
  dbAgentSourceOptions = {},
  protectedRuntimeOptions = {},
  defaultConversationId = localSpecialistOptions.defaultConversationId || "default-session",
  currentUserId = dbAgentSourceOptions.currentUserId ||
    marketplaceOptions.currentUserId ||
    process.env.HIREME_USER_ID ||
    defaultUserId,
} = {}) {
  const workspaceRoot = resolve(workspaceDir);
  const stateRoot = resolve(stateDir);
  const localRoot = resolve(
    workspaceRoot,
    localSpecialistOptions.specialistRoot || defaultLocalSpecialistRoot,
  );
  const sourceOptions = {
    ...marketplaceOptions,
    ...dbAgentSourceOptions,
  };
  const dbAgents =
    sourceOptions.dbAgents ||
    sourceOptions.marketplaceAgents ||
    defaultDbAgents();
  const protectedAgents = protectedRuntimeOptions.protectedAgents || mockProtectedAgents;
  const modelProvider = localSpecialistOptions.modelProvider || null;

  return [
    {
      name: "hireme_list_agent_sources",
      description:
        "List Agents from the unified HireMe Agent Source Layer: local filesystem first, then DB Agent Source public cards.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string" },
          current_user_id: { type: "string" },
        },
      },
      handler: async (args = {}) =>
        listAgentSources({
          localRoot,
          stateRoot,
          dbAgents,
          currentUserId,
          ...args,
        }),
    },
    {
      name: "hireme_resolve_agent_source",
      description:
        "Resolve one Agent id to local filesystem or DB Agent Source, including callability and authoring permissions.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          current_user_id: { type: "string" },
        },
        required: ["agent_id"],
      },
      handler: async (args = {}) =>
        resolveAgentSource({
          localRoot,
          stateRoot,
          dbAgents,
          currentUserId,
          ...args,
        }),
    },
    {
      name: "hireme_call_agent_source",
      description:
        "Call an Agent through the unified source layer. Local Agents run from local filesystem; DB Agents require entitlement and run through protected runtime.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          task: { type: "string" },
          conversation_id: { type: "string" },
          response_mode: {
            type: "string",
            enum: ["direct_answer", "artifact_spec", "local_workspace_execution_brief"],
          },
          output_format: { type: "string" },
          current_user_id: { type: "string" },
          session_memory: { type: "array", items: { type: "object" } },
        },
        required: ["agent_id", "task"],
      },
      handler: async (args = {}) =>
        callAgentSource({
          localRoot,
          stateRoot,
          dbAgents,
          protectedAgents,
          modelProvider,
          currentUserId,
          conversation_id:
            args.conversation_id || args.conversationId || defaultConversationId,
          ...args,
        }),
    },
  ];
}

export async function listAgentSources({
  localRoot,
  stateRoot,
  dbAgents,
  marketplaceAgents,
  currentUserId,
  current_user_id,
  query,
  category,
} = {}) {
  const agents = dbAgents || marketplaceAgents || defaultDbAgents();
  const userId = normalizeUserId(current_user_id || currentUserId);
  const [localResult, dbResult] = await Promise.all([
    listLocalSpecialistAgents({ root: localRoot, query, category }).catch(() => ({
      agents: [],
    })),
    listDbAgents({
      agents,
      stateRoot,
      current_user_id: userId,
      query,
      category,
    }).catch(() => ({
      agents: [],
    })),
  ]);

  const sources = [
    ...(localResult.agents || []).map(localSourceRecord),
    ...(dbResult.agents || []).map(dbSourceRecord),
  ];

  return {
    schema: sourceListSchemaVersion,
    type: "hireme_agent_source_list",
    userId,
    count: sources.length,
    sources,
    precedence: ["local_filesystem", "db_agent_source"],
  };
}

export async function resolveAgentSource({
  localRoot,
  stateRoot,
  dbAgents,
  marketplaceAgents,
  currentUserId,
  current_user_id,
  agent_id,
  agentId,
} = {}) {
  const agents = dbAgents || marketplaceAgents || defaultDbAgents();
  const userId = normalizeUserId(current_user_id || currentUserId);
  const id = normalizeAgentId(agent_id || agentId);
  if (!id) throw new Error("agent_id is required");

  const localResult = await listLocalSpecialistAgents({ root: localRoot }).catch(() => ({
    agents: [],
  }));
  const localAgent = (localResult.agents || []).find((agent) => agent.id === id);
  if (localAgent) {
    return {
      schema: sourceSchemaVersion,
      type: "hireme_agent_source_resolution",
      userId,
      found: true,
      ...localSourceRecord(localAgent),
    };
  }

  const dbResolution = await getDbEntitlement({
    agents,
    stateRoot,
    current_user_id: userId,
    agent_id: id,
  }).catch((err) => {
    if (err?.code === "db_agent_not_found") return null;
    throw err;
  });

  if (dbResolution) {
    return {
      schema: sourceSchemaVersion,
      type: "hireme_agent_source_resolution",
      userId,
      found: true,
      ...dbSourceRecord(dbResolution.agent),
    };
  }

  return {
    schema: sourceSchemaVersion,
    type: "hireme_agent_source_resolution",
    userId,
    found: false,
    source: "not_found",
    sourceKind: null,
    agentId: id,
    canCall: false,
    callMode: null,
    entitlementRequired: false,
    authoring: nonEditableAuthoring(),
    runtimeBoundary: null,
    nextAction: "Create a local Agent or hire an Agent from the DB Agent Source.",
  };
}

export async function callAgentSource({
  localRoot,
  stateRoot,
  dbAgents,
  marketplaceAgents,
  protectedAgents = mockProtectedAgents,
  modelProvider = null,
  currentUserId,
  current_user_id,
  agent_id,
  agentId,
  task,
  conversation_id,
  conversationId,
  response_mode,
  responseMode,
  output_format,
  outputFormat,
  session_memory,
  sessionMemory,
} = {}) {
  const agents = dbAgents || marketplaceAgents || defaultDbAgents();
  const id = normalizeAgentId(agent_id || agentId);
  const resolution = await resolveAgentSource({
    localRoot,
    stateRoot,
    dbAgents: agents,
    current_user_id: current_user_id || currentUserId,
    agent_id: id,
  });

  if (!resolution.found) {
    const result = sourceRefusal({
      agentId: id,
      outputText: `Agent not found in local filesystem or DB Agent Source: ${id}`,
      resolution,
    });
    await recordUsage({ stateRoot, resolution, task, result });
    return result;
  }

  if (resolution.source === "local") {
    const result = await runLocalSpecialistAgent({
      root: localRoot,
      memoryStore: createSpecialistMemoryStore({ stateDir: stateRoot }),
      modelProvider,
      agent_id: id,
      task,
      current_user_id: resolution.userId,
      conversation_id: conversation_id || conversationId,
      session_memory: session_memory || sessionMemory || [],
      response_mode: response_mode || responseMode,
      output_format: output_format || outputFormat,
    });
    const withResolution = attachSourceResolution(result, resolution);
    await recordUsage({ stateRoot, resolution, task, result: withResolution });
    return withResolution;
  }

  if (resolution.source === "db" && !resolution.canCall) {
    const result = sourceRefusal({
      agentId: id,
      outputText: [
        resolution.entitlement?.callReason === "trial_quota_exhausted"
          ? `Trial quota is exhausted for DB Agent "${id}".`
          : `DB Agent "${id}" is not hired for this HireMe user yet.`,
        `Run \`hireme marketplace hire ${id}\` before calling it, or inspect the public card with \`hireme marketplace inspect ${id}\`.`,
      ].join("\n"),
      resolution,
      entitlementRequired: true,
    });
    await recordUsage({ stateRoot, resolution, task, result });
    return result;
  }

  if (resolution.source === "db" && resolution.callMode === "protected_runtime") {
    const consumption = await consumeDbEntitlement({
      agents,
      stateRoot,
      current_user_id: current_user_id || currentUserId,
      agent_id: id,
    });
    const consumedResolution = mergeConsumptionIntoResolution(resolution, consumption);
    if (!consumption.allowed) {
      const result = sourceRefusal({
        agentId: id,
        outputText: [
          consumption.reason === "trial_quota_exhausted"
            ? `Trial quota is exhausted for DB Agent "${id}".`
            : `DB Agent "${id}" is not currently callable.`,
          `Run \`hireme marketplace hire ${id}\` before calling it again.`,
        ].join("\n"),
        resolution: consumedResolution,
        entitlementRequired: true,
      });
      await recordUsage({
        stateRoot,
        resolution: consumedResolution,
        task,
        result,
        consumption,
      });
      return result;
    }

    const result = await callProtectedAgentRuntime({
      agents: protectedAgents,
      stateRoot,
      agent_id: id,
      task,
      conversation_id: conversation_id || conversationId,
      current_user_id: resolution.userId,
      session_memory: session_memory || sessionMemory || [],
      response_mode: response_mode || responseMode,
      output_format: output_format || outputFormat,
    });
    const withResolution = attachSourceResolution(result, consumedResolution);
    await recordUsage({
      stateRoot,
      resolution: consumedResolution,
      task,
      result: withResolution,
      consumption,
    });
    return {
      ...withResolution,
      usage: {
        trialCallsConsumed: consumption.trialCallsConsumed || 0,
        remainingTrialCalls: consumption.remainingTrialCalls ?? null,
        entitlementAccess: consumption.entitlement?.access || null,
        entitlementReason: consumption.reason,
      },
    };
  }

  const result = sourceRefusal({
    agentId: id,
    outputText: `Agent source is not callable: ${id}`,
    resolution,
  });
  await recordUsage({ stateRoot, resolution, task, result });
  return result;
}

function localSourceRecord(agent) {
  return {
    source: "local",
    sourceKind: "local_filesystem",
    agentId: agent.id,
    id: agent.id,
    name: agent.name,
    canCall: true,
    callMode: "local_specialist",
    entitlementRequired: false,
    publicCard: agent,
    authoring: {
      editable: true,
      privateHarnessEditable: true,
      exportable: true,
      importable: true,
      updateTool: "hireme_update_local_specialist_agent_file",
      validateTool: "hireme_validate_local_specialist_agent",
      exportTool: "hireme_export_local_specialist_agent",
      editablePaths: [
        "AGENTS.md",
        "skills/**",
        "harness/**",
        "examples/private/**",
        "evals/**",
        "memory/memory-policy.md",
        "private-source/**",
        "adapter/**",
      ],
      privacyBoundary:
        "Local creator-owned Agents may edit private harness files, but user-facing outputs must not echo private contents.",
    },
    runtimeBoundary: {
      localHarnessMaterialized: true,
      localPlaintextCache: true,
      privateHarnessLocal: true,
      protectedRuntimeRequired: false,
      reason: "creator_owned_local_filesystem",
    },
    nextAction: `hireme agent call ${agent.id} "<task>"`,
  };
}

function dbSourceRecord(agent) {
  const callable = agent.callAccess?.allowed === true;
  return {
    source: "db",
    sourceKind: "db_agent_source",
    agentId: agent.id,
    id: agent.id,
    name: agent.name,
    canCall: callable,
    callMode: callable ? "protected_runtime" : null,
    entitlementRequired: !callable,
    entitlement: agent.entitlement || null,
    publicCard: agent,
    authoring: nonEditableAuthoring(),
    runtimeBoundary: {
      executionMode: agent.runtime?.executionMode || "remote_trusted_executor",
      executionPolicy: agent.runtime?.executionPolicy || agent.manifest?.execution || null,
      localProtectedAvailable:
        agent.manifest?.execution?.operations?.some((operation) => (
          operation.executionClass === "local_protected"
        )) === true,
      hostedSecureAvailable:
        agent.manifest?.execution?.operations?.some((operation) => (
          operation.executionClass === "hosted_secure"
        )) === true,
      localHarnessMaterialized: false,
      localPlaintextCache: false,
      privateHarnessLocal: false,
      protectedRuntimeRequired: true,
      runtimeSelection: "selected_by_operation",
      reason: callable ? "db_entitlement_active" : agent.callAccess?.reason || "db_entitlement_required",
    },
    nextAction: callable
      ? `hireme agent call ${agent.id} "<task>"`
      : `hireme marketplace hire ${agent.id}`,
  };
}

function nonEditableAuthoring() {
  return {
    editable: false,
    privateHarnessEditable: false,
    exportable: false,
    importable: false,
    editablePaths: [],
    privacyBoundary:
      "DB Agent Source exposes public cards and safe runtime calls only; private Harness files are not editable or materialized locally.",
  };
}

function attachSourceResolution(result, resolution) {
  return {
    ...result,
    sourceResolution: compactResolution(resolution),
  };
}

function sourceRefusal({ agentId, outputText, resolution, entitlementRequired = false }) {
  return {
    schema: "hireme.specialist_agent.output.v1",
    agentId,
    status: "refused",
    responseMode: "direct_answer",
    outputText,
    structuredResult: {
      summary: entitlementRequired ? "DB Agent entitlement required." : "Agent source cannot be called.",
      recommendations: [resolution?.nextAction].filter(Boolean),
    },
    artifacts: [],
    evidence: [],
    assumptions: [],
    risks: [],
    memoryDeltas: [],
    runtime: {
      executionMode: resolution?.runtimeBoundary?.executionMode || null,
      entitlementRequired,
      localHarnessMaterialized: false,
      localPlaintextCache: false,
      safeOutputOnly: true,
    },
    sourceResolution: resolution ? compactResolution(resolution) : null,
  };
}

function compactResolution(resolution) {
  return {
    schema: resolution.schema || sourceSchemaVersion,
    source: resolution.source,
    sourceKind: resolution.sourceKind,
    agentId: resolution.agentId,
    canCall: resolution.canCall,
    callMode: resolution.callMode,
    entitlementRequired: resolution.entitlementRequired,
    entitlement: resolution.entitlement || null,
    authoring: resolution.authoring,
    runtimeBoundary: resolution.runtimeBoundary,
    nextAction: resolution.nextAction,
  };
}

async function recordUsage({ stateRoot, resolution, task, result, consumption } = {}) {
  if (!stateRoot || !resolution || !result) return null;
  return appendUsageLedgerEntry({
    stateRoot,
    entry: {
      userId: resolution.userId,
      agentId: resolution.agentId,
      source: resolution.source,
      sourceKind: resolution.sourceKind,
      callMode: resolution.callMode,
      status: result.status,
      responseMode: result.responseMode,
      outcome: result.status,
      entitlementAccess:
        consumption?.entitlement?.access ||
        resolution.entitlement?.access ||
        null,
      entitlementReason:
        consumption?.reason ||
        resolution.entitlement?.callReason ||
        resolution.runtimeBoundary?.reason ||
        null,
      trialCallsConsumed: consumption?.trialCallsConsumed || 0,
      remainingTrialCalls:
        consumption?.remainingTrialCalls ??
        resolution.entitlement?.remainingTrialCalls ??
        null,
      task,
      runtime: result.runtime,
      sourceResolution: compactResolution(resolution),
    },
  });
}

function mergeConsumptionIntoResolution(resolution, consumption) {
  if (!consumption) return resolution;
  const entitlement = consumption.entitlement || resolution.entitlement || null;
  return {
    ...resolution,
    canCall: consumption.allowed,
    callMode: consumption.allowed ? "protected_runtime" : null,
    entitlementRequired: !consumption.allowed,
    entitlement,
    publicCard: consumption.agent || resolution.publicCard,
    runtimeBoundary: {
      ...resolution.runtimeBoundary,
      reason: consumption.allowed
        ? "db_entitlement_active"
        : consumption.reason || resolution.runtimeBoundary?.reason,
    },
    nextAction: consumption.nextAction || resolution.nextAction,
  };
}

function normalizeAgentId(value) {
  const id = String(value || "").trim().replace(/^!+/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(id)) {
    throw Object.assign(new Error(`Invalid Agent id: ${value}`), {
      code: "invalid_agent_id",
    });
  }
  return id;
}

function normalizeUserId(value) {
  return String(value || defaultUserId).trim() || defaultUserId;
}
