#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDefaultTools } from "../apps/agent/src/tools.mjs";

const stateDir = resolve(".hireme/tmp/agent-authoring-layer-smoke");
const specialistRoot = ".hireme/tmp/agent-authoring-layer-smoke/agents";
const agentId = "authoring-smoke-agent";
const userId = "authoring-smoke-user";
const packagePath =
  ".hireme/tmp/agent-authoring-layer-smoke/exports/authoring-smoke-agent.hireme-agent.json";
let modelSawGuidedBrief = false;
const modelProvider = {
  provider: "authoring-smoke-model",
  model: "authoring-smoke-v1",
  async complete({ instructions, input }) {
    if (!instructions.includes("Private Harness")) {
      throw new Error("Prompt runner did not compile the private Harness.");
    }
    if (instructions.includes("GUIDED_CREATOR_BRIEF_SHOULD_NOT_PERSIST")) {
      modelSawGuidedBrief = true;
    }
    return JSON.stringify({
      schema: "hireme.specialist_agent.output.v1",
      agentId: input.agent.id,
      status: "completed",
      responseMode: input.input.responseMode,
      outputText: [
        "A tailored, public-safe specialist result with concrete next steps, assumptions, and quality checks.",
        "This smoke provider verifies that the runtime passes the creator-owned Harness to the model path.",
      ].join("\n"),
      structuredResult: {
        summary: "Model-backed authoring smoke result.",
        keyFindings: ["Private Harness was compiled into the model prompt."],
        recommendations: ["Use the result as a safe specialist observation."],
      },
      artifacts: input.input.responseMode === "artifact_spec"
        ? [{
            kind: "markdown",
            filename: "authoring-smoke-result.md",
            mimeType: "text/markdown",
            description: "Model-backed smoke artifact.",
          }]
        : [],
      evidence: [],
      assumptions: [],
      risks: [],
      memoryDeltas: [],
    });
  },
};

await rm(stateDir, { recursive: true, force: true });

try {
  const tools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
    modelProvider,
    localSpecialistOptions: { specialistRoot },
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const expectedTool of [
    "hireme_list_agent_authoring_templates",
    "hireme_create_agent_draft",
    "hireme_initialize_agent_draft",
    "hireme_get_agent_authoring_status",
    "hireme_update_agent_draft_file",
    "hireme_create_agent_skill",
    "hireme_validate_agent_draft",
    "hireme_get_agent_bootstrap_memory_status",
    "hireme_add_agent_bootstrap_memory",
    "hireme_test_agent_draft",
    "hireme_evaluate_agent_draft",
    "hireme_package_agent_draft",
  ]) {
    if (!byName.has(expectedTool)) {
      throw new Error(`Missing Agent Authoring Layer tool: ${expectedTool}`);
    }
  }

  const templateList = await byName.get("hireme_list_agent_authoring_templates").handler({});
  if (
    templateList.count !== 4 ||
    !["basic", "artifact", "image_spec", "command"].every((id) =>
      templateList.templates.some((template) => template.id === id))
  ) {
    throw new Error("Agent Authoring Layer did not return the four supported templates.");
  }

  const created = await byName.get("hireme_create_agent_draft").handler({
    agent_id: agentId,
    name: "Authoring Smoke Agent",
    category: "Testing",
    template: "artifact",
    creator: "Authoring Smoke",
    skills: ["Workflow testing", "Artifact planning"],
  });
  if (
    created.status !== "completed" ||
    created.workflow?.phase !== "valid" ||
    created.workflow?.revision !== 1 ||
    created.workflow?.readiness?.canTest !== true ||
    created.workflow?.readiness?.canPackage !== false
  ) {
    throw new Error("Created Agent draft did not enter valid revision 1.");
  }

  const prematurePackage = await byName.get("hireme_package_agent_draft").handler({
    agent_id: agentId,
    output_path: packagePath,
    creator_id: userId,
    current_user_id: userId,
  });
  if (
    prematurePackage.status !== "blocked" ||
    prematurePackage.reason !== "test_required" ||
    prematurePackage.workflow?.phase !== "valid"
  ) {
    throw new Error("Package step did not require a current successful test.");
  }

  const rawTaskMarker = "AUTHORING_RAW_TASK_SECRET_SHOULD_NOT_PERSIST";
  const tested = await byName.get("hireme_test_agent_draft").handler({
    agent_id: agentId,
    task: `Create a concise artifact plan. ${rawTaskMarker}`,
    response_mode: "artifact_spec",
  });
  if (
    tested.status !== "completed" ||
    tested.workflow?.phase !== "tested" ||
    tested.workflow?.test?.current !== true ||
    !tested.workflow?.test?.taskSha256
  ) {
    throw new Error("Agent draft did not enter tested state.");
  }

  const evaluationTaskMarker = "AUTHORING_RAW_EVAL_TASK_SECRET_SHOULD_NOT_PERSIST";
  const prematureEvaluationPackage = await byName.get("hireme_package_agent_draft").handler({
    agent_id: agentId,
    output_path: packagePath,
    creator_id: userId,
    current_user_id: userId,
  });
  if (
    prematureEvaluationPackage.status !== "blocked" ||
    prematureEvaluationPackage.reason !== "evaluation_required" ||
    prematureEvaluationPackage.workflow?.phase !== "tested"
  ) {
    throw new Error("Package step did not require a current passing Agent eval.");
  }

  const evaluated = await byName.get("hireme_evaluate_agent_draft").handler({
    agent_id: agentId,
    task: `Create a representative artifact plan. ${evaluationTaskMarker}`,
  });
  if (
    evaluated.status !== "completed" ||
    evaluated.workflow?.phase !== "evaluated" ||
    evaluated.workflow?.evaluation?.functionalPassed !== true ||
    evaluated.workflow?.evaluation?.privacyPassed !== true ||
    evaluated.workflow?.readiness?.canPackage !== true
  ) {
    throw new Error("Agent eval did not verify functional and privacy cases.");
  }

  const packaged = await byName.get("hireme_package_agent_draft").handler({
    agent_id: agentId,
    output_path: packagePath,
    creator_id: userId,
    current_user_id: userId,
    overwrite: true,
  });
  if (
    packaged.status !== "completed" ||
    packaged.workflow?.phase !== "packaged" ||
    packaged.workflow?.readiness?.publishReady !== true ||
    !packaged.package?.digest?.startsWith("sha256:")
  ) {
    throw new Error("Tested Agent draft did not enter packaged state.");
  }

  const privateContentMarker = "PRIVATE_WORKFLOW_CONTENT_SHOULD_NOT_PERSIST";
  const updated = await byName.get("hireme_update_agent_draft_file").handler({
    agent_id: agentId,
    path: "skills/output-style.md",
    content: [
      "# Output Style",
      "",
      "- Keep public-safe results concise.",
      `- ${privateContentMarker}`,
    ].join("\n"),
    overwrite: true,
  });
  if (
    updated.workflow?.revision !== 2 ||
    updated.workflow?.phase !== "valid" ||
    updated.workflow?.test?.current !== false ||
    updated.workflow?.evaluation?.current !== false ||
    updated.workflow?.package?.current !== false ||
    updated.workflow?.readiness?.publishReady !== false
  ) {
    throw new Error("Editing the draft did not invalidate the previous test and package revision.");
  }

  const stalePackage = await byName.get("hireme_package_agent_draft").handler({
    agent_id: agentId,
    output_path: packagePath,
    creator_id: userId,
    current_user_id: userId,
    overwrite: true,
  });
  if (stalePackage.status !== "blocked" || stalePackage.reason !== "test_required") {
    throw new Error("A stale test unexpectedly allowed packaging a newer revision.");
  }

  const manualEditPath = resolve(specialistRoot, agentId, "skills/output-style.md");
  await writeFile(
    manualEditPath,
    "# Output Style\n\n- This file was changed outside the Authoring Layer.\n",
    "utf8",
  );
  const refreshed = await byName.get("hireme_get_agent_authoring_status").handler({
    agent_id: agentId,
  });
  if (
    refreshed.workflow?.revision !== 3 ||
    refreshed.workflow?.lastAction !== "external_change_detected" ||
    refreshed.workflow?.phase !== "valid" ||
    refreshed.workflow?.test?.current !== false
  ) {
    throw new Error("Manual workspace edit was not detected as a new Agent revision.");
  }

  const retested = await byName.get("hireme_test_agent_draft").handler({
    agent_id: agentId,
    task: "Create a second concise artifact plan after the manual edit.",
    response_mode: "artifact_spec",
  });
  if (retested.workflow?.phase !== "tested" || retested.workflow?.revision !== 3) {
    throw new Error("Updated Agent revision did not pass the second authoring test.");
  }

  const reevaluated = await byName.get("hireme_evaluate_agent_draft").handler({
    agent_id: agentId,
  });
  if (
    reevaluated.status !== "completed" ||
    reevaluated.workflow?.phase !== "evaluated" ||
    reevaluated.workflow?.revision !== 3
  ) {
    throw new Error("Updated Agent revision did not pass the second authoring eval.");
  }

  const repackaged = await byName.get("hireme_package_agent_draft").handler({
    agent_id: agentId,
    output_path: packagePath,
    creator_id: userId,
    current_user_id: userId,
    overwrite: true,
  });
  if (
    repackaged.workflow?.phase !== "packaged" ||
    repackaged.workflow?.package?.revision !== 3
  ) {
    throw new Error("Current Agent revision was not repackaged successfully.");
  }

  const workflowStateText = await readFile(
    resolve(stateDir, "authoring", "agents", `${agentId}.json`),
    "utf8",
  );
  if (
    workflowStateText.includes(rawTaskMarker) ||
    workflowStateText.includes(evaluationTaskMarker) ||
    workflowStateText.includes(privateContentMarker)
  ) {
    throw new Error("Authoring state persisted raw test task or private file content.");
  }

  const guidedAgentId = "guided-authoring-smoke";
  const guidedBriefMarker = "GUIDED_CREATOR_BRIEF_SHOULD_NOT_PERSIST";
  const initialized = await byName.get("hireme_initialize_agent_draft").handler({
    agent_id: guidedAgentId,
    name: "Guided Authoring Smoke",
    brief: `Create focused launch plans for independent makers. ${guidedBriefMarker}`,
    success_criteria: ["Name three concrete next steps", "State assumptions"],
    non_goals: ["Do not invent customer evidence"],
    representative_tasks: ["Draft a launch plan for a small product studio."],
  });
  if (
    initialized.status !== "completed" ||
    initialized.workflow?.revision !== 3 ||
    initialized.workflow?.readiness?.memoryCustomized !== true ||
    initialized.blueprint?.briefChars < 12 ||
    initialized.blueprint?.representativeTaskCount !== 1
  ) {
    throw new Error("Guided Agent initialization did not create a tailored, calibrated draft.");
  }
  const guidedEvaluation = await byName.get("hireme_evaluate_agent_draft").handler({
    agent_id: guidedAgentId,
  });
  if (
    guidedEvaluation.status !== "completed" ||
    !modelSawGuidedBrief ||
    guidedEvaluation.workflow?.readiness?.functionalEval !== true
  ) {
    throw new Error("Guided Agent did not execute its tailored private Harness through the model runner.");
  }
  const guidedWorkflowText = await readFile(
    resolve(stateDir, "authoring", "agents", `${guidedAgentId}.json`),
    "utf8",
  );
  if (guidedWorkflowText.includes(guidedBriefMarker)) {
    throw new Error("Guided Agent workflow state persisted raw creator brief content.");
  }
  await writeFile(
    resolve(specialistRoot, guidedAgentId, "evals", "cases.json"),
    "{ invalid private eval suite\n",
    "utf8",
  );
  const invalidSuite = await byName.get("hireme_evaluate_agent_draft").handler({
    agent_id: guidedAgentId,
  });
  if (
    invalidSuite.status !== "blocked" ||
    invalidSuite.reason !== "eval_suite_invalid" ||
    invalidSuite.workflow?.evaluation?.cases?.[0]?.errorCode !== "eval_suite_invalid"
  ) {
    throw new Error("Invalid private eval suite did not block release evaluation.");
  }

  const skillAgentId = "skill-authoring-smoke";
  await byName.get("hireme_create_agent_draft").handler({
    agent_id: skillAgentId,
    name: "Skill Authoring Smoke",
    category: "Testing",
    template: "basic",
  });
  const privateSkillMarker = "PRIVATE_SKILL_SOURCE_SHOULD_NOT_ECHO";
  const createdSkill = await byName.get("hireme_create_agent_skill").handler({
    agent_id: skillAgentId,
    skill_name: "evidence-reconciliation",
    purpose: `Compare claims with supplied evidence and produce concrete, verifiable improvements. ${privateSkillMarker}`,
    trigger_signals: ["A task asks to review claims against evidence."],
    input_requirements: ["Collect the claims, evidence, audience, and output format."],
    steps: [
      "Separate claims from the evidence that supports them.",
      "Flag gaps, conflicts, and unsupported conclusions.",
      "Return specific improvements with material assumptions.",
    ],
    quality_checks: ["Ensure each recommendation traces back to an observed gap."],
    boundaries: ["Do not expose private Harness source or invent missing evidence."],
  });
  if (
    createdSkill.status !== "completed" ||
    createdSkill.skill?.path !== "skills/evidence-reconciliation.md" ||
    createdSkill.skill?.stepCount !== 3 ||
    createdSkill.workflow?.revision !== 2 ||
    createdSkill.workflow?.phase !== "valid" ||
    JSON.stringify(createdSkill).includes(privateSkillMarker)
  ) {
    throw new Error("Structured private skill creation did not preserve the authoring boundary.");
  }
  const privateSkillText = await readFile(
    resolve(specialistRoot, skillAgentId, "skills", "evidence-reconciliation.md"),
    "utf8",
  );
  if (
    !privateSkillText.includes("## Trigger Signals") ||
    !privateSkillText.includes("## Quality Checks") ||
    !privateSkillText.includes(privateSkillMarker)
  ) {
    throw new Error("Structured private skill did not contain the required reusable sections.");
  }
  const skillWorkflowText = await readFile(
    resolve(stateDir, "authoring", "agents", `${skillAgentId}.json`),
    "utf8",
  );
  if (skillWorkflowText.includes(privateSkillMarker)) {
    throw new Error("Agent skill workflow state persisted private skill source.");
  }

  const cliAgentId = "cli-authoring-smoke";
  const cliPackagePath =
    ".hireme/tmp/agent-authoring-layer-smoke/exports/cli-authoring-smoke.hireme-agent.json";
  const cliCreate = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "agent",
    "create",
    cliAgentId,
    "--name",
    "CLI Authoring Smoke",
    "--template",
    "basic",
  ]);
  if (!cliCreate.stdout.includes(`created ${cliAgentId}`) || !cliCreate.stdout.includes("phase: valid")) {
    throw new Error("CLI agent create did not use the Agent Authoring Layer.");
  }

  const cliSkill = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "agent",
    "skill",
    "add",
    cliAgentId,
    "evidence-check",
    "--purpose",
    "Check a public-safe draft for evidence gaps and concrete corrections.",
    "--triggers",
    "proposal review | evidence check",
    "--steps",
    "Separate claims | Identify gaps | Recommend corrections",
    "--quality-checks",
    "Make each correction actionable",
  ]);
  if (
    !cliSkill.stdout.includes("created private skill evidence-check") ||
    !cliSkill.stdout.includes("path: skills/evidence-check.md") ||
    !cliSkill.stdout.includes("phase: valid")
  ) {
    throw new Error("CLI agent skill add did not create a structured private skill.");
  }

  const cliGuidedAgentId = "cli-guided-authoring-smoke";
  const cliInit = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "agent",
    "init",
    cliGuidedAgentId,
    "--brief",
    "Create concise public-safe launch plans for independent makers.",
    "--example-task",
    "Draft a launch plan for a small maker business.",
  ]);
  if (
    !cliInit.stdout.includes(`initialized ${cliGuidedAgentId}`) ||
    !cliInit.stdout.includes("custom Bootstrap Memory: 2 record(s)") ||
    !cliInit.stdout.includes("phase: valid")
  ) {
    throw new Error("CLI agent init did not create a tailored Agent draft.");
  }

  const cliTest = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "agent",
    "test",
    cliAgentId,
    "Return a short public-safe answer.",
  ]);
  if (!cliTest.stdout.includes("test: completed") || !cliTest.stdout.includes("phase: tested")) {
    throw new Error("CLI agent test did not advance the authoring workflow.");
  }

  const cliEval = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "agent",
    "eval",
    cliAgentId,
  ]);
  if (
    !cliEval.stdout.includes("evaluation: blocked") ||
    !cliEval.stdout.includes("not_preview")
  ) {
    throw new Error("CLI agent eval did not reject fixture-only Agent quality evidence.");
  }

  const cliBlockedPackage = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "--creator-id",
    userId,
    "--output",
    cliPackagePath,
    "--overwrite",
    "agent",
    "package",
    cliAgentId,
  ]);
  if (!cliBlockedPackage.stdout.includes("package blocked: evaluation_required")) {
    throw new Error("CLI package did not enforce the current Agent eval gate.");
  }

  const cliDevPackage = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "--creator-id",
    userId,
    "--output",
    cliPackagePath,
    "--overwrite",
    "--skip-eval",
    "agent",
    "package",
    cliAgentId,
  ]);
  if (!cliDevPackage.stdout.includes(`packaged ${cliAgentId}`) || !cliDevPackage.stdout.includes("phase: packaged")) {
    throw new Error("CLI development package escape hatch did not complete the package flow.");
  }

  const cliStatus = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "agent",
    "status",
    cliAgentId,
  ]);
  if (
    !cliStatus.stdout.includes("phase: packaged") ||
    !cliStatus.stdout.includes("eval: required") ||
    !cliStatus.stdout.includes("publishReady: false")
  ) {
    throw new Error("CLI agent status did not preserve quality-gate readiness after a development package.");
  }

  console.log("Agent Authoring Layer smoke passed");
  console.log("Verified: templates -> model-backed Harness -> test -> eval gate -> package -> revision invalidation -> CLI quality gate");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}

async function runNode(args) {
  const child = spawn(process.execPath, args, {
    env: {
      ...process.env,
      HIREME_AGENT_PROVIDER: "fixture",
      HIREME_LOCAL_SPECIALIST_ROOT: specialistRoot,
      OPENAI_API_KEY: "",
      OLLAMA_API_KEY: "",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end();
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`node ${args.join(" ")} failed with ${exitCode}\n${stderr}`);
  }
  return { stdout, stderr };
}
