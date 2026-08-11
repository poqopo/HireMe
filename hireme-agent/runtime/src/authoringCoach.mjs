import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createDefaultAgentGraph, validateAgentGraph } from "./agentGraph.mjs";

const sessionSchema = "hireme.authoring_session.v1";
const proposalSchema = "hireme.skill_change_proposal.v1";
const comparisonSchema = "hireme.revision_comparison.v1";
const evidenceSchema = "hireme.authoring_evidence.v1";

const feedbackKinds = new Set([
  "approved",
  "rejected",
  "revision_requested",
  "selected",
  "corrected",
  "good_example",
  "bad_example",
]);

export function createAuthoringCoachTools({
  stateRoot,
  getAgentStatus,
  readAgentFile,
  updateAgentFile,
  validateAgent,
  validateCandidate,
  compareCandidateBehavior,
  listBuiltinSkills = defaultBuiltinSkillCatalog,
  viewBuiltinSkill = defaultBuiltinSkillView,
} = {}) {
  const service = createAuthoringCoachService({
    stateRoot,
    getAgentStatus,
    readAgentFile,
    updateAgentFile,
    validateAgent,
    validateCandidate,
    compareCandidateBehavior,
    listBuiltinSkills,
    viewBuiltinSkill,
  });
  return [
    tool("hireme_list_builtin_agent_skills", "List system-owned authoring skills and forkable design starter skills without loading their full instructions.", {}, () => service.listBuiltinSkills()),
    tool("hireme_view_builtin_agent_skill", "Load one built-in skill on demand. This is progressive disclosure for an explicit creator authoring session.", {
      skill_id: { type: "string" },
    }, (args) => service.viewBuiltinSkill(args), ["skill_id"]),
    tool("hireme_fork_builtin_agent_skill", "Copy one forkable design starter into a creator-owned Agent as a private skill revision. System authoring skills cannot be forked.", {
      agent_id: { type: "string" },
      skill_id: { type: "string" },
      target_skill_name: { type: "string" },
      overwrite: { type: "boolean" },
    }, (args) => service.forkBuiltinSkill(args), ["agent_id", "skill_id"]),
    tool("hireme_start_agent_authoring_session", "Start or replace a conversation-first Agent teaching session. Stores creator-local decisions and safe evidence references.", {
      agent_id: { type: "string" },
      goal: { type: "string" },
      audience: { type: "string" },
      outcomes: { type: "array", items: { type: "string" } },
      success_criteria: { type: "array", items: { type: "string" } },
      non_goals: { type: "array", items: { type: "string" } },
    }, (args) => service.startSession(args), ["agent_id", "goal"]),
    tool("hireme_get_agent_authoring_session", "Return the current teaching-session decisions, open questions, and evidence metadata.", {
      agent_id: { type: "string" },
      session_id: { type: "string" },
    }, (args) => service.getSession(args), ["agent_id"]),
    tool("hireme_record_agent_authoring_feedback", "Record explicit creator feedback or a labeled example as evidence for future skill proposals.", {
      agent_id: { type: "string" },
      session_id: { type: "string" },
      kind: { type: "string", enum: [...feedbackKinds] },
      feedback: { type: "string" },
      evaluation_task: { type: "string" },
      target_node_id: { type: "string" },
      target_skill: { type: "string" },
    }, (args) => service.recordFeedback(args), ["agent_id", "kind", "feedback"]),
    tool("hireme_compile_agent_graph", "Compile and validate a bounded Agent graph from the teaching session, then apply it as a new creator-owned Agent revision.", {
      agent_id: { type: "string" },
      session_id: { type: "string" },
      skill_refs: { type: "array", items: { type: "string" } },
      max_revision_attempts: { type: "integer" },
    }, (args) => service.compileGraph(args), ["agent_id"]),
    tool("hireme_propose_agent_skill_update", "Create a creator-private candidate skill patch from explicit feedback. Does not modify the active Agent revision.", {
      agent_id: { type: "string" },
      session_id: { type: "string" },
      target_path: { type: "string" },
      instruction: { type: "string" },
      expected_impact: { type: "string" },
      evidence_refs: { type: "array", items: { type: "string" } },
      evaluation_task: { type: "string" },
      expected_indicators: { type: "array", items: { type: "string" } },
      replacement_content: { type: "string" },
    }, (args) => service.proposeSkillUpdate(args), ["agent_id", "target_path", "instruction"]),
    tool("hireme_compare_agent_candidate", "Run the same user request against the base and candidate, then require observable candidate-only acceptance indicators alongside structural validation.", {
      agent_id: { type: "string" },
      proposal_id: { type: "string" },
    }, (args) => service.compareCandidate(args), ["agent_id", "proposal_id"]),
    tool("hireme_decide_agent_candidate", "Approve or reject a candidate. Approval requires a current base revision and passing comparison, and creates a new active revision.", {
      agent_id: { type: "string" },
      proposal_id: { type: "string" },
      decision: { type: "string", enum: ["approved", "rejected"] },
    }, (args) => service.decideCandidate(args), ["agent_id", "proposal_id", "decision"]),
    tool("hireme_rollback_agent_candidate", "Restore the pre-proposal file content as a new Agent revision after an approved update.", {
      agent_id: { type: "string" },
      proposal_id: { type: "string" },
    }, (args) => service.rollbackCandidate(args), ["agent_id", "proposal_id"]),
  ];
}

export function createAuthoringCoachService({
  stateRoot,
  getAgentStatus,
  readAgentFile,
  updateAgentFile,
  validateAgent,
  validateCandidate = null,
  compareCandidateBehavior = null,
  listBuiltinSkills = defaultBuiltinSkillCatalog,
  viewBuiltinSkill = defaultBuiltinSkillView,
} = {}) {
  const root = resolve(stateRoot || ".hireme/standalone-agent/default");
  assertCallback(getAgentStatus, "getAgentStatus");
  assertCallback(readAgentFile, "readAgentFile");
  assertCallback(updateAgentFile, "updateAgentFile");
  assertCallback(validateAgent, "validateAgent");

  return {
    listBuiltinSkills,
    viewBuiltinSkill,
    async forkBuiltinSkill(input = {}) {
      const agentId = normalizeAgentId(input.agent_id || input.agentId);
      const skill = await viewBuiltinSkill({ skill_id: input.skill_id || input.skillId });
      if (skill.tier !== "design_starter") {
        throw codedError("system_skill_read_only", "System authoring skills are platform-owned and cannot be copied or modified by an Agent.");
      }
      const targetName = normalizeSkillId(input.target_skill_name || input.targetSkillName || skill.id);
      const update = await updateAgentFile({
        agent_id: agentId,
        path: `skills/${targetName}.md`,
        content: `${String(skill.content || "").trim()}\n\n## Creator calibration\n\n- Add creator-approved rules and examples here.\n`,
        overwrite: input.overwrite === true,
        validate_after_update: true,
      });
      return {
        schema: "hireme.builtin_skill_fork.v1",
        status: "completed",
        agentId,
        sourceSkillId: skill.id,
        targetPath: `skills/${targetName}.md`,
        sourceTier: skill.tier,
        workflow: update.workflow,
        validation: update.validation,
      };
    },
    async startSession(input = {}) {
      const agentId = normalizeAgentId(input.agent_id || input.agentId);
      const goal = boundedText(input.goal, "goal", 12, 4_000);
      const now = new Date().toISOString();
      const session = {
        schema: sessionSchema,
        id: `asess_${randomUUID()}`,
        agentId,
        status: "collecting",
        goal,
        decisions: {
          audience: optionalText(input.audience, 1_000),
          outcomes: stringList(input.outcomes, 20, 1_000),
          successCriteria: stringList(input.success_criteria || input.successCriteria, 30, 1_000),
          nonGoals: stringList(input.non_goals || input.nonGoals, 30, 1_000),
        },
        openQuestions: [],
        evidenceRefs: [],
        createdAt: now,
        updatedAt: now,
        compiledGraph: null,
      };
      session.openQuestions = authoringOpenQuestions(session);
      session.status = session.openQuestions.length ? "collecting" : "ready_to_compile";
      await writeJsonAtomic(sessionPath(root, agentId, session.id), session);
      await writeJsonAtomic(activeSessionPath(root, agentId), { sessionId: session.id });
      return publicSession(session);
    },
    async getSession(input = {}) {
      return publicSession(await resolveSession(root, input));
    },
    async recordFeedback(input = {}) {
      const session = await resolveSession(root, input);
      const kind = String(input.kind || "").trim();
      if (!feedbackKinds.has(kind)) throw codedError("invalid_feedback_kind", `Unsupported feedback kind: ${kind}`);
      const feedback = boundedText(input.feedback, "feedback", 3, 8_000);
      const evidence = {
        schema: evidenceSchema,
        id: `aev_${randomUUID()}`,
        agentId: session.agentId,
        sessionId: session.id,
        kind,
        feedback,
        feedbackSha256: digest(feedback),
        targetNodeId: optionalId(input.target_node_id || input.targetNodeId),
        targetSkill: optionalText(input.target_skill || input.targetSkill, 160),
        evaluationTask: optionalText(input.evaluation_task || input.evaluationTask, 8_000),
        createdAt: new Date().toISOString(),
      };
      await writeJsonAtomic(evidencePath(root, session.agentId, evidence.id), evidence);
      session.evidenceRefs = [...new Set([...(session.evidenceRefs || []), evidence.id])].slice(-200);
      session.updatedAt = new Date().toISOString();
      session.openQuestions = authoringOpenQuestions(session);
      session.status = session.compiledGraph
        ? "compiled"
        : session.openQuestions.length ? "collecting" : "ready_to_compile";
      await writeJsonAtomic(sessionPath(root, session.agentId, session.id), session);
      return {
        schema: evidenceSchema,
        id: evidence.id,
        agentId: evidence.agentId,
        sessionId: evidence.sessionId,
        kind: evidence.kind,
        feedbackSha256: evidence.feedbackSha256,
        targetNodeId: evidence.targetNodeId,
        targetSkill: evidence.targetSkill,
        createdAt: evidence.createdAt,
        session: publicSession(session),
      };
    },
    async compileGraph(input = {}) {
      const session = await resolveSession(root, input);
      const status = await getAgentStatus({ agent_id: session.agentId });
      const currentRevision = requireRevision(status);
      const graph = createDefaultAgentGraph({
        agentId: session.agentId,
        revision: currentRevision + 1,
        skillRefs: stringList(input.skill_refs || input.skillRefs, 20, 160),
        maxRevisionAttempts: input.max_revision_attempts || input.maxRevisionAttempts,
        authoringDigest: digest(JSON.stringify({ goal: session.goal, decisions: session.decisions })),
      });
      const validation = validateAgentGraph(graph);
      const update = await updateAgentFile({
        agent_id: session.agentId,
        path: "workflow/graph.json",
        content: `${JSON.stringify(graph, null, 2)}\n`,
        overwrite: true,
        validate_after_update: true,
      });
      session.status = "compiled";
      session.compiledGraph = {
        revision: graph.revision,
        digest: validation.digest,
        nodeCount: validation.nodeCount,
        edgeCount: validation.edgeCount,
      };
      session.updatedAt = new Date().toISOString();
      await writeJsonAtomic(sessionPath(root, session.agentId, session.id), session);
      return {
        schema: "hireme.agent_graph.compile.v1",
        status: "completed",
        agentId: session.agentId,
        graph,
        validation,
        workflow: update.workflow,
        session: publicSession(session),
      };
    },
    async proposeSkillUpdate(input = {}) {
      const session = await resolveSession(root, input);
      const status = await getAgentStatus({ agent_id: session.agentId });
      const baseRevision = requireRevision(status);
      const targetPath = normalizeProposalPath(input.target_path || input.targetPath);
      const instruction = boundedText(input.instruction, "instruction", 8, 4_000);
      const expectedImpact = optionalText(input.expected_impact || input.expectedImpact, 2_000) || instruction;
      const evidenceRefs = [...new Set(stringList(input.evidence_refs || input.evidenceRefs || session.evidenceRefs, 50, 160))];
      if (!evidenceRefs.length) throw codedError("feedback_evidence_required", "At least one explicit feedback evidence reference is required.");
      const evidence = await readEvidenceRefs(root, session.agentId, evidenceRefs);
      const evaluationTask = optionalText(
        input.evaluation_task || input.evaluationTask || evidence.find((item) => item.evaluationTask)?.evaluationTask,
        8_000,
      );
      const expectedIndicators = stringList(input.expected_indicators || input.expectedIndicators, 12, 160);
      const current = await readAgentFile({ agent_id: session.agentId, path: targetPath });
      const baseContent = String(current.content || current.text || "");
      const replacement = optionalText(input.replacement_content || input.replacementContent, 100_000);
      const candidateContent = replacement || appendLearnedCorrection(baseContent, {
        instruction,
        expectedImpact,
        evidenceRefs,
        evaluationTask,
        expectedIndicators,
      });
      if (candidateContent === baseContent) throw codedError("candidate_unchanged", "Candidate content must differ from the active source.");
      if (targetPath === "workflow/graph.json") {
        let parsed;
        try { parsed = JSON.parse(candidateContent); } catch { throw codedError("invalid_agent_graph", "Candidate graph is not valid JSON."); }
        const graphValidation = validateAgentGraph(parsed);
        if (!graphValidation.valid) throw codedError("invalid_agent_graph", graphValidation.errors.join("; "));
      }
      const now = new Date().toISOString();
      const proposal = {
        schema: proposalSchema,
        id: `aprop_${randomUUID()}`,
        agentId: session.agentId,
        sessionId: session.id,
        baseRevision,
        status: "proposed",
        targetPath,
        instructionSha256: digest(instruction),
        expectedImpact,
        evidenceRefs,
        evaluationTask,
        expectedIndicators,
        baseContent,
        baseDigest: digest(baseContent),
        candidateContent,
        candidateDigest: digest(candidateContent),
        comparison: null,
        createdAt: now,
        updatedAt: now,
      };
      await writeJsonAtomic(proposalPath(root, session.agentId, proposal.id), proposal);
      return publicProposal(proposal);
    },
    async compareCandidate(input = {}) {
      const proposal = await readProposal(root, input);
      if (proposal.status !== "proposed") throw codedError("proposal_not_open", "Only a proposed candidate can be compared.");
      const status = await getAgentStatus({ agent_id: proposal.agentId });
      const currentRevision = requireRevision(status);
      const current = await readAgentFile({ agent_id: proposal.agentId, path: proposal.targetPath });
      const currentContent = String(current.content || current.text || "");
      const checks = [
        check("base_revision_current", currentRevision === proposal.baseRevision, { currentRevision }),
        check("base_content_current", digest(currentContent) === proposal.baseDigest),
        check("candidate_changed", proposal.candidateDigest !== proposal.baseDigest),
        check("explicit_feedback", proposal.evidenceRefs.length > 0, { count: proposal.evidenceRefs.length }),
        check("candidate_size", proposal.candidateContent.length <= 100_000, { chars: proposal.candidateContent.length }),
      ];
      if (proposal.targetPath === "workflow/graph.json") {
        let graphValidation = { valid: false, errors: ["invalid JSON"] };
        try { graphValidation = validateAgentGraph(JSON.parse(proposal.candidateContent)); } catch {}
        checks.push(check("graph_contract", graphValidation.valid, { errors: graphValidation.errors || [] }));
      }
      const candidateValid = await validateCandidateSource({
        proposal,
        validateAgent,
        validateCandidate,
      });
      checks.push(check("candidate_validation", candidateValid.valid, {
        reason: candidateValid.reason || null,
      }));
      const structuralPassed = checks.every((item) => item.passed);
      let behavioral = null;
      if (!proposal.evaluationTask || !proposal.expectedIndicators?.length) {
        checks.push(check("behavioral_evaluation_configured", false, {
          reason: "evaluation_task_and_expected_indicators_required",
        }));
      } else if (typeof compareCandidateBehavior !== "function") {
        checks.push(check("behavioral_evaluation_available", false, {
          reason: "behavioral_runner_unavailable",
        }));
      } else {
        behavioral = await compareCandidateBehavior({
          agent_id: proposal.agentId,
          path: proposal.targetPath,
          content: proposal.candidateContent,
          expected_sha256: stripDigestPrefix(proposal.baseDigest),
          task: proposal.evaluationTask,
          expected_indicators: proposal.expectedIndicators,
        });
        checks.push(check("behavioral_execution", behavioral.ran === true, {
          reason: behavioral.reason || null,
          mode: behavioral.mode || null,
        }));
        checks.push(check("candidate_honors_acceptance_indicators", behavioral.candidateMatchedAll === true, {
          candidateMatched: behavioral.candidateMatched || [],
          missing: behavioral.candidateMissing || [],
        }));
        checks.push(check("candidate_differs_from_baseline", behavioral.meaningfulDifference === true, {
          baselineMatched: behavioral.baselineMatched || [],
          candidateMatched: behavioral.candidateMatched || [],
        }));
      }
      const passed = structuralPassed && checks.every((item) => item.passed);
      const comparison = {
        schema: comparisonSchema,
        agentId: proposal.agentId,
        baseRevision: proposal.baseRevision,
        candidateRevision: proposal.baseRevision + 1,
        // Structural validation proves that the candidate is safe to review and
        // apply. It does not, by itself, prove a behavioral improvement.
        verdict: passed ? "improved" : structuralPassed ? "needs_evidence" : "regressed",
        checks,
        behavioral,
        cost: null,
        latency: null,
        comparedAt: new Date().toISOString(),
      };
      proposal.comparison = comparison;
      proposal.updatedAt = comparison.comparedAt;
      await writeJsonAtomic(proposalPath(root, proposal.agentId, proposal.id), proposal);
      return comparison;
    },
    async decideCandidate(input = {}) {
      const proposal = await readProposal(root, input);
      const decision = String(input.decision || "").trim();
      if (!new Set(["approved", "rejected"]).has(decision)) throw codedError("invalid_proposal_decision", "decision must be approved or rejected");
      if (proposal.status !== "proposed") throw codedError("proposal_not_open", "Proposal has already been decided.");
      if (decision === "rejected") {
        proposal.status = "rejected";
        proposal.updatedAt = new Date().toISOString();
        await writeJsonAtomic(proposalPath(root, proposal.agentId, proposal.id), proposal);
        return publicProposal(proposal);
      }
      if (!proposal.comparison || proposal.comparison.verdict !== "improved") {
        throw codedError("candidate_comparison_required", "A behavioral comparison with a measurable candidate improvement is required before approval.");
      }
      const status = await getAgentStatus({ agent_id: proposal.agentId });
      if (requireRevision(status) !== proposal.baseRevision) {
        throw codedError("proposal_revision_conflict", "The active Agent changed after this proposal was created.");
      }
      const update = await updateAgentFile({
        agent_id: proposal.agentId,
        path: proposal.targetPath,
        content: proposal.candidateContent,
        overwrite: true,
        expected_sha256: stripDigestPrefix(proposal.baseDigest),
        validate_after_update: true,
      });
      if (update.validation?.valid !== true) throw codedError("candidate_validation_failed", "Approved candidate did not pass Agent validation.");
      proposal.status = "approved";
      proposal.appliedRevision = update.workflow?.revision || proposal.baseRevision + 1;
      proposal.updatedAt = new Date().toISOString();
      await writeJsonAtomic(proposalPath(root, proposal.agentId, proposal.id), proposal);
      return { ...publicProposal(proposal), workflow: update.workflow, validation: update.validation };
    },
    async rollbackCandidate(input = {}) {
      const proposal = await readProposal(root, input);
      if (proposal.status !== "approved" || !proposal.appliedRevision) {
        throw codedError("proposal_not_applied", "Only an approved, applied proposal can be rolled back.");
      }
      const status = await getAgentStatus({ agent_id: proposal.agentId });
      if (requireRevision(status) !== proposal.appliedRevision) {
        throw codedError("proposal_revision_conflict", "The Agent changed after this proposal was applied; automatic rollback is unsafe.");
      }
      const current = await readAgentFile({ agent_id: proposal.agentId, path: proposal.targetPath });
      const currentContent = String(current.content || current.text || "");
      if (digest(currentContent) !== proposal.candidateDigest) {
        throw codedError("proposal_content_conflict", "The applied file no longer matches the candidate.");
      }
      const update = await updateAgentFile({
        agent_id: proposal.agentId,
        path: proposal.targetPath,
        content: proposal.baseContent,
        overwrite: true,
        expected_sha256: stripDigestPrefix(proposal.candidateDigest),
        validate_after_update: true,
      });
      proposal.status = "superseded";
      proposal.rollbackRevision = update.workflow?.revision || proposal.appliedRevision + 1;
      proposal.updatedAt = new Date().toISOString();
      await writeJsonAtomic(proposalPath(root, proposal.agentId, proposal.id), proposal);
      return { ...publicProposal(proposal), workflow: update.workflow, validation: update.validation };
    },
  };
}

export async function defaultBuiltinSkillCatalog() {
  const catalog = await readBuiltinCatalog();
  return {
    schema: "hireme.builtin_skill_catalog.v1",
    count: catalog.skills.length,
    skills: catalog.skills.map(({ id, title, tier, purpose, triggers }) => ({ id, title, tier, purpose, triggers })),
  };
}

export async function defaultBuiltinSkillView({ skill_id, skillId } = {}) {
  const id = String(skill_id || skillId || "").trim();
  const catalog = await readBuiltinCatalog();
  const skill = catalog.skills.find((item) => item.id === id);
  if (!skill) throw codedError("builtin_skill_not_found", `Unknown built-in skill: ${id}`);
  const path = new URL(`../skills/${skill.path}`, import.meta.url);
  return {
    schema: "hireme.builtin_skill.v1",
    ...skill,
    content: await readFile(path, "utf8"),
  };
}

async function readBuiltinCatalog() {
  const path = new URL("../skills/catalog.json", import.meta.url);
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (parsed?.schema !== "hireme.builtin_skill_catalog.v1" || !Array.isArray(parsed.skills)) {
    throw codedError("invalid_builtin_skill_catalog", "Built-in skill catalog is invalid.");
  }
  return parsed;
}

async function validateCandidateSource({ proposal, validateAgent, validateCandidate }) {
  if (typeof validateCandidate === "function") {
    return validateCandidate({
      agent_id: proposal.agentId,
      path: proposal.targetPath,
      content: proposal.candidateContent,
      expected_sha256: stripDigestPrefix(proposal.baseDigest),
    });
  }
  if (!proposal.candidateContent.trim()) return { valid: false, reason: "empty_candidate" };
  const activeValidation = await validateAgent({ agent_id: proposal.agentId });
  return activeValidation?.valid === true
    ? { valid: true }
    : { valid: false, reason: "active_agent_invalid" };
}

function tool(name, description, properties, handler, required = []) {
  return {
    name,
    description,
    inputSchema: { type: "object", properties, ...(required.length ? { required } : {}) },
    handler: async (args = {}) => handler(args),
  };
}

function publicSession(session) {
  return JSON.parse(JSON.stringify(session));
}

function publicProposal(proposal) {
  return {
    schema: proposal.schema,
    id: proposal.id,
    agentId: proposal.agentId,
    sessionId: proposal.sessionId,
    baseRevision: proposal.baseRevision,
    status: proposal.status,
    targetPath: proposal.targetPath,
    instructionSha256: proposal.instructionSha256,
    expectedImpact: proposal.expectedImpact,
    evidenceRefs: [...proposal.evidenceRefs],
    evaluationTaskSha256: proposal.evaluationTask ? digest(proposal.evaluationTask) : null,
    expectedIndicators: [...(proposal.expectedIndicators || [])],
    baseDigest: proposal.baseDigest,
    candidateDigest: proposal.candidateDigest,
    comparison: proposal.comparison,
    appliedRevision: proposal.appliedRevision || null,
    rollbackRevision: proposal.rollbackRevision || null,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    privacyBoundary: "Candidate source and explicit feedback remain creator-private; this response contains metadata only.",
  };
}

function authoringOpenQuestions(session) {
  const questions = [];
  if (!session.decisions?.audience) questions.push("Who will use or receive this Agent's result?");
  if (!session.decisions?.outcomes?.length) questions.push("What concrete output should the Agent produce?");
  if (!session.decisions?.successCriteria?.length) questions.push("How should a designer decide that the result is good enough?");
  if (!session.decisions?.nonGoals?.length) questions.push("What must this Agent avoid or leave to a human?");
  return questions;
}

async function resolveSession(root, input) {
  const agentId = normalizeAgentId(input.agent_id || input.agentId);
  let sessionId = optionalText(input.session_id || input.sessionId, 160);
  if (!sessionId) {
    const active = await readJson(activeSessionPath(root, agentId));
    sessionId = active?.sessionId;
  }
  if (!sessionId) throw codedError("authoring_session_not_found", `No active authoring session for ${agentId}.`);
  const session = await readJson(sessionPath(root, agentId, sessionId));
  if (session?.schema !== sessionSchema || session.agentId !== agentId) {
    throw codedError("invalid_authoring_session", `Invalid authoring session: ${sessionId}`);
  }
  return session;
}

async function readProposal(root, input) {
  const agentId = normalizeAgentId(input.agent_id || input.agentId);
  const proposalId = boundedText(input.proposal_id || input.proposalId, "proposal_id", 4, 160);
  const proposal = await readJson(proposalPath(root, agentId, proposalId));
  if (proposal?.schema !== proposalSchema || proposal.agentId !== agentId) {
    throw codedError("invalid_skill_change_proposal", `Invalid proposal: ${proposalId}`);
  }
  return proposal;
}

async function readEvidenceRefs(root, agentId, refs) {
  const evidenceRecords = [];
  for (const id of refs) {
    const evidence = await readJson(evidencePath(root, agentId, id));
    if (evidence?.schema !== evidenceSchema || evidence.agentId !== agentId) {
      throw codedError("feedback_evidence_not_found", `Unknown feedback evidence: ${id}`);
    }
    evidenceRecords.push(evidence);
  }
  return evidenceRecords;
}

function appendLearnedCorrection(content, { instruction, expectedImpact, evidenceRefs }) {
  const section = [
    "",
    "## Creator-approved change candidate",
    "",
    `- Rule: ${instruction}`,
    `- Expected impact: ${expectedImpact}`,
    `- Evidence references: ${evidenceRefs.join(", ")}`,
    "- Apply only when the current request matches this rule; preserve explicit user constraints and Harness boundaries.",
    "- Quality check: verify the changed behavior against the cited feedback before finalizing.",
    "",
  ].join("\n");
  return `${String(content || "").trimEnd()}${section}`;
}

function normalizeProposalPath(value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!/^skills\/[a-z0-9][a-z0-9._-]{0,79}\.md$/.test(path) && path !== "workflow/graph.json") {
    throw codedError("invalid_proposal_target", "Skill proposals may target skills/<name>.md or workflow/graph.json only.");
  }
  return path;
}

function requireRevision(status) {
  const revision = Number(status?.workflow?.revision);
  if (!Number.isInteger(revision) || revision < 1) throw codedError("authoring_status_invalid", "Agent authoring revision is unavailable.");
  return revision;
}

function check(id, passed, detail = {}) {
  return { id, passed: Boolean(passed), ...detail };
}

function sessionPath(root, agentId, sessionId) {
  return join(root, "authoring", "sessions", agentId, `${safeRecordId(sessionId)}.json`);
}

function activeSessionPath(root, agentId) {
  return join(root, "authoring", "sessions", agentId, "active.json");
}

function evidencePath(root, agentId, evidenceId) {
  return join(root, "authoring", "evidence", agentId, `${safeRecordId(evidenceId)}.json`);
}

function proposalPath(root, agentId, proposalId) {
  return join(root, "authoring", "proposals", agentId, `${safeRecordId(proposalId)}.json`);
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
}

function digest(value) {
  return `sha256:${createHash("sha256").update(String(value), "utf8").digest("hex")}`;
}

function stripDigestPrefix(value) {
  return String(value || "").replace(/^sha256:/, "");
}

function normalizeAgentId(value) {
  const id = String(value || "").trim().toLowerCase().replace(/^!+/, "");
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(id)) throw codedError("invalid_agent_id", `Invalid Agent id: ${value}`);
  return id;
}

function normalizeSkillId(value) {
  const id = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(id)) throw codedError("invalid_skill_id", `Invalid skill id: ${value}`);
  return id;
}

function optionalId(value) {
  const text = optionalText(value, 80);
  if (!text) return null;
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(text)) throw codedError("invalid_node_id", `Invalid node id: ${text}`);
  return text;
}

function safeRecordId(value) {
  const text = String(value || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,159}$/.test(text)) throw codedError("invalid_record_id", `Invalid record id: ${value}`);
  return text;
}

function stringList(value, maxItems, maxChars) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => optionalText(item, maxChars)).filter(Boolean).slice(0, maxItems);
}

function optionalText(value, maxChars) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxChars) : "";
}

function boundedText(value, label, minChars, maxChars) {
  const text = optionalText(value, maxChars);
  if (text.length < minChars) throw codedError("invalid_authoring_input", `${label} must be at least ${minChars} characters.`);
  return text;
}

function assertCallback(value, label) {
  if (typeof value !== "function") throw new TypeError(`${label} callback is required`);
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}
