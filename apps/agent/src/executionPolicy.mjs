export const executionPolicySchema = "hireme.agent_execution_policy.v1";
export const creatorWorkerExecution = "creator_worker";
export const legacyLocalProtectedExecution = "local_protected";
export const hostedSecureExecution = "hosted_secure";

// local_protected remains parseable for previously published packages, but new
// Desktop publication and generated Agents use creator_worker.
const executionClasses = new Set([creatorWorkerExecution, legacyLocalProtectedExecution, hostedSecureExecution]);

export function normalizeExecutionPolicy(value, {
  defaultClass = creatorWorkerExecution,
} = {}) {
  const input = value && typeof value === "object" ? value : {};
  const normalizedDefault = normalizeExecutionClass(input.defaultClass || defaultClass);
  const operations = normalizeOperations(input.operations, normalizedDefault);
  return {
    schema: executionPolicySchema,
    defaultClass: normalizedDefault,
    operations,
    bundles: {
      creatorWorker: creatorWorkerExecution,
      legacyLocalProtected: legacyLocalProtectedExecution,
      hostedSecure: "hosted_secure",
    },
  };
}

export function validateExecutionPolicy(value) {
  const errors = [];
  if (!value || typeof value !== "object") {
    return { valid: false, errors: ["manifest.execution must be an object"] };
  }
  if (value.schema !== executionPolicySchema) {
    errors.push(`manifest.execution.schema must be ${executionPolicySchema}`);
  }
  if (!executionClasses.has(value.defaultClass)) {
    errors.push("manifest.execution.defaultClass must be creator_worker, local_protected (legacy), or hosted_secure");
  }
  if (!Array.isArray(value.operations) || !value.operations.length) {
    errors.push("manifest.execution.operations must include at least one operation");
  }
  const ids = new Set();
  for (const operation of Array.isArray(value.operations) ? value.operations : []) {
    if (!/^[a-z0-9][a-z0-9._-]{1,80}$/.test(String(operation?.id || ""))) {
      errors.push("execution operation id is invalid");
    }
    if (ids.has(operation?.id)) errors.push(`duplicate execution operation: ${operation.id}`);
    ids.add(operation?.id);
    if (!executionClasses.has(operation?.executionClass)) {
      errors.push(`execution class is invalid for operation: ${operation?.id || "unknown"}`);
    }
    if (!Array.isArray(operation?.triggers)) {
      errors.push(`execution triggers must be an array for operation: ${operation?.id || "unknown"}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function selectExecutionPolicy({
  policy,
  task,
  operationId,
  requestedExecutionClass,
} = {}) {
  const normalized = normalizeExecutionPolicy(policy, {
    defaultClass: policy?.defaultClass || creatorWorkerExecution,
  });
  const requestedOperation = String(operationId || "").trim();
  let selected = requestedOperation
    ? normalized.operations.find((operation) => operation.id === requestedOperation)
    : null;
  let reason = selected ? "operation_requested" : "default_execution_class";

  if (!selected) {
    const text = String(task || "").toLowerCase();
    const matches = normalized.operations
      .map((operation) => ({
        operation,
        score: executionTriggerScore(operation, text),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => (
        right.score - left.score ||
        Number(right.operation.priority || 0) - Number(left.operation.priority || 0)
      ));
    if (matches[0]) {
      selected = matches[0].operation;
      reason = "task_trigger_match";
    }
  }

  selected ||= normalized.operations.find((operation) => (
    operation.executionClass === normalized.defaultClass && operation.default === true
  ));
  selected ||= normalized.operations.find((operation) => (
    operation.executionClass === normalized.defaultClass
  ));
  selected ||= normalized.operations[0];

  let executionClass = selected?.executionClass || normalized.defaultClass;
  const requestedClass = requestedExecutionClass
    ? normalizeExecutionClass(requestedExecutionClass)
    : null;
  if (requestedClass === hostedSecureExecution && executionClass === creatorWorkerExecution) {
    executionClass = hostedSecureExecution;
    reason = "user_security_upgrade";
  }

  return {
    schema: executionPolicySchema,
    operationId: selected?.id || "default",
    executionClass,
    billingKey: selected?.billingKey || executionClass,
    reason,
    downgradeAllowed: false,
    userProviderAllowed: false,
    creatorProviderRequired: executionClass === creatorWorkerExecution,
    packageDeliveredToDevice: false,
    executedOnCreatorWorker: executionClass === creatorWorkerExecution,
    legacyLocalProtected: executionClass === legacyLocalProtectedExecution,
  };
}

export function publicExecutionPolicy(value) {
  const policy = normalizeExecutionPolicy(value);
  return {
    schema: policy.schema,
    defaultClass: policy.defaultClass,
    operations: policy.operations.map((operation) => ({
      id: operation.id,
      title: operation.title,
      executionClass: operation.executionClass,
      billingKey: operation.billingKey,
      default: operation.default,
    })),
    bundles: policy.bundles,
  };
}

export function isHostedSecureOnlyPath(value) {
  const parts = normalizePathParts(value);
  return parts.includes("secure") || parts.includes("hosted-secure");
}

export function isLocalProtectedOnlyPath(value) {
  const parts = normalizePathParts(value);
  return parts.includes("local-only") || parts.includes("local-protected");
}

function normalizeOperations(value, defaultClass) {
  const source = Array.isArray(value) && value.length
    ? value
    : [{
        id: "standard",
        title: "Standard operation",
        executionClass: defaultClass,
        billingKey: defaultClass,
        default: true,
        priority: 0,
        triggers: [],
      }];
  const seen = new Set();
  const operations = [];
  for (const [index, item] of source.entries()) {
    const id = safeOperationId(item?.id || `operation-${index + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);
    const executionClass = normalizeExecutionClass(item?.executionClass || defaultClass);
    operations.push({
      id,
      title: String(item?.title || id).trim().slice(0, 120),
      executionClass,
      billingKey: safeOperationId(item?.billingKey || executionClass),
      default: item?.default === true,
      priority: boundedInteger(item?.priority, 0, 1000),
      triggers: normalizeStringArray(item?.triggers, 40, 120),
    });
  }
  if (!operations.some((operation) => operation.default)) {
    const preferred = operations.find((operation) => operation.executionClass === defaultClass);
    if (preferred) preferred.default = true;
  }
  return operations;
}

function executionTriggerScore(operation, text) {
  let score = 0;
  let matched = false;
  for (const trigger of operation.triggers || []) {
    const normalized = String(trigger || "").trim().toLowerCase();
    if (!normalized || !text.includes(normalized)) continue;
    matched = true;
    score += normalized.length >= 8 ? 30 : 18;
  }
  return matched ? score + Math.max(0, Number(operation.priority || 0)) : 0;
}

function normalizeExecutionClass(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!executionClasses.has(normalized)) {
    throw new Error(`Unsupported execution class: ${value}`);
  }
  return normalized;
}

function normalizeStringArray(value, maxItems, maxLength) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim().slice(0, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function safeOperationId(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!/^[a-z0-9][a-z0-9._-]{1,80}$/.test(normalized)) {
    throw new Error(`Invalid execution operation id: ${value}`);
  }
  return normalized;
}

function boundedInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizePathParts(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}
