#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createDefaultTools } from "../apps/agent/src/tools.mjs";
import { createLocalSpecialistCreatorTools } from "../apps/agent/src/localSpecialistCreatorTools.mjs";
import {
  createSpecialistMemoryStore,
  readBootstrapMemory,
  resolveSpecialistMemoryLayers,
} from "../apps/agent/src/specialistMemory.mjs";

const workspaceDir = process.cwd();
const tempRoot = resolve(".hireme/tmp/specialist-memory-smoke");
const stateDir = join(tempRoot, "state");
const specialistRoot = ".hireme/tmp/specialist-memory-smoke/agents";
const importedRoot = ".hireme/tmp/specialist-memory-smoke/imported-agents";
const agentId = "memory-architecture-smoke";
const creatorId = "memory-smoke-creator";
const fullPackagePath = ".hireme/tmp/specialist-memory-smoke/exports/full.hireme-agent.json";
const publicPackagePath = ".hireme/tmp/specialist-memory-smoke/exports/public.hireme-agent.json";
const customMemoryText = "MEMORY_PRIVATE_MARKER Prefer evidence-backed conclusions and state one concrete next action.";

await rm(tempRoot, { recursive: true, force: true });

try {
  const tools = createDefaultTools({
    workspaceDir,
    stateDir,
    enableHireMeTools: true,
    marketplaceOptions: { currentUserId: creatorId },
    localSpecialistOptions: {
      specialistRoot,
      defaultConversationId: "memory-smoke-session",
    },
    specialistMemoryOptions: {
      defaultConversationId: "memory-smoke-session",
    },
    agentSourceLayerOptions: {
      defaultConversationId: "memory-smoke-session",
    },
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const name of [
    "hireme_get_agent_bootstrap_memory_status",
    "hireme_add_agent_bootstrap_memory",
    "hireme_get_agent_memory_status",
    "hireme_remember_agent_session_memory",
    "hireme_remember_agent_user_memory",
    "hireme_promote_agent_session_memory",
  ]) {
    assert.ok(byName.has(name), `Missing memory tool: ${name}`);
  }

  const created = await byName.get("hireme_create_agent_draft").handler({
    agent_id: agentId,
    name: "Memory Architecture Smoke",
    category: "Testing",
    template: "basic",
  });
  assert.equal(created.status, "completed");
  assert.equal(created.workflow.readiness.memoryReady, true);
  assert.equal(created.workflow.readiness.memoryCustomized, false);

  const agentRoot = resolve(specialistRoot, agentId);
  const initialBootstrap = await readBootstrapMemory({ agentRoot });
  assert.equal(initialBootstrap.errors.length, 0);
  assert.equal(initialBootstrap.records.length, 2);
  assert.ok(initialBootstrap.records.every((record) => record.starter === true));

  const initialStatus = await byName.get("hireme_get_agent_bootstrap_memory_status").handler({
    agent_id: agentId,
  });
  assert.equal(initialStatus.memory.starterCount, 2);
  assert.equal(initialStatus.memory.customCount, 0);
  assert.ok(!JSON.stringify(initialStatus).includes(initialBootstrap.records[0].text));

  await byName.get("hireme_test_agent_draft").handler({
    agent_id: agentId,
    task: "Return a concise baseline result.",
  });
  const initialPackage = await byName.get("hireme_package_agent_draft").handler({
    agent_id: agentId,
    output_path: fullPackagePath,
    creator_id: creatorId,
    current_user_id: creatorId,
    require_evaluation: false,
    overwrite: true,
  });
  assert.equal(initialPackage.status, "completed");
  assert.equal(initialPackage.workflow.package.current, true);

  const memoryUpdate = await byName.get("hireme_add_agent_bootstrap_memory").handler({
    agent_id: agentId,
    records: [{
      key: "quality.evidence-and-action",
      kind: "principle",
      text: customMemoryText,
      tags: ["quality", "evidence"],
      priority: 88,
    }],
  });
  assert.equal(memoryUpdate.status, "completed");
  assert.equal(memoryUpdate.workflow.revision, 2);
  assert.equal(memoryUpdate.workflow.test.current, false);
  assert.equal(memoryUpdate.workflow.package.current, false);
  assert.equal(memoryUpdate.workflow.readiness.memoryCustomized, true);
  assert.equal(memoryUpdate.memory.count, 3);
  assert.ok(!JSON.stringify(memoryUpdate).includes(customMemoryText));

  const precedence = resolveSpecialistMemoryLayers({
    bootstrap: [memoryRecord("bootstrap", "output.style", "Bootstrap style")],
    user: [memoryRecord("user", "output.style", "User style")],
    session: [memoryRecord("session", "output.style", "Session style")],
    query: "style",
  });
  assert.deepEqual(precedence.precedence, ["current_request", "session", "user", "bootstrap"]);
  const effectiveStyle = precedence.effective.find((record) => record.key === "output.style");
  assert.equal(effectiveStyle.text, "Session style");
  assert.equal(effectiveStyle.scope, "session");
  assert.match(precedence.directive, /current request overrides all soft memory/i);

  const memoryStore = createSpecialistMemoryStore({ stateDir });
  await memoryStore.rememberUser({
    agentId,
    userId: "user-a",
    records: [{ key: "user.tone", text: "Use concise professional language." }],
  });
  const userBRecall = await memoryStore.recall({
    agentRoot,
    agentId,
    userId: "user-b",
    conversationId: "conversation-a",
  });
  assert.equal(userBRecall.available.user, 0);

  await memoryStore.rememberSession({
    agentId,
    userId: "user-a",
    conversationId: "conversation-a",
    records: [{ key: "project.audience", text: "The audience is independent designers." }],
    strict: true,
  });
  const otherSessionRecall = await memoryStore.recall({
    agentRoot,
    agentId,
    userId: "user-a",
    conversationId: "conversation-b",
  });
  assert.equal(otherSessionRecall.available.session, 0);
  assert.equal(otherSessionRecall.available.user, 1);

  const promoted = await memoryStore.promoteSession({
    agentId,
    userId: "user-a",
    conversationId: "conversation-a",
    keys: ["project.audience"],
  });
  assert.equal(promoted.promoted, 1);
  const promotedRecall = await memoryStore.recall({
    agentRoot,
    agentId,
    userId: "user-a",
    conversationId: "conversation-new",
  });
  assert.equal(promotedRecall.available.session, 0);
  assert.equal(promotedRecall.available.user, 2);
  assert.ok(promotedRecall.effective.some((record) => record.key === "project.audience"));

  await assert.rejects(
    memoryStore.rememberUser({
      agentId,
      userId: "user-a",
      records: [{ text: "OPENAI_API_KEY=sk-this-value-must-never-be-stored" }],
      strict: true,
    }),
    /credentials|protected raw-content/i,
  );

  const runtimeTools = createDefaultTools({
    workspaceDir,
    stateDir,
    enableHireMeTools: true,
    marketplaceOptions: { currentUserId: "runtime-user" },
    localSpecialistOptions: {
      specialistRoot: "examples/local-specialist-agents",
      defaultConversationId: "runtime-session",
    },
  });
  const runtimeByName = new Map(runtimeTools.map((tool) => [tool.name, tool]));
  const localCall = runtimeByName.get("hireme_call_local_specialist_agent");
  const firstLocalResult = await localCall.handler({
    agent_id: "launch-brief-specialist",
    task: "Create a launch brief for HireMe.",
    current_user_id: "runtime-user",
    conversation_id: "runtime-session",
  });
  assert.ok(firstLocalResult.runtime.memory.selected.bootstrap > 0);
  assert.equal(firstLocalResult.runtime.memory.sessionWrite.written, 1);
  const secondLocalResult = await localCall.handler({
    agent_id: "launch-brief-specialist",
    task: "Refine the launch brief for freelancers.",
    current_user_id: "runtime-user",
    conversation_id: "runtime-session",
  });
  assert.ok(secondLocalResult.runtime.memory.available.session > 0);

  const protectedResult = await runtimeByName.get("hireme_call_protected_agent_runtime").handler({
    agent_id: "third-party-launch-operator",
    task: "Create protected launch positioning for HireMe.",
    current_user_id: "runtime-user",
    conversation_id: "protected-session",
    save_local_result: false,
  });
  assert.ok(protectedResult.runtime.memory.selected.bootstrap > 0);
  assert.equal(
    protectedResult.runtime.localHarnessMaterialized,
    protectedResult.runtime.executionMode === "local_protected",
  );
  assert.equal(protectedResult.runtime.localPlaintextCache, false);
  const protectedJson = JSON.stringify(protectedResult);
  assert.ok(!protectedJson.includes("Lead with a concrete before-and-after proof"));
  assert.ok(!protectedJson.includes("memoryContext"));

  const retested = await byName.get("hireme_test_agent_draft").handler({
    agent_id: agentId,
    task: "Return a result after Bootstrap Memory customization.",
  });
  assert.equal(retested.status, "completed");
  assert.ok(retested.workflow.test.memory.bootstrapSelected > 0);

  const fullExport = await byName.get("hireme_package_agent_draft").handler({
    agent_id: agentId,
    output_path: fullPackagePath,
    creator_id: creatorId,
    current_user_id: creatorId,
    require_evaluation: false,
    overwrite: true,
  });
  assert.equal(fullExport.status, "completed");
  assert.equal(fullExport.package.memory.bootstrap.included, true);
  assert.equal(fullExport.package.memory.user.included, false);
  assert.equal(fullExport.package.memory.session.included, false);

  const fullPackage = JSON.parse(await readFile(resolve(fullPackagePath), "utf8"));
  assert.equal(fullPackage.packageVersion, "1.1.0");
  assert.ok(fullPackage.memory.bootstrap.digest.startsWith("sha256:"));
  assert.ok(fullPackage.files.some((file) => file.path === "memory/bootstrap.jsonl"));

  const publicExport = await byName.get("hireme_export_local_specialist_agent").handler({
    agent_id: agentId,
    output_path: publicPackagePath,
    package_mode: "public",
    creator_id: creatorId,
    current_user_id: creatorId,
    overwrite: true,
  });
  assert.equal(publicExport.memory.bootstrap.included, false);
  assert.equal(publicExport.memory.bootstrap.digest, null);
  const publicPackage = JSON.parse(await readFile(resolve(publicPackagePath), "utf8"));
  assert.ok(!publicPackage.files.some((file) => file.path === "memory/bootstrap.jsonl"));
  assert.equal(publicPackage.memory.bootstrap.digest, null);

  const importTools = createLocalSpecialistCreatorTools({
    workspaceDir,
    specialistRoot: importedRoot,
  });
  const importTool = importTools.find((tool) => tool.name === "hireme_import_local_specialist_agent");
  const imported = await importTool.handler({
    package_path: fullPackagePath,
    current_user_id: creatorId,
    overwrite: true,
  });
  assert.equal(imported.memory.userImported, false);
  assert.equal(imported.memory.sessionImported, false);
  assert.equal(imported.memory.bootstrap.digest, fullPackage.memory.bootstrap.digest);
  const importedBootstrap = await readBootstrapMemory({
    agentRoot: resolve(importedRoot, agentId),
  });
  assert.equal(importedBootstrap.records.length, 3);

  const cliMemoryText = "CLI_MEMORY_PRIVATE_MARKER Keep the final answer operational.";
  const cliAdd = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    creatorId,
    "agent",
    "memory",
    "add",
    agentId,
    "--key",
    "output.operational",
    "--kind",
    "preference",
    "--priority",
    "80",
    "--content",
    cliMemoryText,
  ]);
  assert.match(cliAdd.stdout, /updated memory-architecture-smoke Bootstrap Memory/);
  assert.ok(!cliAdd.stdout.includes(cliMemoryText));
  const cliStatus = await runNode([
    "bin/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    creatorId,
    "agent",
    "memory",
    agentId,
  ]);
  assert.match(cliStatus.stdout, /custom: 2/);
  assert.ok(!cliStatus.stdout.includes(cliMemoryText));

  console.log("Specialist Memory smoke passed");
  console.log("Verified: Bootstrap -> User -> Session layering, isolation, promotion, runtime injection, protected execution, package round-trip, and CLI authoring");
} finally {
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}

function memoryRecord(scope, key, text) {
  return {
    id: `${scope}-${key}`,
    key,
    kind: "preference",
    text,
    tags: ["style"],
    priority: 50,
    scope,
    visibility: scope === "bootstrap" ? "protected" : "hirer_visible",
  };
}

async function runNode(args) {
  const child = spawn(process.execPath, args, {
    cwd: workspaceDir,
    env: {
      ...process.env,
      HIREME_AGENT_PROVIDER: "fixture",
      HIREME_LOCAL_SPECIALIST_ROOT: specialistRoot,
      OPENAI_API_KEY: "",
      OLLAMA_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`node ${args.join(" ")} failed with ${exitCode}\n${stderr}`);
  }
  return { stdout, stderr };
}
