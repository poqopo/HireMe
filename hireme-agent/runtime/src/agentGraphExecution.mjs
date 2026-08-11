import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createSpecialistMemoryStore } from "./specialistMemory.mjs";
import { runLocalSpecialistAgent } from "./localSpecialistAgent.mjs";
import { runAgentGraph, validateAgentGraph } from "./agentGraph.mjs";

const modelNodeTypes = new Set(["analyze", "explore", "produce", "evaluate"]);

export async function runLocalSpecialistAgentGraph({
  root,
  stateDir,
  agent_id,
  agentId,
  task,
  modelProvider,
  runId = `graph-${Date.now().toString(36)}`,
  checkpoint = null,
  decision = null,
  onEvent = null,
  signal = null,
} = {}) {
  const id = normalizeAgentId(agent_id || agentId);
  const taskText = String(task || checkpoint?.input?.task || "").trim();
  if (!taskText) throw codedError("graph_task_required", "A graph run task is required.");
  const graph = JSON.parse(await readFile(join(resolve(root), id, "workflow/graph.json"), "utf8"));
  const validation = validateAgentGraph(graph);
  if (!validation.valid) throw codedError("invalid_agent_graph", validation.errors.join("; "));
  if (!modelProvider || typeof modelProvider.complete !== "function" || modelProvider.provider === "fixture") {
    throw codedError("model_backed_provider_required", "A model-backed provider is required for graph execution.");
  }
  const restored = checkpoint ? structuredClone(checkpoint) : null;
  if (restored?.status === "waiting_for_human") restored.status = "running";
  let gateDecision = normalizeDecision(decision);
  const memoryStore = createSpecialistMemoryStore({ stateDir: resolve(stateDir) });
  const graphResult = await runAgentGraph({
    graph,
    input: { task: taskText, runId },
    checkpoint: restored,
    signal,
    onEvent: (event, publicCheckpoint) => onEvent?.(publicGraphEvent(event, publicCheckpoint)),
    handlers: Object.fromEntries(graph.nodes.map((node) => [node.id, async ({ outputs, step }) => {
      if (node.type === "intake") {
        return { outcome: "completed", output: { task: taskText, accepted: true } };
      }
      if (node.type === "decide") {
        return { outcome: "completed", output: { route: "continue", basedOn: Object.keys(outputs) } };
      }
      if (node.type === "human_gate") {
        if (!gateDecision) {
          return {
            status: "waiting_for_human",
            reason: "creator_decision_required",
            output: { decision: null, preview: publicOutputSummary(outputs.produce) },
          };
        }
        const currentDecision = gateDecision;
        gateDecision = null;
        return {
          outcome: currentDecision,
          output: { decision: currentDecision, decidedAt: new Date().toISOString() },
        };
      }
      if (node.type === "deliver") {
        return {
          outcome: "completed",
          output: {
            status: "completed",
            outputText: String(outputs.produce?.outputText || outputs.evaluate?.outputText || "").trim(),
            sourceNodeId: outputs.produce ? "produce" : "evaluate",
          },
        };
      }
      if (!modelNodeTypes.has(node.type)) {
        return { outcome: "completed", output: { status: "completed", nodeType: node.type } };
      }
      const result = await runLocalSpecialistAgent({
        root,
        memoryStore,
        modelProvider,
        agent_id: id,
        task: stageTask({ node, task: taskText, outputs }),
        current_user_id: "creator-agent-studio",
        conversation_id: `${runId}-${node.id}-${step}`,
        signal,
      });
      if (result.status !== "completed") {
        return { status: "blocked", reason: `node_${node.id}_${result.status}`, output: result };
      }
      return { outcome: node.type === "evaluate" ? "passed" : "completed", output: result };
    }])),
  });
  const delivered = graphResult.outputs.deliver;
  const produced = graphResult.outputs.produce;
  return {
    schema: "hireme.agent_graph.execution.v1",
    runId,
    agentId: id,
    status: graphResult.status,
    reason: graphResult.reason,
    graphRevision: graphResult.graphRevision,
    graphDigest: graphResult.graphDigest,
    outputText: String(delivered?.outputText || produced?.outputText || "").trim(),
    checkpoint: graphResult.checkpoint,
    nodeSummaries: Object.fromEntries(Object.entries(graphResult.outputs).map(([nodeId, output]) => [
      nodeId,
      publicOutputSummary(output),
    ])),
  };
}

function stageTask({ node, task, outputs }) {
  const previous = Object.entries(outputs)
    .slice(-3)
    .map(([nodeId, output]) => `${nodeId}: ${publicOutputSummary(output).summary}`)
    .join("\n");
  const instruction = {
    analyze: "Analyze the request, constraints, audience, and definition of done. Return a concise public-safe analysis.",
    explore: "Explore distinct viable approaches and identify the strongest direction without exposing private methods.",
    produce: "Produce the best user-facing answer or artifact specification using the prior stage summaries.",
    evaluate: "Evaluate the produced result against the request and provide a concise quality verdict and remaining risks.",
  }[node.type];
  return [
    `[Agent graph stage: ${node.id} / ${node.type}]`,
    instruction,
    `Original user request: ${task}`,
    previous ? `Previous public-safe stage summaries:\n${previous}` : "",
  ].filter(Boolean).join("\n\n");
}

function publicGraphEvent(event, checkpoint) {
  const output = event.nodeId ? checkpoint.outputs?.[event.nodeId] : null;
  return {
    schema: "hireme.agent_graph.event.v1",
    ...event,
    graphRevision: checkpoint.graphRevision,
    status: checkpoint.status,
    summary: output ? publicOutputSummary(output) : null,
  };
}

function publicOutputSummary(output) {
  const text = String(output?.outputText || output?.summary || output?.preview?.summary || "").trim();
  return {
    status: String(output?.status || "completed"),
    summary: text.slice(0, 360) || "Stage completed.",
    outputChars: text.length,
    artifactCount: Array.isArray(output?.artifacts) ? output.artifacts.length : 0,
  };
}

function normalizeDecision(value) {
  const decision = String(value || "").trim();
  if (!decision) return null;
  if (!["approved", "revision_requested"].includes(decision)) {
    throw codedError("invalid_human_gate_decision", "Human Gate decision must be approved or revision_requested.");
  }
  return decision;
}

function normalizeAgentId(value) {
  const id = String(value || "").trim().toLowerCase().replace(/^!+/, "");
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(id)) throw codedError("invalid_agent_id", "Invalid Agent id.");
  return id;
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}
