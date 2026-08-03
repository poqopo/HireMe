import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";

const usageLedgerEntrySchema = "hireme.usage_ledger.entry.v1";
const usageLedgerListSchema = "hireme.usage_ledger.list.v1";
const defaultUserId = "local-dev-user";

export function createUsageLedgerTools({
  stateDir = ".hireme/standalone-agent/default",
  currentUserId = process.env.HIREME_USER_ID || defaultUserId,
} = {}) {
  const stateRoot = resolve(stateDir);
  return [
    {
      name: "hireme_list_usage_ledger",
      description:
        "List safe HireMe Agent usage ledger entries. The ledger stores task digests and call metadata, not raw task text or private Harness contents.",
      inputSchema: {
        type: "object",
        properties: {
          current_user_id: { type: "string" },
          agent_id: { type: "string" },
          source: { type: "string", enum: ["local", "db", "not_found"] },
          limit: { type: "integer" },
        },
      },
      handler: async (args = {}) =>
        listUsageLedger({
          stateRoot,
          currentUserId,
          ...args,
        }),
    },
  ];
}

export async function appendUsageLedgerEntry({ stateRoot, entry } = {}) {
  const normalized = normalizeUsageEntry(entry);
  const path = usageLedgerPath(stateRoot);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(normalized)}\n`, "utf8");
  return normalized;
}

export async function listUsageLedger({
  stateRoot,
  currentUserId,
  current_user_id,
  agent_id,
  agentId,
  source,
  limit = 50,
} = {}) {
  const userId = normalizeUserId(current_user_id || currentUserId);
  const wantedAgentId = String(agent_id || agentId || "").trim();
  const wantedSource = String(source || "").trim();
  const entries = await readUsageLedgerEntries(stateRoot);
  const filtered = entries
    .filter((entry) => !userId || entry.userId === userId)
    .filter((entry) => !wantedAgentId || entry.agentId === wantedAgentId)
    .filter((entry) => !wantedSource || entry.source === wantedSource)
    .slice(-Math.max(1, Number(limit) || 50))
    .reverse();
  return {
    schema: usageLedgerListSchema,
    type: "hireme_usage_ledger_list",
    userId,
    count: filtered.length,
    entries: filtered,
    privacyBoundary:
      "Usage ledger entries store task hashes and safe call metadata only. Raw tasks and private Harness contents are not stored.",
  };
}

async function readUsageLedgerEntries(stateRoot) {
  const path = usageLedgerPath(stateRoot);
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    try {
      text = await readFile(legacyUsageLedgerPath(stateRoot), "utf8");
    } catch (legacyErr) {
      if (legacyErr?.code === "ENOENT") return [];
      throw legacyErr;
    }
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function normalizeUsageEntry(entry = {}) {
  const task = String(entry.task || "");
  return {
    schema: usageLedgerEntrySchema,
    id: entry.id || randomUUID(),
    at: entry.at || new Date().toISOString(),
    userId: normalizeUserId(entry.userId),
    agentId: String(entry.agentId || ""),
    source: entry.source || "unknown",
    sourceKind: entry.sourceKind || null,
    callMode: entry.callMode || null,
    status: entry.status || "unknown",
    responseMode: entry.responseMode || null,
    outcome: entry.outcome || entry.status || "unknown",
    entitlementAccess: entry.entitlementAccess || null,
    entitlementReason: entry.entitlementReason || null,
    trialCallsConsumed: Number(entry.trialCallsConsumed || 0),
    remainingTrialCalls: entry.remainingTrialCalls ?? null,
    taskSha256: task ? sha256(task) : null,
    taskChars: task.length,
    runtime: {
      executionMode: entry.runtime?.executionMode || null,
      operationId: entry.runtime?.operationId || null,
      billingKey: entry.runtime?.billingKey || null,
      localHarnessMaterialized: entry.runtime?.localHarnessMaterialized ?? null,
      localPlaintextCache: entry.runtime?.localPlaintextCache ?? null,
      packageDeliveredToDevice: entry.runtime?.packageDeliveredToDevice ?? null,
      protectionStrength: entry.runtime?.protectionStrength || null,
      attackDetected: entry.runtime?.attackDetected === true,
      outputSanitized: entry.runtime?.outputSanitized === true,
      safeOutputOnly: entry.runtime?.safeOutputOnly ?? null,
    },
    sourceResolution: entry.sourceResolution || null,
  };
}

function usageLedgerPath(stateRoot) {
  return join(resolve(stateRoot), "agent-sources", "usage-ledger.jsonl");
}

function legacyUsageLedgerPath(stateRoot) {
  return join(resolve(stateRoot), "marketplace", "usage-ledger.jsonl");
}

function normalizeUserId(value) {
  return String(value || defaultUserId).trim() || defaultUserId;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
