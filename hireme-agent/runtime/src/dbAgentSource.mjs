import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { mockProtectedAgents } from "./protectedRuntimeTools.mjs";
import { publicExecutionPolicy } from "./executionPolicy.mjs";
import { exampleHybridPricing } from "./billing.mjs";

const dbRegistrySchemaVersion = "hireme.db_agent_source.registry.v1";
const dbEntitlementSchemaVersion = "hireme.db_agent_source.entitlements.v1";
const defaultUserId = "local-dev-user";

export function defaultDbAgents() {
  return mockProtectedAgents.map((agent) => ({
    ...agent,
    marketplace: {
      listingStatus: "listed",
      accessModel: "try_or_hire",
      tryCalls: 3,
      price: {
        amount: 19,
        currency: "USD",
        unit: "month",
      },
      billingPricing: exampleHybridPricing,
    },
  }));
}

export async function listDbAgents({
  agents = defaultDbAgents(),
  stateRoot,
  currentUserId,
  current_user_id,
  query,
  category,
} = {}) {
  const userId = normalizeUserId(current_user_id || currentUserId);
  const entitlementStore = await readEntitlementStore(stateRoot);
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filtered = agents
    .filter((agent) => !category || agent.category === category)
    .filter((agent) => {
      if (!normalizedQuery) return true;
      return [
        agent.id,
        agent.name,
        agent.creator,
        agent.category,
        agent.headline,
        agent.publicSummary,
        ...(agent.publicSkills || []),
        ...(agent.manifest?.capabilities || []),
        ...(agent.manifest?.intentTags || []),
        ...(agent.manifest?.routing?.triggers || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

  return {
    schema: dbRegistrySchemaVersion,
    type: "hireme_db_agent_source_list",
    count: filtered.length,
    userId,
    agents: filtered.map((agent) =>
      publicDbAgent(agent, findActiveEntitlement(entitlementStore, {
        userId,
        agentId: agent.id,
      })),
    ),
    boundary:
      "DB Agent source returns public cards and entitlement state only. Protected Agent packages are not imported, decoded, extracted, or cached locally.",
  };
}

export async function getDbAgent({
  agents = defaultDbAgents(),
  stateRoot,
  currentUserId,
  current_user_id,
  agent_id,
  agentId,
} = {}) {
  const userId = normalizeUserId(current_user_id || currentUserId);
  const agent = findDbAgent(agents, agent_id || agentId);
  const entitlementStore = await readEntitlementStore(stateRoot);
  return {
    schema: dbRegistrySchemaVersion,
    type: "hireme_db_agent_source_agent",
    userId,
    agent: publicDbAgent(agent, findActiveEntitlement(entitlementStore, {
      userId,
      agentId: agent.id,
    })),
    privateMaterialAvailable: false,
    safeInspectionOnly: true,
  };
}

export async function grantDbEntitlement({
  agents = defaultDbAgents(),
  stateRoot,
  currentUserId,
  current_user_id,
  agent_id,
  agentId,
  access_type,
  accessType,
} = {}) {
  const userId = normalizeUserId(current_user_id || currentUserId);
  const agent = findDbAgent(agents, agent_id || agentId);
  const access = normalizeAccessType(access_type || accessType);
  const store = await readEntitlementStore(stateRoot);
  const existingIndex = store.entitlements.findIndex(
    (item) => item.userId === userId && item.agentId === agent.id,
  );
  const grantedAt = new Date().toISOString();
  const entitlement = {
    userId,
    agentId: agent.id,
    status: "active",
    access,
    source: "mock_db_agent_source",
    grantedAt,
    updatedAt: grantedAt,
    expiresAt: null,
    remainingTrialCalls: access === "try" ? 3 : null,
    runtimeOnly: agent.protection?.localMaterialization === "forbidden",
  };
  if (existingIndex >= 0) {
    store.entitlements[existingIndex] = {
      ...store.entitlements[existingIndex],
      ...entitlement,
      grantedAt: store.entitlements[existingIndex].grantedAt || grantedAt,
    };
  } else {
    store.entitlements.push(entitlement);
  }
  store.updatedAt = grantedAt;
  await writeEntitlementStore(stateRoot, store);
  return {
    schema: dbEntitlementSchemaVersion,
    type: "hireme_db_agent_source_entitlement_granted",
    entitlement: publicEntitlement(entitlement),
    agent: publicDbAgent(agent, entitlement),
    privateMaterialAvailable: false,
    nextAction: `hireme agent call ${agent.id} "<task>"`,
  };
}

export async function listDbEntitlements({
  stateRoot,
  currentUserId,
  current_user_id,
} = {}) {
  const userId = normalizeUserId(current_user_id || currentUserId);
  const store = await readEntitlementStore(stateRoot);
  const entitlements = store.entitlements.filter((item) => item.userId === userId);
  return {
    schema: dbEntitlementSchemaVersion,
    type: "hireme_db_agent_source_entitlement_list",
    userId,
    count: entitlements.length,
    entitlements: entitlements.map(publicEntitlement),
  };
}

export async function getDbEntitlement({
  agents = defaultDbAgents(),
  stateRoot,
  currentUserId,
  current_user_id,
  agent_id,
  agentId,
} = {}) {
  const userId = normalizeUserId(current_user_id || currentUserId);
  const id = String(agent_id || agentId || "").trim();
  const agent = findDbAgent(agents, id);
  const store = await readEntitlementStore(stateRoot);
  const entitlement = findActiveEntitlement(store, { userId, agentId: agent.id });
  const access = entitlementAccessState(entitlement);
  return {
    schema: dbEntitlementSchemaVersion,
    type: "hireme_db_agent_source_entitlement_check",
    userId,
    agent: publicDbAgent(agent, entitlement),
    entitlement: entitlement ? publicEntitlement(entitlement) : null,
    allowed: access.allowed,
    reason: access.reason,
    nextAction: access.allowed
      ? `hireme agent call ${agent.id} "<task>"`
      : `hireme marketplace hire ${agent.id}`,
  };
}

export async function consumeDbEntitlement({
  agents = defaultDbAgents(),
  stateRoot,
  currentUserId,
  current_user_id,
  agent_id,
  agentId,
} = {}) {
  const userId = normalizeUserId(current_user_id || currentUserId);
  const agent = findDbAgent(agents, agent_id || agentId);
  const store = await readEntitlementStore(stateRoot);
  const entitlementIndex = findActiveEntitlementIndex(store, {
    userId,
    agentId: agent.id,
  });
  if (entitlementIndex < 0) {
    return {
      schema: dbEntitlementSchemaVersion,
      type: "hireme_db_agent_source_entitlement_consumption",
      userId,
      agent: publicDbAgent(agent, null),
      entitlement: null,
      allowed: false,
      reason: "not_hired",
      trialCallsConsumed: 0,
      remainingTrialCalls: null,
      nextAction: `hireme marketplace hire ${agent.id}`,
    };
  }

  const current = store.entitlements[entitlementIndex];
  const access = entitlementAccessState(current);
  if (!access.allowed) {
    return {
      schema: dbEntitlementSchemaVersion,
      type: "hireme_db_agent_source_entitlement_consumption",
      userId,
      agent: publicDbAgent(agent, current),
      entitlement: publicEntitlement(current),
      allowed: false,
      reason: access.reason,
      trialCallsConsumed: 0,
      remainingTrialCalls: current.remainingTrialCalls ?? null,
      nextAction: `hireme marketplace hire ${agent.id}`,
    };
  }

  const updatedAt = new Date().toISOString();
  const next = {
    ...current,
    updatedAt,
  };
  let trialCallsConsumed = 0;
  if (current.access === "try") {
    trialCallsConsumed = 1;
    next.remainingTrialCalls = Math.max(
      0,
      Number.isFinite(Number(current.remainingTrialCalls))
        ? Number(current.remainingTrialCalls) - 1
        : 0,
    );
  }
  store.entitlements[entitlementIndex] = next;
  store.updatedAt = updatedAt;
  await writeEntitlementStore(stateRoot, store);

  return {
    schema: dbEntitlementSchemaVersion,
    type: "hireme_db_agent_source_entitlement_consumption",
    userId,
    agent: publicDbAgent(agent, next),
    entitlement: publicEntitlement(next),
    allowed: true,
    reason: "active_entitlement",
    trialCallsConsumed,
    remainingTrialCalls: next.remainingTrialCalls ?? null,
    nextAction: `hireme agent call ${agent.id} "<task>"`,
  };
}

function publicDbAgent(agent, entitlement = null) {
  const callAccess = entitlementAccessState(entitlement);
  return {
    id: agent.id,
    handle: `!${agent.id}`,
    name: agent.name,
    creator: agent.creator,
    creatorId: agent.creatorId,
    category: agent.category,
    status: agent.status,
    headline: agent.headline,
    publicSummary: agent.publicSummary,
    publicSkills: agent.publicSkills || [],
    manifest: publicDbManifest(agent.manifest),
    pricing: agent.marketplace?.price || null,
    billingPricing: agent.marketplace?.billingPricing || null,
    accessModel: agent.marketplace?.accessModel || "hire",
    tryCalls: agent.marketplace?.tryCalls || null,
    protection: agent.protection,
    runtime: {
      executionMode: agent.protection?.executionMode || "remote_trusted_executor",
      executionPolicy: publicExecutionPolicy(agent.manifest?.execution),
      localHarnessMaterialized: false,
      localPlaintextCache: false,
      runtimeOnly: agent.manifest?.execution?.defaultClass === "hosted_secure",
    },
    entitlement: entitlement ? publicEntitlement(entitlement) : null,
    callAccess: {
      allowed: callAccess.allowed,
      reason: callAccess.reason,
      nextAction: callAccess.allowed
        ? `hireme agent call ${agent.id} "<task>"`
        : `hireme marketplace hire ${agent.id}`,
    },
  };
}

function publicEntitlement(entitlement) {
  const access = entitlementAccessState(entitlement);
  return {
    userId: entitlement.userId,
    agentId: entitlement.agentId,
    status: entitlement.status,
    access: entitlement.access,
    grantedAt: entitlement.grantedAt,
    expiresAt: entitlement.expiresAt || null,
    remainingTrialCalls: entitlement.remainingTrialCalls ?? null,
    callAllowed: access.allowed,
    callReason: access.reason,
    runtimeOnly: entitlement.runtimeOnly === true,
  };
}

function publicDbManifest(manifest) {
  if (!manifest) return null;
  return {
    schema: manifest.schema,
    capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities : [],
    inputModes: Array.isArray(manifest.inputModes) ? manifest.inputModes : [],
    outputModes: Array.isArray(manifest.outputModes) ? manifest.outputModes : [],
    finalizers: Array.isArray(manifest.finalizers) ? manifest.finalizers : [],
    intentTags: Array.isArray(manifest.intentTags) ? manifest.intentTags : [],
    execution: publicExecutionPolicy(manifest.execution),
    routing: {
      priority: manifest.routing?.priority ?? null,
      triggers: Array.isArray(manifest.routing?.triggers) ? manifest.routing.triggers : [],
    },
  };
}

function findDbAgent(agents, agentId) {
  const id = String(agentId || "").trim();
  const agent = agents.find((candidate) => candidate.id === id || candidate.handle === id);
  if (!agent) {
    throw Object.assign(new Error(`DB Agent not found: ${id}`), {
      code: "db_agent_not_found",
    });
  }
  return agent;
}

function findActiveEntitlement(store, { userId, agentId }) {
  return store.entitlements.find(
    (item) =>
      item.userId === userId &&
      item.agentId === agentId &&
      item.status === "active" &&
      (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
  ) || null;
}

function findActiveEntitlementIndex(store, { userId, agentId }) {
  return store.entitlements.findIndex(
    (item) =>
      item.userId === userId &&
      item.agentId === agentId &&
      item.status === "active" &&
      (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
  );
}

function entitlementAccessState(entitlement) {
  if (!entitlement) return { allowed: false, reason: "not_hired" };
  if (entitlement.status !== "active") return { allowed: false, reason: "inactive_entitlement" };
  if (entitlement.expiresAt && Date.parse(entitlement.expiresAt) <= Date.now()) {
    return { allowed: false, reason: "expired_entitlement" };
  }
  if (entitlement.access === "hire") return { allowed: true, reason: "active_entitlement" };
  if (entitlement.access === "try") {
    const remaining = Number(entitlement.remainingTrialCalls ?? 0);
    return remaining > 0
      ? { allowed: true, reason: "active_trial" }
      : { allowed: false, reason: "trial_quota_exhausted" };
  }
  return { allowed: false, reason: "unsupported_entitlement" };
}

async function readEntitlementStore(stateRoot) {
  const path = entitlementStorePath(stateRoot);
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return normalizeEntitlementStore(parsed);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  const legacyPath = legacyEntitlementStorePath(stateRoot);
  try {
    const parsed = JSON.parse(await readFile(legacyPath, "utf8"));
    return normalizeEntitlementStore(parsed);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    return normalizeEntitlementStore({});
  }
}

async function writeEntitlementStore(stateRoot, store) {
  const path = entitlementStorePath(stateRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalizeEntitlementStore(store), null, 2)}\n`, "utf8");
}

function entitlementStorePath(stateRoot) {
  return join(resolve(stateRoot), "agent-sources", "db", "entitlements.json");
}

function legacyEntitlementStorePath(stateRoot) {
  return join(resolve(stateRoot), "marketplace", "entitlements.json");
}

function normalizeEntitlementStore(value) {
  return {
    schema: dbEntitlementSchemaVersion,
    updatedAt: value?.updatedAt || null,
    entitlements: Array.isArray(value?.entitlements) ? value.entitlements : [],
  };
}

function normalizeUserId(value) {
  return String(value || defaultUserId).trim() || defaultUserId;
}

function normalizeAccessType(value) {
  const text = String(value || "hire").trim().toLowerCase();
  return text === "try" ? "try" : "hire";
}
