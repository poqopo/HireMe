#!/usr/bin/env node

import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createDefaultTools } from "../runtime/src/tools.mjs";
import {
  createDefaultAgentGraph,
  runAgentGraph,
  validateAgentGraph,
} from "../runtime/src/agentGraph.mjs";
import { runLocalSpecialistAgentGraph } from "../runtime/src/agentGraphExecution.mjs";

const stateDir = resolve(".hireme/tmp/agent-graph-authoring-smoke");
const specialistRoot = ".hireme/tmp/agent-graph-authoring-smoke/agents";
const agentId = "graph-authoring-smoke";
const behavioralProvider = {
  provider: "smoke-model",
  model: "behavioral-comparison-fixture",
  async complete({ instructions, input }) {
    const learned = String(instructions).includes("Creator-approved change candidate");
    return JSON.stringify({
      schema: "hireme.specialist_agent.output.v1",
      agentId: input.agent.id,
      status: "completed",
      responseMode: input.input.responseMode,
      outputText: learned
        ? "WCAG 대비를 CTA 버튼 적용 위치에서 검토합니다."
        : "일반적인 디자인 피드백을 제공합니다.",
      structuredResult: { summary: "Behavioral comparison smoke response." },
      artifacts: [],
      evidence: [],
      assumptions: [],
      risks: [],
      memoryDeltas: [],
    });
  },
};

await rm(stateDir, { recursive: true, force: true });

try {
  const graph = createDefaultAgentGraph({ agentId, maxRevisionAttempts: 2 });
  const valid = validateAgentGraph(graph);
  if (!valid.valid || valid.nodeCount !== 8 || valid.edgeCount !== 9) {
    throw new Error("Default Agent graph did not pass its contract.");
  }

  const unbounded = structuredClone(graph);
  delete unbounded.edges.find((edge) => edge.loop).maxTraversals;
  if (validateAgentGraph(unbounded).valid) {
    throw new Error("Unbounded Agent graph cycle was not rejected.");
  }

  let evaluationAttempts = 0;
  const handlers = Object.fromEntries(graph.nodes.map((node) => [node.type, async () => {
    if (node.type === "evaluate") {
      evaluationAttempts += 1;
      return { outcome: evaluationAttempts === 1 ? "revise" : "passed", output: { attempt: evaluationAttempts } };
    }
    if (node.type === "human_gate") return { outcome: "approved", output: { approved: true } };
    return { outcome: "completed", output: { node: node.id } };
  }]));
  const run = await runAgentGraph({ graph, input: { task: "calibrate" }, handlers });
  if (run.status !== "completed" || evaluationAttempts !== 2 || run.checkpoint.step !== 10) {
    throw new Error("Bounded graph revision path did not complete as expected.");
  }

  const tools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
    localSpecialistOptions: { specialistRoot },
    modelProvider: behavioralProvider,
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const name of [
    "hireme_list_builtin_agent_skills",
    "hireme_start_agent_authoring_session",
    "hireme_record_agent_authoring_feedback",
    "hireme_compile_agent_graph",
    "hireme_propose_agent_skill_update",
    "hireme_compare_agent_candidate",
    "hireme_decide_agent_candidate",
    "hireme_rollback_agent_candidate",
  ]) {
    if (!byName.has(name)) throw new Error(`Missing graph authoring tool: ${name}`);
  }

  const catalog = await byName.get("hireme_list_builtin_agent_skills").handler({});
  if (catalog.count !== 18 || !catalog.skills.some((skill) => skill.id === "feedback-attribution")) {
    throw new Error("Built-in skill catalog is incomplete.");
  }

  const created = await byName.get("hireme_create_agent_draft").handler({
    agent_id: agentId,
    name: "Graph Authoring Smoke",
    template: "artifact",
    category: "Design",
  });
  if (created.workflow.revision !== 1 || created.validation?.graph?.valid !== true) {
    throw new Error("New Agent did not include a valid revision-pinned graph.");
  }

  const graphEvents = [];
  const pausedRun = await runLocalSpecialistAgentGraph({
    root: specialistRoot,
    stateDir: resolve(stateDir, "graph-memory"),
    agent_id: agentId,
    task: "Review a CTA and prepare a public-safe revision plan.",
    modelProvider: behavioralProvider,
    runId: "graph-runtime-smoke",
    onEvent: (event) => graphEvents.push(event),
  });
  if (pausedRun.status !== "waiting_for_human" || !graphEvents.some((event) => event.type === "graph_paused")) {
    throw new Error("Graph runtime did not pause at the Human Gate.");
  }
  const resumedRun = await runLocalSpecialistAgentGraph({
    root: specialistRoot,
    stateDir: resolve(stateDir, "graph-memory"),
    agent_id: agentId,
    modelProvider: behavioralProvider,
    runId: "graph-runtime-smoke",
    checkpoint: pausedRun.checkpoint,
    decision: "approved",
  });
  if (resumedRun.status !== "completed" || !resumedRun.outputText) {
    throw new Error("Graph runtime did not resume from the Human Gate checkpoint.");
  }

  const session = await byName.get("hireme_start_agent_authoring_session").handler({
    agent_id: agentId,
    goal: "Turn a designer's explicit review method into reusable artifact feedback.",
    audience: "Independent brand designers",
    outcomes: ["A prioritized revision plan"],
    success_criteria: ["Every recommendation cites an observable artifact issue"],
    non_goals: ["Do not reveal private creator methods"],
  });
  if (session.status !== "ready_to_compile" || session.openQuestions.length) {
    throw new Error("Complete teaching session was not ready to compile.");
  }

  const evidence = await byName.get("hireme_record_agent_authoring_feedback").handler({
    agent_id: agentId,
    session_id: session.id,
    kind: "revision_requested",
    feedback: "Preserve successful hierarchy decisions and localize each requested change.",
    evaluation_task: "Review the CTA button and explain the color accessibility change.",
    target_node_id: "evaluate",
    target_skill: "core-workflow",
  });
  if (!evidence.id || evidence.session.evidenceRefs.length !== 1) {
    throw new Error("Explicit feedback was not recorded as creator-local evidence.");
  }

  const compiled = await byName.get("hireme_compile_agent_graph").handler({
    agent_id: agentId,
    session_id: session.id,
    skill_refs: ["brief-interpretation", "revision-planning"],
  });
  if (!compiled.validation.valid || compiled.workflow.revision !== 2 || compiled.graph.revision !== 2) {
    throw new Error("Teaching session did not compile into Agent revision 2.");
  }

  const proposal = await byName.get("hireme_propose_agent_skill_update").handler({
    agent_id: agentId,
    session_id: session.id,
    target_path: "skills/core-workflow.md",
    instruction: "Preserve successful hierarchy decisions before proposing localized revisions.",
    expected_impact: "Reduce destructive full-regeneration behavior during revision work.",
    evidence_refs: [evidence.id],
    evaluation_task: "Review the CTA button and explain the color accessibility change.",
    expected_indicators: ["WCAG", "CTA 버튼", "적용 위치"],
  });
  if (proposal.status !== "proposed" || proposal.baseRevision !== 2 || "candidateContent" in proposal) {
    throw new Error("Skill proposal did not preserve the active revision or privacy boundary.");
  }

  const unchanged = await byName.get("hireme_get_agent_authoring_status").handler({ agent_id: agentId });
  if (unchanged.workflow.revision !== 2) throw new Error("Candidate proposal changed the active Agent.");

  const comparison = await byName.get("hireme_compare_agent_candidate").handler({
    agent_id: agentId,
    proposal_id: proposal.id,
  });
  if (comparison.verdict !== "improved" || comparison.behavioral?.meaningfulDifference !== true || !comparison.checks.every((check) => check.passed)) {
    throw new Error("Candidate did not show a measurable behavioral improvement over its baseline.");
  }

  const approved = await byName.get("hireme_decide_agent_candidate").handler({
    agent_id: agentId,
    proposal_id: proposal.id,
    decision: "approved",
  });
  if (approved.status !== "approved" || approved.workflow.revision !== 3) {
    throw new Error("Approved candidate did not become a new active revision.");
  }
  const appliedSource = await readFile(resolve(specialistRoot, agentId, "skills/core-workflow.md"), "utf8");
  if (!appliedSource.includes("Preserve successful hierarchy decisions")) {
    throw new Error("Approved skill candidate was not materialized.");
  }

  const rolledBack = await byName.get("hireme_rollback_agent_candidate").handler({
    agent_id: agentId,
    proposal_id: proposal.id,
  });
  if (rolledBack.status !== "superseded" || rolledBack.workflow.revision !== 4) {
    throw new Error("Approved skill candidate did not roll back as a new revision.");
  }
  const restoredSource = await readFile(resolve(specialistRoot, agentId, "skills/core-workflow.md"), "utf8");
  if (restoredSource.includes("Preserve successful hierarchy decisions")) {
    throw new Error("Rollback did not restore the prior skill source.");
  }

  console.log("Agent graph authoring smoke passed");
  console.log("Verified: graph contract -> bounded loop -> teaching session -> evidence -> candidate -> compare -> approve -> rollback");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}
