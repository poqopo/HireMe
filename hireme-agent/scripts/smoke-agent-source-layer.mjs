#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createDefaultTools } from "../runtime/src/tools.mjs";

const stateDir = resolve(".hireme/tmp/agent-source-layer-smoke");
const specialistRoot = ".hireme/tmp/agent-source-layer-smoke/agents";
await rm(stateDir, { recursive: true, force: true });

try {
  const tools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
    localSpecialistOptions: {
      specialistRoot,
    },
    marketplaceOptions: {
      currentUserId: "source-smoke-user",
    },
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const expectedTool of [
    "hireme_create_local_specialist_agent",
    "hireme_update_local_specialist_agent_file",
    "hireme_validate_local_specialist_agent",
    "hireme_list_agent_sources",
    "hireme_resolve_agent_source",
    "hireme_call_agent_source",
    "hireme_marketplace_hire_agent",
  ]) {
    if (!byName.has(expectedTool)) throw new Error(`Missing source-layer dependency: ${expectedTool}`);
  }

  await byName.get("hireme_create_local_specialist_agent").handler({
    agent_id: "source-layer-local",
    name: "Source Layer Local",
    category: "Testing",
    template: "basic",
    overwrite: true,
  });

  const localResolution = await byName.get("hireme_resolve_agent_source").handler({
    agent_id: "source-layer-local",
    current_user_id: "source-smoke-user",
  });
  if (
    localResolution.source !== "local" ||
    localResolution.callMode !== "local_specialist" ||
    localResolution.authoring?.editable !== true ||
    localResolution.authoring?.privateHarnessEditable !== true ||
    localResolution.runtimeBoundary?.localHarnessMaterialized !== true
  ) {
    throw new Error("Local Agent did not resolve with creator-owned authoring freedom.");
  }

  const update = await byName.get("hireme_update_local_specialist_agent_file").handler({
    agent_id: "source-layer-local",
    path: "harness/routing.md",
    content: "# Routing\n\nCreator-owned local harness edits are allowed in the local source layer smoke.\n",
    overwrite: true,
  });
  if (update.visibility !== "private" || update.role !== "private policy and routing") {
    throw new Error("Local harness update did not preserve private harness metadata.");
  }

  const validation = await byName.get("hireme_validate_local_specialist_agent").handler({
    agent_id: "source-layer-local",
  });
  if (!validation.valid) throw new Error("Local Agent became invalid after private harness edit.");

  const localCall = await byName.get("hireme_call_agent_source").handler({
    agent_id: "source-layer-local",
    task: "간단한 결과를 만들어줘",
    current_user_id: "source-smoke-user",
  });
  if (
    localCall.status !== "completed" ||
    localCall.sourceResolution?.source !== "local" ||
    localCall.sourceResolution?.authoring?.privateHarnessEditable !== true
  ) {
    throw new Error("Source layer did not call local Agent through local_specialist mode.");
  }

  const dbAvailable = await byName.get("hireme_resolve_agent_source").handler({
    agent_id: "third-party-launch-operator",
    current_user_id: "source-smoke-user",
  });
  if (
    dbAvailable.source !== "db" ||
    dbAvailable.canCall !== false ||
    dbAvailable.entitlementRequired !== true ||
    dbAvailable.authoring?.privateHarnessEditable !== false ||
    dbAvailable.runtimeBoundary?.localHarnessMaterialized !== false
  ) {
    throw new Error("DB Agent Source did not resolve as protected entitlement-required source.");
  }

  const denied = await byName.get("hireme_call_agent_source").handler({
    agent_id: "third-party-launch-operator",
    task: "HireMe 소개문을 만들어줘",
    current_user_id: "source-smoke-user",
  });
  if (denied.status !== "refused" || denied.sourceResolution?.source !== "db") {
    throw new Error("Source layer should refuse DB Agent Source call before entitlement.");
  }

  await byName.get("hireme_marketplace_hire_agent").handler({
    agent_id: "third-party-launch-operator",
    current_user_id: "source-smoke-user",
  });

  const dbHired = await byName.get("hireme_resolve_agent_source").handler({
    agent_id: "third-party-launch-operator",
    current_user_id: "source-smoke-user",
  });
  if (
    dbHired.source !== "db" ||
    dbHired.canCall !== true ||
    dbHired.callMode !== "protected_runtime"
  ) {
    throw new Error("DB Agent Source did not resolve as callable after hire.");
  }

  const dbCall = await byName.get("hireme_call_agent_source").handler({
    agent_id: "third-party-launch-operator",
    task: "HireMe 소개문을 런타임으로 만들어줘",
    current_user_id: "source-smoke-user",
  });
  if (
    dbCall.status !== "completed" ||
    dbCall.sourceResolution?.source !== "db" ||
    dbCall.runtime?.executionMode !== "local_protected" ||
    dbCall.runtime?.localHarnessMaterialized !== true
  ) {
    throw new Error("Source layer did not route hired DB Agent through protected runtime.");
  }

  const cliResolve = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    "source-smoke-user",
    "agent",
    "resolve",
    "third-party-launch-operator",
  ]);
  if (!cliResolve.stdout.includes("source: db_agent_source")) {
    throw new Error("CLI agent resolve did not use the Agent Source Layer.");
  }

  console.log("Agent Source Layer smoke passed");
  console.log("Verified: local resolve/edit/call -> DB available refusal -> hire -> local-protected runtime call -> CLI resolve");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}

async function runNode(args) {
  const child = spawn("node", args, {
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
