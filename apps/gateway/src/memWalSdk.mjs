import { createHash } from "node:crypto";
import { MemWal } from "@mysten-incubation/memwal";

const defaultServerUrl =
  process.env.MEMWAL_SERVER_URL ||
  process.env.HIREME_MEMWAL_SERVER_URL ||
  "https://relayer.memory.walrus.xyz";
const defaultNamespacePrefix =
  process.env.HIREME_MEMWAL_NAMESPACE_PREFIX || "hireme-mcp";
const defaultRecallLimit = Math.max(
  1,
  Math.trunc(Number(process.env.HIREME_MEMWAL_RECALL_LIMIT || "8") || 8),
);
const defaultRememberTimeoutMs = Math.max(
  5_000,
  Math.trunc(Number(process.env.HIREME_MEMWAL_REMEMBER_TIMEOUT_MS || "75000") || 75_000),
);

let cachedClient = null;
let cachedConfigKey = "";

export function isMemWalSdkConfigured() {
  const config = readMemWalSdkConfig();
  return Boolean(config.key && config.accountId);
}

export async function createMcpConversationSession({
  hirerId,
  sessionId,
  codexInstallationId,
  agentId,
  title,
  waitForStore = null,
}) {
  const client = getMemWalClient();
  const safeHirerId = normalizeNamespaceSegment(hirerId || "local-hirer");
  const safeSessionId = normalizeNamespaceSegment(sessionId || "default");
  const namespace = conversationNamespace(safeHirerId, safeSessionId);
  const indexNamespace = conversationIndexNamespace(safeHirerId);
  const createdAt = new Date().toISOString();
  const memoryText = formatConversationIndexMemory({
    hirerId: safeHirerId,
    sessionId: safeSessionId,
    codexInstallationId,
    agentId,
    title,
    createdAt,
    updatedAt: createdAt,
  });

  if (!client) {
    return notConfiguredConversationResult({
      hirerId: safeHirerId,
      sessionId: safeSessionId,
      namespace,
      title,
      activeAgentId: agentId,
    });
  }

  const indexJob = await rememberAndMaybeWait(client, memoryText, indexNamespace, {
    waitForStore,
  });
  return {
    status: "stored",
    kind: "mcp_conversation",
    provider: "memwal-sdk",
    hirerId: safeHirerId,
    sessionId: safeSessionId,
    conversationId: safeSessionId,
    conversation_id: safeSessionId,
    namespace,
    indexNamespace,
    recordPath: null,
    localCiphertextPath: null,
    publicRecord: {
      kind: "mcp_conversation",
      provider: "memwal-sdk",
      visibility: "owner-namespace",
      hirerId: safeHirerId,
      sessionId: safeSessionId,
      conversationId: safeSessionId,
      conversation_id: safeSessionId,
      title: normalizeTitle(title),
      activeAgentId: agentId || null,
      namespace,
      indexNamespace,
      memoryJobId: indexJob.job_id || indexJob.id || null,
      blobId: indexJob.blob_id || null,
      owner: indexJob.owner || null,
      waitForStore: indexJob.waitForStore,
      storeLatencyMs: indexJob.storeLatencyMs,
      safeSummary: {
        title: normalizeTitle(title),
        activeAgentId: agentId || null,
        namespace,
        rawMessagesReturnedInRecord: false,
      },
      plaintextStoredInDb: false,
      creatorCanReadPlaintext: false,
      publicCanReadPlaintext: false,
      createdAt,
      updatedAt: createdAt,
    },
  };
}

export async function appendMcpConversationTurn({
  hirerId,
  sessionId,
  codexInstallationId,
  agentId,
  title,
  callId,
  requestDigest,
  responseDigest,
  userMessage,
  assistantMessage,
  metadata,
  waitForStore = true,
}) {
  const client = getMemWalClient();
  const safeHirerId = normalizeNamespaceSegment(hirerId || "local-hirer");
  const safeSessionId = normalizeNamespaceSegment(sessionId || "default");
  const namespace = conversationNamespace(safeHirerId, safeSessionId);
  const indexNamespace = conversationIndexNamespace(safeHirerId);
  const createdAt = new Date().toISOString();
  const turnText = formatConversationTurnMemory({
    hirerId: safeHirerId,
    sessionId: safeSessionId,
    codexInstallationId,
    agentId,
    title,
    callId,
    requestDigest,
    responseDigest,
    userMessage,
    assistantMessage,
    metadata,
    createdAt,
  });
  const indexText = formatConversationIndexMemory({
    hirerId: safeHirerId,
    sessionId: safeSessionId,
    codexInstallationId,
    agentId,
    title,
    lastCallId: callId,
    updatedAt: createdAt,
  });

  if (!client) {
    return notConfiguredConversationResult({
      hirerId: safeHirerId,
      sessionId: safeSessionId,
      namespace,
      title,
      activeAgentId: agentId,
    });
  }

  const [turnJob, indexJob] = await Promise.all([
    rememberAndMaybeWait(client, turnText, namespace, { waitForStore }),
    rememberAndMaybeWait(client, indexText, indexNamespace, { waitForStore }),
  ]);

  return {
    status: "stored",
    kind: "mcp_conversation",
    provider: "memwal-sdk",
    hirerId: safeHirerId,
    sessionId: safeSessionId,
    conversationId: safeSessionId,
    conversation_id: safeSessionId,
    namespace,
    indexNamespace,
    recordPath: null,
    localCiphertextPath: null,
    publicRecord: {
      kind: "mcp_conversation",
      provider: "memwal-sdk",
      visibility: "owner-namespace",
      hirerId: safeHirerId,
      sessionId: safeSessionId,
      conversationId: safeSessionId,
      conversation_id: safeSessionId,
      title: normalizeTitle(title),
      activeAgentId: agentId || null,
      namespace,
      indexNamespace,
      memoryJobId: turnJob.job_id || turnJob.id || null,
      indexJobId: indexJob.job_id || indexJob.id || null,
      blobId: turnJob.blob_id || null,
      owner: turnJob.owner || null,
      waitForStore: Boolean(turnJob.waitForStore && indexJob.waitForStore),
      memoryStoreLatencyMs: turnJob.storeLatencyMs,
      indexStoreLatencyMs: indexJob.storeLatencyMs,
      turnCount: null,
      safeSummary: {
        title: normalizeTitle(title),
        activeAgentId: agentId || null,
        lastCallId: callId || null,
        requestDigest: requestDigest || null,
        responseDigest: responseDigest || null,
        namespace,
        rawMessagesReturnedInRecord: false,
      },
      plaintextStoredInDb: false,
      creatorCanReadPlaintext: false,
      publicCanReadPlaintext: false,
      updatedAt: createdAt,
    },
  };
}

export async function readMcpConversationSession({
  hirerId,
  sessionId,
  limit = defaultRecallLimit,
  query,
}) {
  const client = getMemWalClient();
  const safeHirerId = normalizeNamespaceSegment(hirerId || "local-hirer");
  const safeSessionId = normalizeNamespaceSegment(sessionId || "default");
  const namespace = conversationNamespace(safeHirerId, safeSessionId);
  const recallLimit = normalizeLimit(limit, defaultRecallLimit);

  if (!client) {
    return {
      status: "not_configured",
      kind: "mcp_conversation",
      provider: "memwal-sdk",
      configured: false,
      hirerId: safeHirerId,
      sessionId: safeSessionId,
      conversationId: safeSessionId,
      conversation_id: safeSessionId,
      namespace,
      totalTurns: null,
      returnedTurns: 0,
      turns: [],
      messages: [],
      plaintextReturnedToOwner: false,
      creatorCanReadPlaintext: false,
      publicCanReadPlaintext: false,
      reason: missingConfigReason(),
    };
  }

  const recall = await client.recall({
    query:
      query ||
      `Relevant prior HireMe MCP conversation turns for conversation ${safeSessionId}`,
    namespace,
    limit: recallLimit,
    maxDistance: readOptionalNumber(process.env.HIREME_MEMWAL_MAX_DISTANCE),
  });
  const turns = recall.results.map(mapRecallMemoryToTurn);
  return {
    status: "loaded",
    kind: "mcp_conversation",
    provider: "memwal-sdk",
    configured: true,
    hirerId: safeHirerId,
    sessionId: safeSessionId,
    conversationId: safeSessionId,
    conversation_id: safeSessionId,
    namespace,
    totalTurns: recall.total,
    returnedTurns: turns.length,
    turns,
    messages: turns.map((turn) => ({
      role: "memory",
      content: turn.content,
      agentId: turn.agentId,
      turnId: turn.id,
      distance: turn.distance,
      blobId: turn.blobId,
      createdAt: turn.createdAt,
    })),
    plaintextReturnedToOwner: true,
    creatorCanReadPlaintext: false,
    publicCanReadPlaintext: false,
  };
}

export async function listMcpConversationSessions({
  hirerId,
  limit = 20,
}) {
  const client = getMemWalClient();
  const safeHirerId = normalizeNamespaceSegment(hirerId || "local-hirer");
  const namespace = conversationIndexNamespace(safeHirerId);

  if (!client) {
    return {
      status: "not_configured",
      kind: "mcp_conversation_list",
      provider: "memwal-sdk",
      configured: false,
      hirerId: safeHirerId,
      namespace,
      count: 0,
      conversations: [],
      reason: missingConfigReason(),
    };
  }

  const recall = await client.recall({
    query: "HireMe MCP conversation index active chats recent sessions",
    namespace,
    limit: normalizeLimit(limit, 20),
  });
  const byId = new Map();
  for (const memory of recall.results) {
    const item = parseConversationIndexMemory(memory.text);
    const existing = byId.get(item.sessionId);
    if (!existing || memory.distance < existing.distance) {
      byId.set(item.sessionId, {
        ...item,
        conversationId: item.sessionId,
        conversation_id: item.sessionId,
        distance: memory.distance,
        blobId: memory.blob_id,
        namespace: conversationNamespace(safeHirerId, item.sessionId),
        plaintextReturnedInList: false,
      });
    }
  }

  return {
    status: "loaded",
    kind: "mcp_conversation_list",
    provider: "memwal-sdk",
    configured: true,
    hirerId: safeHirerId,
    namespace,
    count: byId.size,
    conversations: Array.from(byId.values()),
  };
}

export async function restoreMcpConversationNamespace({
  hirerId,
  sessionId,
  limit = 10,
}) {
  const client = getMemWalClient();
  const safeHirerId = normalizeNamespaceSegment(hirerId || "local-hirer");
  const safeSessionId = normalizeNamespaceSegment(sessionId || "default");
  const namespace = conversationNamespace(safeHirerId, safeSessionId);
  if (!client) {
    return {
      status: "not_configured",
      provider: "memwal-sdk",
      configured: false,
      namespace,
      reason: missingConfigReason(),
    };
  }
  return {
    status: "restored",
    provider: "memwal-sdk",
    ...(await client.restore(namespace, normalizeLimit(limit, 10))),
  };
}

function getMemWalClient() {
  const config = readMemWalSdkConfig();
  if (!config.key || !config.accountId) return null;
  const cacheKey = JSON.stringify(config);
  if (!cachedClient || cachedConfigKey !== cacheKey) {
    cachedClient = MemWal.create(config);
    cachedConfigKey = cacheKey;
  }
  return cachedClient;
}

function readMemWalSdkConfig() {
  return {
    key:
      process.env.MEMWAL_PRIVATE_KEY ||
      process.env.MEMWAL_DELEGATE_KEY ||
      process.env.HIREME_MEMWAL_PRIVATE_KEY ||
      process.env.HIREME_MEMWAL_DELEGATE_KEY ||
      "",
    accountId:
      process.env.MEMWAL_ACCOUNT_ID ||
      process.env.HIREME_MEMWAL_ACCOUNT_ID ||
      "",
    serverUrl: defaultServerUrl,
    namespace:
      process.env.MEMWAL_NAMESPACE ||
      process.env.HIREME_MEMWAL_NAMESPACE ||
      defaultNamespacePrefix,
  };
}

async function rememberAndMaybeWait(client, text, namespace, options = {}) {
  const startedAt = Date.now();
  if (shouldRememberAsync(options)) {
    return decorateRememberJob(await client.remember(text, namespace), {
      waitForStore: false,
      storeLatencyMs: Date.now() - startedAt,
    });
  }
  return decorateRememberJob(
    await client.rememberAndWait(text, namespace, {
      timeoutMs: defaultRememberTimeoutMs,
      pollIntervalMs: Math.max(
        250,
        Math.trunc(Number(process.env.HIREME_MEMWAL_POLL_INTERVAL_MS || "1000") || 1000),
      ),
    }),
    {
      waitForStore: true,
      storeLatencyMs: Date.now() - startedAt,
    },
  );
}

function shouldRememberAsync({ waitForStore = null } = {}) {
  if (waitForStore === true) return false;
  if (waitForStore === false) return true;
  return /^(1|true|yes|y|on)$/i.test(process.env.HIREME_MEMWAL_REMEMBER_ASYNC || "");
}

function decorateRememberJob(job, metadata) {
  if (job && typeof job === "object") {
    return {
      ...job,
      ...metadata,
    };
  }
  return {
    value: job,
    ...metadata,
  };
}

function formatConversationTurnMemory({
  hirerId,
  sessionId,
  codexInstallationId,
  agentId,
  title,
  callId,
  requestDigest,
  responseDigest,
  userMessage,
  assistantMessage,
  metadata,
  createdAt,
}) {
  return [
    "HireMe MCP conversation turn",
    `conversation_id: ${sessionId}`,
    `title: ${normalizeTitle(title)}`,
    `hirer_id: ${hirerId}`,
    `codex_installation_id: ${codexInstallationId || ""}`,
    `agent_id: ${agentId || ""}`,
    `call_id: ${callId || ""}`,
    `request_digest: ${requestDigest || ""}`,
    `response_digest: ${responseDigest || ""}`,
    `created_at: ${createdAt}`,
    "",
    "User message:",
    normalizeMemoryText(userMessage),
    "",
    "Assistant response:",
    normalizeMemoryText(assistantMessage),
    "",
    "Metadata:",
    JSON.stringify(sanitizeMetadata(metadata)),
  ].join("\n");
}

function formatConversationIndexMemory({
  hirerId,
  sessionId,
  codexInstallationId,
  agentId,
  title,
  lastCallId,
  createdAt,
  updatedAt,
}) {
  return [
    "HireMe MCP conversation index",
    `conversation_id: ${sessionId}`,
    `title: ${normalizeTitle(title)}`,
    `hirer_id: ${hirerId}`,
    `codex_installation_id: ${codexInstallationId || ""}`,
    `active_agent_id: ${agentId || ""}`,
    `last_call_id: ${lastCallId || ""}`,
    `created_at: ${createdAt || ""}`,
    `updated_at: ${updatedAt || new Date().toISOString()}`,
  ].join("\n");
}

function mapRecallMemoryToTurn(memory) {
  const text = memory.text || "";
  return {
    id: readLineValue(text, "call_id") || `mem_${sha256Hex(text).slice(0, 12)}`,
    kind: "recalled_memory",
    agentId: readLineValue(text, "agent_id") || null,
    callId: readLineValue(text, "call_id") || null,
    requestDigest: readLineValue(text, "request_digest") || null,
    responseDigest: readLineValue(text, "response_digest") || null,
    createdAt: readLineValue(text, "created_at") || null,
    blobId: memory.blob_id,
    distance: memory.distance,
    content: text,
  };
}

function parseConversationIndexMemory(text) {
  const sessionId = normalizeNamespaceSegment(
    readLineValue(text, "conversation_id") || "default",
  );
  return {
    sessionId,
    conversationId: sessionId,
    conversation_id: sessionId,
    title: readLineValue(text, "title") || "MCP conversation",
    activeAgentId: readLineValue(text, "active_agent_id") || null,
    codexInstallationId: readLineValue(text, "codex_installation_id") || null,
    lastCallId: readLineValue(text, "last_call_id") || null,
    createdAt: readLineValue(text, "created_at") || null,
    updatedAt: readLineValue(text, "updated_at") || null,
  };
}

function readLineValue(text, key) {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.*)$`, "im");
  return pattern.exec(text || "")?.[1]?.trim() || "";
}

function conversationNamespace(hirerId, sessionId) {
  return `${defaultNamespacePrefix}:${hirerId}:${sessionId}`;
}

function conversationIndexNamespace(hirerId) {
  return `${defaultNamespacePrefix}:${hirerId}:index`;
}

function notConfiguredConversationResult({
  hirerId,
  sessionId,
  namespace,
  title,
  activeAgentId,
}) {
  return {
    status: "not_configured",
    kind: "mcp_conversation",
    provider: "memwal-sdk",
    configured: false,
    hirerId,
    sessionId,
    conversationId: sessionId,
    conversation_id: sessionId,
    namespace,
    recordPath: null,
    localCiphertextPath: null,
    publicRecord: {
      kind: "mcp_conversation",
      provider: "memwal-sdk",
      visibility: "owner-namespace",
      hirerId,
      sessionId,
      conversationId: sessionId,
      conversation_id: sessionId,
      title: normalizeTitle(title),
      activeAgentId: activeAgentId || null,
      namespace,
      safeSummary: {
        title: normalizeTitle(title),
        activeAgentId: activeAgentId || null,
        namespace,
        rawMessagesReturnedInRecord: false,
      },
      plaintextStoredInDb: false,
      creatorCanReadPlaintext: false,
      publicCanReadPlaintext: false,
    },
    reason: missingConfigReason(),
  };
}

function missingConfigReason() {
  return "MEMWAL_PRIVATE_KEY or MEMWAL_DELEGATE_KEY and MEMWAL_ACCOUNT_ID are required for Walrus Memory SDK storage.";
}

function normalizeNamespaceSegment(value) {
  return String(value || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:@-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "default";
}

function normalizeTitle(value) {
  return String(value || "MCP conversation").trim().replace(/\s+/g, " ").slice(0, 120) || "MCP conversation";
}

function normalizeMemoryText(value) {
  return String(value || "").trim().slice(0, 20_000);
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  return JSON.parse(JSON.stringify(metadata, (_key, value) => {
    if (typeof value === "string") return value.slice(0, 2_000);
    return value;
  }));
}

function normalizeLimit(value, fallback) {
  return Math.min(100, Math.max(1, Math.trunc(Number(value ?? fallback) || fallback)));
}

function readOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
