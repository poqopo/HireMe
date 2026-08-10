import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const specialistMemoryItemSchema = "hireme.specialist_memory.item.v1";
export const specialistMemoryContextSchema = "hireme.specialist_memory.context.v1";
const specialistMemoryStoreSchema = "hireme.specialist_memory.store.v1";

const memoryPrecedence = ["current_request", "session", "user", "bootstrap"];
const sourceOrder = { session: 0, user: 1, bootstrap: 2 };
const privateMemoryPattern =
  /(?:OPENAI_API_KEY|API[_ -]?KEY|PASSWORD|PASSWD|ACCESS[_ -]?TOKEN|REFRESH[_ -]?TOKEN|BEARER\s+[A-Za-z0-9._-]{12,}|sk-[A-Za-z0-9_-]{16,}|BEGIN_PRIVATE|END_PRIVATE|archiveBase64|contentBase64|AGENTS\.md\s+content|scratchpad:)/i;

export function createSpecialistMemoryTools({
  stateDir = ".hireme/standalone-agent/default",
  workspaceDir = process.cwd(),
  specialistRoot = process.env.HIREME_LOCAL_SPECIALIST_ROOT ||
    "examples/local-specialist-agents",
  currentUserId = process.env.HIREME_USER_ID || "local-dev-user",
  defaultConversationId = "default-session",
  protectedAgents = [],
} = {}) {
  const store = createSpecialistMemoryStore({ stateDir });
  const localRoot = resolve(workspaceDir, specialistRoot);
  const runtimeOptions = (args = {}) => ({
    agentId: requiredAgentId(args.agent_id || args.agentId),
    userId: String(args.current_user_id || args.currentUserId || currentUserId),
    conversationId: String(
      args.conversation_id || args.conversationId || defaultConversationId,
    ),
  });
  return [
    {
      name: "hireme_get_agent_memory_status",
      description:
        "Get metadata-only Bootstrap, User, and Session Memory readiness for an Agent without returning memory contents.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          current_user_id: { type: "string" },
          conversation_id: { type: "string" },
        },
        required: ["agent_id"],
      },
      handler: async (args = {}) => {
        const options = runtimeOptions(args);
        const protectedAgent = protectedAgents.find((agent) => agent.id === options.agentId);
        const status = await store.status({
          ...options,
          agentRoot: protectedAgent ? undefined : join(localRoot, options.agentId),
          bootstrapRecords: protectedAgent?.bootstrapMemory,
        });
        return {
          type: "hireme_specialist_memory_status",
          agentId: options.agentId,
          ...status,
          protectedBootstrap: Boolean(protectedAgent),
          privacyBoundary: "Memory contents are intentionally omitted.",
        };
      },
    },
    {
      name: "hireme_remember_agent_session_memory",
      description:
        "Store hirer-visible memory for the current Agent conversation. Session Memory has the highest soft-memory priority.",
      inputSchema: memoryWriteInputSchema({ conversationRequired: true }),
      handler: async (args = {}) => {
        const options = runtimeOptions(args);
        const result = await store.rememberSession({
          ...options,
          records: args.records,
          source: "user_session_explicit",
          strict: true,
        });
        return publicMemoryWriteResult("session", options.agentId, result);
      },
    },
    {
      name: "hireme_remember_agent_user_memory",
      description:
        "Store explicit long-lived hirer-visible preferences for one user and Agent. Never writes Bootstrap Memory.",
      inputSchema: memoryWriteInputSchema({ conversationRequired: false }),
      handler: async (args = {}) => {
        const options = runtimeOptions(args);
        const result = await store.rememberUser({
          ...options,
          records: args.records,
          source: "user_confirmed",
          strict: true,
        });
        return publicMemoryWriteResult("user", options.agentId, result);
      },
    },
    {
      name: "hireme_promote_agent_session_memory",
      description:
        "Promote selected safe Session Memory into this user's durable Agent memory. Does not modify creator Bootstrap Memory.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          current_user_id: { type: "string" },
          conversation_id: { type: "string" },
          memory_ids: { type: "array", items: { type: "string" } },
          keys: { type: "array", items: { type: "string" } },
        },
        required: ["agent_id", "conversation_id"],
      },
      handler: async (args = {}) => {
        const options = runtimeOptions(args);
        const result = await store.promoteSession({
          ...options,
          memoryIds: args.memory_ids || args.memoryIds || [],
          keys: args.keys || [],
        });
        return {
          type: "hireme_specialist_memory_promotion",
          agentId: options.agentId,
          scope: "user",
          ...result,
          bootstrapModified: false,
        };
      },
    },
  ];
}

export function createSpecialistMemoryStore({
  stateDir = ".hireme/standalone-agent/default",
} = {}) {
  const stateRoot = resolve(stateDir);
  const memoryRoot = join(stateRoot, "specialist-memory");

  return {
    stateRoot,
    memoryRoot,
    async recall({
      agentRoot,
      bootstrapRecords,
      agentId,
      userId = "local-dev-user",
      conversationId = "default-session",
      query,
      sessionMemory = [],
      limits,
    } = {}) {
      const [bootstrap, userDocument, sessionDocument] = await Promise.all([
        bootstrapRecords
          ? normalizeMemoryCollection(bootstrapRecords, {
              scope: "bootstrap",
              source: "creator_bootstrap",
              defaultVisibility: "protected",
              strict: true,
            })
          : readBootstrapMemory({ agentRoot }).then((result) => result.records),
        readMemoryDocument(userMemoryPath(memoryRoot, userId, agentId)),
        readMemoryDocument(sessionMemoryPath(
          memoryRoot,
          userId,
          agentId,
          conversationId,
        )),
      ]);
      const explicitSession = normalizeMemoryCollection(sessionMemory, {
        scope: "session",
        source: "current_session",
        defaultVisibility: "hirer_visible",
        strict: true,
      });
      return resolveSpecialistMemoryLayers({
        bootstrap,
        user: userDocument.records,
        session: upsertMemoryRecords(sessionDocument.records, explicitSession),
        query,
        limits,
      });
    },
    async rememberSession({
      agentId,
      userId = "local-dev-user",
      conversationId = "default-session",
      records = [],
      source = "specialist_delta",
      strict = false,
    } = {}) {
      return writeScopedMemory({
        path: sessionMemoryPath(memoryRoot, userId, agentId, conversationId),
        agentId,
        scope: "session",
        source,
        records,
        strict,
      });
    },
    async rememberUser({
      agentId,
      userId = "local-dev-user",
      records = [],
      source = "user_confirmed",
      strict = true,
    } = {}) {
      return writeScopedMemory({
        path: userMemoryPath(memoryRoot, userId, agentId),
        agentId,
        scope: "user",
        source,
        records,
        strict,
      });
    },
    async promoteSession({
      agentId,
      userId = "local-dev-user",
      conversationId = "default-session",
      memoryIds = [],
      keys = [],
    } = {}) {
      const sessionDocument = await readMemoryDocument(sessionMemoryPath(
        memoryRoot,
        userId,
        agentId,
        conversationId,
      ));
      const idSet = new Set(memoryIds.map(String));
      const keySet = new Set(keys.map(normalizeMemoryKey).filter(Boolean));
      const selected = sessionDocument.records.filter((record) => (
        (!idSet.size && !keySet.size) || idSet.has(record.id) || keySet.has(record.key)
      ));
      const write = await this.rememberUser({
        agentId,
        userId,
        records: selected,
        source: "session_promoted",
        strict: true,
      });
      return {
        promoted: write.written,
        rejected: write.rejected,
        selected: selected.length,
      };
    },
    async status({
      agentRoot,
      bootstrapRecords,
      agentId,
      userId = "local-dev-user",
      conversationId = "default-session",
    } = {}) {
      const [bootstrap, userDocument, sessionDocument] = await Promise.all([
        bootstrapRecords
          ? Promise.resolve({
              records: normalizeMemoryCollection(bootstrapRecords, {
                scope: "bootstrap",
                source: "creator_bootstrap",
                defaultVisibility: "protected",
                strict: true,
              }),
              errors: [],
            })
          : readBootstrapMemory({ agentRoot }),
        readMemoryDocument(userMemoryPath(memoryRoot, userId, agentId)),
        readMemoryDocument(sessionMemoryPath(
          memoryRoot,
          userId,
          agentId,
          conversationId,
        )),
      ]);
      return {
        schema: specialistMemoryContextSchema,
        precedence: [...memoryPrecedence],
        bootstrap: bootstrapMemorySummary(bootstrap),
        user: memoryCollectionSummary(userDocument.records),
        session: memoryCollectionSummary(sessionDocument.records),
      };
    },
  };
}

export async function readBootstrapMemory({ agentRoot } = {}) {
  if (!agentRoot) {
    return { records: [], errors: ["agentRoot is required"], path: null };
  }
  const fallbackPath = join(resolve(agentRoot), "memory", "bootstrap.jsonl");
  let path;
  try {
    path = await resolveBootstrapMemoryFile(agentRoot);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        records: [],
        errors: ["memory/bootstrap.jsonl is required"],
        path: fallbackPath,
      };
    }
    throw error;
  }
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { records: [], errors: ["memory/bootstrap.jsonl is required"], path };
    }
    throw error;
  }
  const parsed = parseMemoryJsonl(text);
  const records = [];
  const errors = [...parsed.errors];
  for (const [index, record] of parsed.records.entries()) {
    try {
      records.push(normalizeMemoryRecord(record, {
        scope: "bootstrap",
        source: "creator_bootstrap",
        defaultVisibility: "protected",
      }));
    } catch (error) {
      errors.push(`line ${index + 1}: ${error?.message || String(error)}`);
    }
  }
  return { records: upsertMemoryRecords([], records), errors, path };
}

export async function upsertBootstrapMemory({
  agentRoot,
  records = [],
  replace = false,
} = {}) {
  if (!agentRoot) throw new Error("agentRoot is required");
  const current = replace ? { records: [], errors: [] } : await readBootstrapMemory({ agentRoot });
  if (current.errors.length && !replace) {
    throw Object.assign(new Error(`Bootstrap Memory is invalid: ${current.errors.join("; ")}`), {
      code: "invalid_bootstrap_memory",
      errors: current.errors,
    });
  }
  const normalized = normalizeMemoryCollection(records, {
    scope: "bootstrap",
    source: "creator_bootstrap",
    defaultVisibility: "protected",
    strict: true,
  });
  const next = upsertMemoryRecords(current.records, normalized);
  if (!next.length) throw new Error("Bootstrap Memory must include at least one record.");
  const path = await resolveBootstrapMemoryFile(agentRoot);
  await atomicWrite(path, serializeMemoryJsonl(next));
  return {
    path,
    count: next.length,
    added: normalized.length,
    digest: memoryDigest(next),
    records: next,
    items: next.map(memoryItemMetadata),
  };
}

export function buildStarterBootstrapMemory({ agentId, name, category } = {}) {
  const id = normalizeMemoryId(agentId || "agent");
  return normalizeMemoryCollection([
    {
      id: `${id}-quality-default`,
      key: "quality.default",
      kind: "principle",
      text: `For ${name || agentId || "this Agent"}, prefer task-specific and immediately usable results over generic advice.`,
      tags: [String(category || "other"), "quality"],
      priority: 60,
      starter: true,
    },
    {
      id: `${id}-output-language`,
      key: "output.language",
      kind: "preference",
      text: "Match the current user's language unless the requested deliverable requires another language.",
      tags: ["output", "language"],
      priority: 45,
      starter: true,
    },
  ], {
    scope: "bootstrap",
    source: "creator_bootstrap",
    defaultVisibility: "protected",
    strict: true,
  });
}

export function serializeMemoryJsonl(records = []) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function resolveSpecialistMemoryLayers({
  bootstrap = [],
  user = [],
  session = [],
  query,
  limits = {},
} = {}) {
  const selected = {
    bootstrap: rankMemory(bootstrap, query).slice(0, positiveLimit(limits.bootstrap, 5)),
    user: rankMemory(user, query).slice(0, positiveLimit(limits.user, 5)),
    session: rankMemory(session, query).slice(0, positiveLimit(limits.session, 8)),
  };
  const effectiveByKey = new Map();
  for (const scope of ["bootstrap", "user", "session"]) {
    for (const record of selected[scope]) {
      effectiveByKey.set(record.key || record.id, { ...record, scope });
    }
  }
  const effective = [...effectiveByKey.values()].sort((a, b) => (
    sourceOrder[a.scope] - sourceOrder[b.scope] ||
    Number(b.priority || 0) - Number(a.priority || 0)
  ));
  return {
    schema: specialistMemoryContextSchema,
    precedence: [...memoryPrecedence],
    directive:
      "The current request overrides all soft memory. Session Memory overrides User Memory, and User Memory overrides Bootstrap Memory. Harness policies and hard constraints are never overridden by memory.",
    available: {
      bootstrap: bootstrap.length,
      user: user.length,
      session: session.length,
    },
    selected,
    effective,
  };
}

export function toSpecialistMemoryEnvelope(context = {}) {
  return {
    schema: specialistMemoryContextSchema,
    precedence: [...memoryPrecedence],
    directive: context.directive,
    effective: (context.effective || []).map((record) => ({
      id: record.id,
      key: record.key,
      kind: record.kind,
      text: record.text,
      tags: record.tags || [],
      priority: record.priority,
      source: record.scope,
      visibility: record.visibility,
    })),
  };
}

export function publicSpecialistMemoryMetadata(context = {}, extra = {}) {
  const effectiveSources = { session: 0, user: 0, bootstrap: 0 };
  for (const record of context.effective || []) {
    if (effectiveSources[record.scope] !== undefined) effectiveSources[record.scope] += 1;
  }
  return {
    schema: specialistMemoryContextSchema,
    precedence: [...memoryPrecedence],
    available: {
      bootstrap: Number(context.available?.bootstrap || 0),
      user: Number(context.available?.user || 0),
      session: Number(context.available?.session || 0),
    },
    selected: {
      bootstrap: context.selected?.bootstrap?.length || 0,
      user: context.selected?.user?.length || 0,
      session: context.selected?.session?.length || 0,
    },
    effective: {
      count: context.effective?.length || 0,
      sources: effectiveSources,
    },
    ...extra,
  };
}

export function bootstrapMemorySummary(result = {}) {
  const records = result.records || [];
  return {
    valid: (result.errors || []).length === 0 && records.length > 0,
    count: records.length,
    starterCount: records.filter((record) => record.starter === true).length,
    customCount: records.filter((record) => record.starter !== true).length,
    digest: records.length ? memoryDigest(records) : null,
    errors: [...(result.errors || [])],
  };
}

export function memoryItemMetadata(record = {}) {
  return {
    id: record.id,
    key: record.key,
    kind: record.kind,
    tags: [...(record.tags || [])],
    priority: record.priority,
    scope: record.scope,
    visibility: record.visibility,
    starter: record.starter === true,
    sha256: `sha256:${sha256(JSON.stringify(record))}`,
  };
}

async function writeScopedMemory({ path, agentId, scope, source, records, strict }) {
  const normalized = [];
  const rejected = [];
  for (const record of Array.isArray(records) ? records : []) {
    try {
      normalized.push(normalizeMemoryRecord(record, {
        scope,
        source,
        defaultVisibility: "hirer_visible",
      }));
    } catch (error) {
      rejected.push(error?.message || String(error));
      if (strict) {
        throw Object.assign(new Error(rejected.at(-1)), {
          code: "unsafe_memory_record",
          rejected,
        });
      }
    }
  }
  const current = await readMemoryDocument(path);
  const next = upsertMemoryRecords(current.records, normalized);
  if (normalized.length) {
    await writeMemoryDocument(path, { agentId, scope, records: next });
  }
  return {
    written: normalized.length,
    rejected: rejected.length,
    total: next.length,
    items: normalized.map(memoryItemMetadata),
    records: normalized,
  };
}

function normalizeMemoryCollection(records, options) {
  const normalized = [];
  const rejected = [];
  for (const record of Array.isArray(records) ? records : []) {
    try {
      normalized.push(normalizeMemoryRecord(record, options));
    } catch (error) {
      rejected.push(error?.message || String(error));
      if (options?.strict) throw error;
    }
  }
  return upsertMemoryRecords([], normalized);
}

function normalizeMemoryRecord(record, {
  scope,
  source,
  defaultVisibility,
} = {}) {
  if (!record || typeof record !== "object") throw new Error("Memory record must be an object.");
  const text = String(record.text || record.value || record.content || "").trim();
  if (!text) throw new Error("Memory record text is required.");
  if (text.length > 1600) throw new Error("Memory record text must be 1600 characters or fewer.");
  if (privateMemoryPattern.test(text)) {
    throw new Error("Memory record contains credentials or protected raw-content markers.");
  }
  const normalizedScope = normalizeScope(scope || record.scope);
  const visibility = String(record.visibility || defaultVisibility || (
    normalizedScope === "bootstrap" ? "protected" : "hirer_visible"
  ));
  if (normalizedScope !== "bootstrap" && visibility !== "hirer_visible") {
    throw new Error("Session and User Memory must be hirer_visible.");
  }
  const key = normalizeMemoryKey(record.key || record.topic || record.id || text);
  const id = normalizeMemoryId(record.id || `memory-${sha256(`${key}\u0000${text}`).slice(0, 16)}`);
  return {
    schema: specialistMemoryItemSchema,
    id,
    key,
    kind: normalizeKind(record.kind || record.type),
    text,
    tags: normalizeTags(record.tags),
    priority: clampPriority(record.priority),
    scope: normalizedScope,
    visibility,
    source: String(record.source || source || "unspecified").slice(0, 80),
    starter: record.starter === true,
  };
}

function upsertMemoryRecords(current = [], incoming = []) {
  const byKey = new Map();
  for (const record of [...current, ...incoming]) {
    byKey.set(record.key || record.id, record);
  }
  return [...byKey.values()];
}

function rankMemory(records, query) {
  const terms = tokenize(query);
  return records
    .map((record, index) => ({
      record,
      index,
      score: memoryScore(record, terms),
    }))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .map((item) => item.record);
}

function memoryScore(record, terms) {
  const priorityScore = Number(record.priority || 0) / 100;
  if (!terms.length) return priorityScore;
  const haystack = `${record.key} ${record.text} ${(record.tags || []).join(" ")}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 4 : 0), priorityScore);
}

async function readMemoryDocument(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (value?.schema !== specialistMemoryStoreSchema || !Array.isArray(value.records)) {
      return { schema: specialistMemoryStoreSchema, records: [] };
    }
    return {
      schema: specialistMemoryStoreSchema,
      records: normalizeMemoryCollection(value.records, {
        scope: value.scope,
        source: "stored_memory",
        defaultVisibility: "hirer_visible",
        strict: false,
      }),
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { schema: specialistMemoryStoreSchema, records: [] };
    throw error;
  }
}

async function writeMemoryDocument(path, { agentId, scope, records }) {
  await atomicWrite(path, `${JSON.stringify({
    schema: specialistMemoryStoreSchema,
    agentId,
    scope,
    updatedAt: new Date().toISOString(),
    records,
  }, null, 2)}\n`);
}

async function atomicWrite(path, text) {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(tempPath, text, "utf8");
  await rename(tempPath, path);
}

async function resolveBootstrapMemoryFile(agentRoot) {
  const lexicalAgentRoot = resolve(agentRoot);
  const rootInfo = await lstat(lexicalAgentRoot);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw Object.assign(new Error("Bootstrap Memory Agent root is not a managed directory."), {
      code: "path_outside_agent",
    });
  }
  const canonicalAgentRoot = await realpath(lexicalAgentRoot);
  const memoryDir = join(canonicalAgentRoot, "memory");
  const memoryInfo = await lstat(memoryDir).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (memoryInfo?.isSymbolicLink() || (memoryInfo && !memoryInfo.isDirectory())) {
    throw Object.assign(new Error("Bootstrap Memory directory cannot be a file alias."), {
      code: "path_outside_agent",
    });
  }
  if (memoryInfo && await realpath(memoryDir) !== memoryDir) {
    throw Object.assign(new Error("Bootstrap Memory directory escapes the managed Agent."), {
      code: "path_outside_agent",
    });
  }

  const path = join(memoryDir, "bootstrap.jsonl");
  const fileInfo = await lstat(path).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (fileInfo?.isSymbolicLink() || (fileInfo?.isFile() && fileInfo.nlink > 1)) {
    throw Object.assign(new Error("Bootstrap Memory file cannot be an alias."), {
      code: "path_outside_agent",
    });
  }
  if (fileInfo && await realpath(path) !== path) {
    throw Object.assign(new Error("Bootstrap Memory file escapes the managed Agent."), {
      code: "path_outside_agent",
    });
  }
  return path;
}

function parseMemoryJsonl(text) {
  const records = [];
  const errors = [];
  for (const [index, line] of String(text || "").split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      errors.push(`line ${index + 1}: invalid JSON`);
    }
  }
  return { records, errors };
}

function userMemoryPath(root, userId, agentId) {
  return join(root, "users", scopePathId(userId), `${normalizeMemoryId(agentId)}.json`);
}

function sessionMemoryPath(root, userId, agentId, conversationId) {
  return join(
    root,
    "sessions",
    scopePathId(userId),
    normalizeMemoryId(agentId),
    `${scopePathId(conversationId)}.json`,
  );
}

function scopePathId(value) {
  return sha256(String(value || "default")).slice(0, 24);
}

function normalizeMemoryId(value) {
  return String(value || "memory")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "memory";
}

function normalizeMemoryKey(value) {
  return String(value || "memory.default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "memory.default";
}

function normalizeScope(value) {
  const scope = String(value || "session").toLowerCase();
  if (!["bootstrap", "user", "session"].includes(scope)) {
    throw new Error(`Unsupported memory scope: ${scope}`);
  }
  return scope;
}

function normalizeKind(value) {
  const kind = String(value || "note").toLowerCase();
  return ["principle", "preference", "case", "failure", "fact", "note"].includes(kind)
    ? kind
    : "note";
}

function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20))];
}

function clampPriority(value) {
  const priority = Number(value);
  if (!Number.isFinite(priority)) return 50;
  return Math.max(0, Math.min(100, Math.round(priority)));
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9가-힣_/-]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function positiveLimit(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function memoryCollectionSummary(records = []) {
  return {
    count: records.length,
    digest: records.length ? memoryDigest(records) : null,
  };
}

function memoryDigest(records) {
  return `sha256:${sha256(records
    .map((record) => JSON.stringify(record))
    .sort()
    .join("\n"))}`;
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function memoryWriteInputSchema({ conversationRequired }) {
  return {
    type: "object",
    properties: {
      agent_id: { type: "string" },
      current_user_id: { type: "string" },
      conversation_id: { type: "string" },
      records: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            key: { type: "string" },
            kind: { type: "string" },
            text: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            priority: { type: "number" },
            visibility: { type: "string", enum: ["hirer_visible"] },
          },
          required: ["text"],
        },
      },
    },
    required: conversationRequired
      ? ["agent_id", "conversation_id", "records"]
      : ["agent_id", "records"],
  };
}

function publicMemoryWriteResult(scope, agentId, result) {
  return {
    type: "hireme_specialist_memory_write",
    agentId,
    scope,
    written: result.written,
    rejected: result.rejected,
    total: result.total,
    items: result.items,
    bootstrapModified: false,
    privacyBoundary: "Memory text is not echoed in tool output.",
  };
}

function requiredAgentId(value) {
  const id = normalizeMemoryId(value);
  if (!String(value || "").trim()) throw new Error("agent_id is required");
  return id;
}
