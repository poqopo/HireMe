import { createHash } from "node:crypto";

export const agentGraphSchema = "hireme.agent_graph.v1";
export const agentGraphCheckpointSchema = "hireme.agent_graph.checkpoint.v1";

const nodeTypes = new Set([
  "intake",
  "analyze",
  "decide",
  "explore",
  "produce",
  "evaluate",
  "human_gate",
  "deliver",
]);

const terminalStatuses = new Set(["completed", "blocked", "failed", "canceled", "waiting_for_human"]);

export function createDefaultAgentGraph({
  agentId,
  revision = 1,
  skillRefs = [],
  maxRevisionAttempts = 2,
  authoringDigest = null,
} = {}) {
  const id = normalizeId(agentId, "agentId");
  const skills = [...new Set(skillRefs.map((value) => String(value || "").trim()).filter(Boolean))];
  const graph = {
    schema: agentGraphSchema,
    id: `${id.slice(0, 70)}-workflow`,
    agentId: id,
    revision: Number.isInteger(Number(revision)) && Number(revision) > 0 ? Number(revision) : 1,
    authoringDigest: authoringDigest || null,
    entryNodeId: "intake",
    terminalNodeIds: ["deliver"],
    budgets: {
      maxSteps: 24,
      maxRevisionAttempts: clampInteger(maxRevisionAttempts, 1, 5, 2),
    },
    nodes: [
      graphNode("intake", "intake", "brief-interpretation", []),
      graphNode("analyze", "analyze", skills[0] || "core-workflow", ["asset.inspect"]),
      graphNode("decide", "decide", skills[1] || "domain-checklist", []),
      graphNode("explore", "explore", skills[2] || "concept-divergence", ["reference.search"]),
      graphNode("produce", "produce", skills[3] || "core-workflow", ["artifact.create"]),
      graphNode("evaluate", "evaluate", "design-quality-critique", ["artifact.inspect"]),
      graphNode("human-gate", "human_gate", null, []),
      graphNode("deliver", "deliver", "delivery-specification", ["artifact.deliver"]),
    ],
    edges: [
      edge("intake", "analyze", "completed"),
      edge("analyze", "decide", "completed"),
      edge("decide", "explore", "completed"),
      edge("explore", "produce", "completed"),
      edge("produce", "evaluate", "completed"),
      edge("evaluate", "human-gate", "passed"),
      edge("evaluate", "produce", "revise", { loop: "revision", maxTraversals: clampInteger(maxRevisionAttempts, 1, 5, 2) }),
      edge("human-gate", "deliver", "approved"),
      edge("human-gate", "produce", "revision_requested", { loop: "revision", maxTraversals: clampInteger(maxRevisionAttempts, 1, 5, 2) }),
    ],
  };
  const validation = validateAgentGraph(graph);
  if (!validation.valid) throw graphError(validation.errors);
  return graph;
}

export function validateAgentGraph(graph, { allowedCapabilities = null } = {}) {
  const errors = [];
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) {
    return validationResult(["graph must be an object"]);
  }
  if (graph.schema !== agentGraphSchema) errors.push(`schema must be ${agentGraphSchema}`);
  if (!validId(graph.id)) errors.push("id must be a lowercase graph identifier");
  if (!validId(graph.agentId)) errors.push("agentId must be a lowercase Agent identifier");
  if (!Number.isInteger(graph.revision) || graph.revision < 1) errors.push("revision must be a positive integer");
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) errors.push("nodes must be a non-empty array");
  if (!Array.isArray(graph.edges)) errors.push("edges must be an array");
  if (!Array.isArray(graph.terminalNodeIds) || graph.terminalNodeIds.length === 0) {
    errors.push("terminalNodeIds must be a non-empty array");
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeMap = new Map();
  const allowed = allowedCapabilities ? new Set(allowedCapabilities.map(String)) : null;
  for (const node of nodes) {
    if (!validId(node?.id)) {
      errors.push("every node requires a valid id");
      continue;
    }
    if (nodeMap.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    nodeMap.set(node.id, node);
    if (!nodeTypes.has(node.type)) errors.push(`unsupported node type for ${node.id}: ${node.type}`);
    if (!Array.isArray(node.capabilities)) errors.push(`node capabilities must be an array: ${node.id}`);
    for (const capability of Array.isArray(node.capabilities) ? node.capabilities : []) {
      if (!/^[a-z][a-z0-9_.-]{1,80}$/.test(String(capability))) {
        errors.push(`invalid capability on ${node.id}: ${capability}`);
      } else if (allowed && !allowed.has(String(capability))) {
        errors.push(`capability is not allowed on ${node.id}: ${capability}`);
      }
    }
    if (!node.inputSchemaRef || !node.outputSchemaRef) {
      errors.push(`node schema references are required: ${node.id}`);
    }
    if (!Array.isArray(node.completionGate) || node.completionGate.length === 0) {
      errors.push(`node completionGate must be a non-empty array: ${node.id}`);
    }
  }

  if (!nodeMap.has(graph.entryNodeId)) errors.push("entryNodeId must reference a node");
  for (const id of Array.isArray(graph.terminalNodeIds) ? graph.terminalNodeIds : []) {
    if (!nodeMap.has(id)) errors.push(`terminal node does not exist: ${id}`);
  }

  const edgeKeys = new Set();
  for (const item of edges) {
    if (!nodeMap.has(item?.from)) errors.push(`edge source does not exist: ${item?.from}`);
    if (!nodeMap.has(item?.to)) errors.push(`edge target does not exist: ${item?.to}`);
    if (!String(item?.when || "").trim()) errors.push(`edge condition is required: ${item?.from || "?"}->${item?.to || "?"}`);
    const key = `${item?.from}:${item?.when}:${item?.to}`;
    if (edgeKeys.has(key)) errors.push(`duplicate edge: ${key}`);
    edgeKeys.add(key);
    if (item?.loop) {
      if (item.loop !== "revision") errors.push(`unsupported loop kind: ${item.loop}`);
      if (!Number.isInteger(item.maxTraversals) || item.maxTraversals < 1 || item.maxTraversals > 5) {
        errors.push(`loop edge requires maxTraversals from 1 to 5: ${key}`);
      }
    }
    const sourceNode = nodeMap.get(item?.from);
    const targetNode = nodeMap.get(item?.to);
    if (
      sourceNode && targetNode &&
      sourceNode.outputSchemaRef !== targetNode.inputSchemaRef
    ) {
      errors.push(`edge schema mismatch: ${item.from}->${item.to}`);
    }
  }

  if (nodeMap.has(graph.entryNodeId)) {
    const reachable = reachableNodes(graph.entryNodeId, edges);
    for (const id of nodeMap.keys()) {
      if (!reachable.has(id)) errors.push(`unreachable node: ${id}`);
    }
    for (const id of reachable) {
      if (!(graph.terminalNodeIds || []).includes(id) && !edges.some((item) => item.from === id)) {
        errors.push(`non-terminal node has no outgoing edge: ${id}`);
      }
    }
  }

  for (const component of stronglyConnectedComponents([...nodeMap.keys()], edges)) {
    const cyclic = component.length > 1 || edges.some((item) => item.from === component[0] && item.to === component[0]);
    if (!cyclic) continue;
    const internalEdges = edges.filter((item) => component.includes(item.from) && component.includes(item.to));
    const loopEdges = internalEdges.filter((item) => item.loop === "revision");
    if (!loopEdges.length || loopEdges.some((item) => !Number.isInteger(item.maxTraversals))) {
      errors.push(`cycle must use bounded revision edges: ${component.join(",")}`);
    }
  }

  const maxSteps = graph.budgets?.maxSteps;
  if (!Number.isInteger(maxSteps) || maxSteps < nodes.length || maxSteps > 200) {
    errors.push("budgets.maxSteps must be an integer between node count and 200");
  }
  return validationResult(errors, graph);
}

export async function runAgentGraph({
  graph,
  input = {},
  handlers = {},
  checkpoint = null,
  onEvent = null,
  signal = null,
} = {}) {
  const validation = validateAgentGraph(graph);
  if (!validation.valid) throw graphError(validation.errors);
  const graphDigest = validation.digest;
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const state = checkpoint
    ? restoreCheckpoint(checkpoint, graphDigest)
    : {
        schema: agentGraphCheckpointSchema,
        graphDigest,
        graphRevision: graph.revision,
        status: "running",
        currentNodeId: graph.entryNodeId,
        step: 0,
        input,
        outputs: {},
        traversals: {},
        events: [],
      };
  const emit = (event) => {
    const full = { at: new Date().toISOString(), ...event };
    state.events.push(full);
    onEvent?.(full, publicCheckpoint(state));
  };

  while (state.status === "running") {
    throwIfAborted(signal);
    if (state.step >= graph.budgets.maxSteps) {
      state.status = "blocked";
      state.reason = "graph_step_budget_exceeded";
      break;
    }
    const node = nodeMap.get(state.currentNodeId);
    const handler = handlers[node.id] || handlers[node.type];
    if (typeof handler !== "function") {
      state.status = "blocked";
      state.reason = `missing_node_handler:${node.id}`;
      break;
    }
    state.step += 1;
    emit({ type: "node_started", nodeId: node.id, nodeType: node.type, step: state.step });
    const result = normalizeNodeResult(await handler({
      node,
      input: state.input,
      outputs: { ...state.outputs },
      step: state.step,
      signal,
    }));
    state.outputs[node.id] = result.output;
    emit({ type: "node_completed", nodeId: node.id, outcome: result.outcome, step: state.step });

    if (result.status && terminalStatuses.has(result.status)) {
      state.status = result.status;
      state.reason = result.reason || null;
      break;
    }
    if (graph.terminalNodeIds.includes(node.id)) {
      state.status = "completed";
      state.reason = null;
      break;
    }
    const next = graph.edges.find((item) => item.from === node.id && item.when === result.outcome);
    if (!next) {
      state.status = "blocked";
      state.reason = `no_matching_edge:${node.id}:${result.outcome}`;
      break;
    }
    if (next.loop) {
      const key = `${next.from}:${next.when}:${next.to}`;
      state.traversals[key] = Number(state.traversals[key] || 0) + 1;
      if (state.traversals[key] > next.maxTraversals) {
        state.status = "blocked";
        state.reason = `graph_loop_budget_exceeded:${key}`;
        break;
      }
    }
    state.currentNodeId = next.to;
  }
  emit({
    type: state.status === "waiting_for_human" ? "graph_paused" : "graph_completed",
    status: state.status,
    reason: state.reason || null,
    step: state.step,
    nodeId: state.currentNodeId,
  });
  return {
    schema: "hireme.agent_graph.result.v1",
    status: state.status,
    reason: state.reason || null,
    graphDigest,
    graphRevision: graph.revision,
    outputs: { ...state.outputs },
    checkpoint: publicCheckpoint(state),
  };
}

export function publicCheckpoint(state) {
  return JSON.parse(JSON.stringify(state));
}

function graphNode(id, type, skillRef, capabilities) {
  return {
    id,
    type,
    skillRef,
    inputSchemaRef: "hireme.agent_graph.node_state.v1",
    outputSchemaRef: "hireme.agent_graph.node_state.v1",
    capabilities,
    completionGate: completionGateFor(type),
  };
}

function completionGateFor(type) {
  if (type === "intake") return ["required_input_present"];
  if (type === "evaluate") return ["rubric_verdict_recorded"];
  if (type === "human_gate") return ["creator_decision_recorded"];
  if (type === "deliver") return ["approved_output_manifest_ready"];
  return ["typed_output_valid"];
}

function edge(from, to, when, extra = {}) {
  return { from, to, when, ...extra };
}

function normalizeNodeResult(value) {
  if (!value || typeof value !== "object") return { outcome: "completed", output: value };
  return {
    outcome: String(value.outcome || "completed"),
    output: value.output ?? value,
    status: value.status || null,
    reason: value.reason || null,
  };
}

function restoreCheckpoint(checkpoint, digest) {
  if (checkpoint?.schema !== agentGraphCheckpointSchema || checkpoint.graphDigest !== digest) {
    throw Object.assign(new Error("Checkpoint does not belong to this graph revision."), {
      code: "graph_checkpoint_mismatch",
    });
  }
  return JSON.parse(JSON.stringify(checkpoint));
}

function reachableNodes(entry, edges) {
  const seen = new Set([entry]);
  const queue = [entry];
  while (queue.length) {
    const current = queue.shift();
    for (const item of edges.filter((edgeItem) => edgeItem.from === current)) {
      if (seen.has(item.to)) continue;
      seen.add(item.to);
      queue.push(item.to);
    }
  }
  return seen;
}

function stronglyConnectedComponents(nodes, edges) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lows = new Map();
  const components = [];
  const visit = (node) => {
    indexes.set(node, index);
    lows.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
    for (const edgeItem of edges.filter((item) => item.from === node)) {
      if (!indexes.has(edgeItem.to)) {
        visit(edgeItem.to);
        lows.set(node, Math.min(lows.get(node), lows.get(edgeItem.to)));
      } else if (onStack.has(edgeItem.to)) {
        lows.set(node, Math.min(lows.get(node), indexes.get(edgeItem.to)));
      }
    }
    if (lows.get(node) !== indexes.get(node)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    components.push(component);
  };
  for (const node of nodes) if (!indexes.has(node)) visit(node);
  return components;
}

function validationResult(errors, graph = null) {
  const digest = graph ? `sha256:${createHash("sha256").update(stableJson(graph)).digest("hex")}` : null;
  return {
    schema: "hireme.agent_graph.validation.v1",
    valid: errors.length === 0,
    errors,
    digest,
    nodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
    edgeCount: Array.isArray(graph?.edges) ? graph.edges.length : 0,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validId(value) {
  return /^[a-z0-9][a-z0-9._-]{0,79}$/.test(String(value || ""));
}

function normalizeId(value, label) {
  const id = String(value || "").trim().toLowerCase().replace(/^!+/, "");
  if (!validId(id)) throw new Error(`${label} must be a valid lowercase identifier`);
  return id;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function graphError(errors) {
  return Object.assign(new Error(`Invalid Agent graph: ${errors.join("; ")}`), {
    code: "invalid_agent_graph",
    details: errors,
  });
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw Object.assign(new Error("Agent graph execution was canceled."), {
    name: "AbortError",
    code: "run_canceled",
  });
}
