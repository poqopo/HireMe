import {
  consumeDbEntitlement,
  defaultDbAgents,
  getDbAgent,
  getDbEntitlement,
  grantDbEntitlement,
  listDbAgents,
  listDbEntitlements,
} from "./dbAgentSource.mjs";

const marketplaceSchemaVersion = "hireme.marketplace.registry.v1";
const entitlementSchemaVersion = "hireme.marketplace.entitlements.v1";
const defaultUserId = "local-dev-user";

export function createMarketplaceTools({
  stateDir = ".hireme/standalone-agent/default",
  marketplaceAgents,
  dbAgents,
  currentUserId = process.env.HIREME_USER_ID || defaultUserId,
} = {}) {
  const agents = dbAgents || marketplaceAgents || defaultMarketplaceAgents();
  return [
    {
      name: "hireme_marketplace_list_agents",
      description:
        "List public DB Agent cards. Returns public metadata and local entitlement state only.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string" },
          current_user_id: { type: "string" },
        },
      },
      handler: async (args = {}) =>
        listMarketplaceAgents({
          agents,
          stateRoot: stateDir,
          currentUserId,
          ...args,
        }),
    },
    {
      name: "hireme_marketplace_get_agent",
      description:
        "Inspect one public DB Agent card. Never returns private Harness source or packages.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          current_user_id: { type: "string" },
        },
        required: ["agent_id"],
      },
      handler: async (args = {}) =>
        getMarketplaceAgent({
          agents,
          stateRoot: stateDir,
          currentUserId,
          ...args,
        }),
    },
    {
      name: "hireme_marketplace_hire_agent",
      description:
        "Grant a local mock Try/Hire entitlement for a DB Agent. Stores entitlement metadata only.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          access_type: { type: "string", enum: ["hire", "try"] },
          current_user_id: { type: "string" },
        },
        required: ["agent_id"],
      },
      handler: async (args = {}) =>
        hireMarketplaceAgent({
          agents,
          stateRoot: stateDir,
          currentUserId,
          ...args,
        }),
    },
    {
      name: "hireme_marketplace_list_entitlements",
      description:
        "List local mock DB Agent entitlements for the current user. Returns entitlement metadata only.",
      inputSchema: {
        type: "object",
        properties: {
          current_user_id: { type: "string" },
        },
      },
      handler: async (args = {}) =>
        listMarketplaceEntitlements({
          stateRoot: stateDir,
          currentUserId,
          ...args,
        }),
    },
    {
      name: "hireme_marketplace_get_entitlement",
      description:
        "Check whether the current user can call a DB Agent through the protected runtime.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          current_user_id: { type: "string" },
        },
        required: ["agent_id"],
      },
      handler: async (args = {}) =>
        getMarketplaceEntitlement({
          agents,
          stateRoot: stateDir,
          currentUserId,
          ...args,
        }),
    },
  ];
}

export function defaultMarketplaceAgents() {
  return defaultDbAgents();
}

export async function listMarketplaceAgents(options = {}) {
  const result = await listDbAgents(normalizeDbOptions(options));
  return withMarketplaceShape(result, {
    schema: marketplaceSchemaVersion,
    type: "hireme_marketplace_agent_list",
    boundary:
      "DB Agent cards are public metadata only. Protected Agent packages are not imported, decoded, extracted, or cached locally.",
  });
}

export async function getMarketplaceAgent(options = {}) {
  const result = await translateDbAgentNotFound(() => getDbAgent(normalizeDbOptions(options)));
  return withMarketplaceShape(result, {
    schema: marketplaceSchemaVersion,
    type: "hireme_marketplace_agent",
  });
}

export async function hireMarketplaceAgent(options = {}) {
  const result = await translateDbAgentNotFound(() =>
    grantDbEntitlement(normalizeDbOptions(options)),
  );
  return withMarketplaceShape(result, {
    schema: entitlementSchemaVersion,
    type: "hireme_marketplace_entitlement_granted",
  });
}

export async function listMarketplaceEntitlements(options = {}) {
  const result = await listDbEntitlements(normalizeDbOptions(options));
  return withMarketplaceShape(result, {
    schema: entitlementSchemaVersion,
    type: "hireme_marketplace_entitlement_list",
  });
}

export async function getMarketplaceEntitlement(options = {}) {
  const result = await translateDbAgentNotFound(() =>
    getDbEntitlement(normalizeDbOptions(options)),
  );
  return withMarketplaceShape(result, {
    schema: entitlementSchemaVersion,
    type: "hireme_marketplace_entitlement_check",
  });
}

export async function consumeMarketplaceCallEntitlement(options = {}) {
  const result = await translateDbAgentNotFound(() =>
    consumeDbEntitlement(normalizeDbOptions(options)),
  );
  return withMarketplaceShape(result, {
    schema: entitlementSchemaVersion,
    type: "hireme_marketplace_entitlement_consumption",
  });
}

function normalizeDbOptions(options = {}) {
  const { marketplaceAgents, dbAgents, agents, ...rest } = options;
  return {
    ...rest,
    agents: agents || dbAgents || marketplaceAgents || defaultDbAgents(),
  };
}

function withMarketplaceShape(result, overrides) {
  return {
    ...result,
    ...overrides,
  };
}

async function translateDbAgentNotFound(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === "db_agent_not_found") {
      err.code = "marketplace_agent_not_found";
    }
    throw err;
  }
}
