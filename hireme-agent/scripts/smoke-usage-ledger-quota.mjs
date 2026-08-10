#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createDefaultTools } from "../runtime/src/tools.mjs";

const stateDir = resolve(".hireme/tmp/usage-ledger-quota-smoke");
const userId = "usage-smoke-user";
const agentId = "third-party-launch-operator";
await rm(stateDir, { recursive: true, force: true });

try {
  const tools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
    marketplaceOptions: {
      currentUserId: userId,
    },
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const expectedTool of [
    "hireme_marketplace_hire_agent",
    "hireme_marketplace_get_entitlement",
    "hireme_call_agent_source",
    "hireme_list_usage_ledger",
  ]) {
    if (!byName.has(expectedTool)) throw new Error(`Missing usage/quota dependency: ${expectedTool}`);
  }

  const trial = await byName.get("hireme_marketplace_hire_agent").handler({
    agent_id: agentId,
    access_type: "try",
    current_user_id: userId,
  });
  if (
    trial.entitlement.access !== "try" ||
    trial.entitlement.remainingTrialCalls !== 3 ||
    trial.entitlement.callAllowed !== true
  ) {
    throw new Error("Trial entitlement was not granted with three callable trial calls.");
  }

  for (let index = 0; index < 3; index += 1) {
    const task = `Usage smoke trial call ${index + 1}`;
    const result = await byName.get("hireme_call_agent_source").handler({
      agent_id: agentId,
      task,
      current_user_id: userId,
    });
    const expectedRemaining = 2 - index;
    if (
      result.status !== "completed" ||
      result.usage?.trialCallsConsumed !== 1 ||
      result.usage?.remainingTrialCalls !== expectedRemaining
    ) {
      throw new Error(`Trial call ${index + 1} did not decrement quota to ${expectedRemaining}.`);
    }
    const entitlement = await byName.get("hireme_marketplace_get_entitlement").handler({
      agent_id: agentId,
      current_user_id: userId,
    });
    if (entitlement.entitlement?.remainingTrialCalls !== expectedRemaining) {
      throw new Error(`Entitlement store did not persist remaining quota ${expectedRemaining}.`);
    }
  }

  const exhausted = await byName.get("hireme_marketplace_get_entitlement").handler({
    agent_id: agentId,
    current_user_id: userId,
  });
  if (
    exhausted.allowed !== false ||
    exhausted.reason !== "trial_quota_exhausted" ||
    exhausted.entitlement?.remainingTrialCalls !== 0
  ) {
    throw new Error("Trial entitlement should be exhausted after three calls.");
  }

  const denied = await byName.get("hireme_call_agent_source").handler({
    agent_id: agentId,
    task: "Usage smoke trial call 4 should be denied",
    current_user_id: userId,
  });
  if (
    denied.status !== "refused" ||
    !denied.outputText.includes("Trial quota is exhausted") ||
    denied.sourceResolution?.entitlement?.remainingTrialCalls !== 0
  ) {
    throw new Error("Fourth trial call should be refused by quota guard.");
  }

  const ledger = await byName.get("hireme_list_usage_ledger").handler({
    current_user_id: userId,
    agent_id: agentId,
    limit: 10,
  });
  if (
    ledger.count !== 4 ||
    ledger.entries.filter((entry) => entry.status === "completed").length !== 3 ||
    ledger.entries.filter((entry) => entry.status === "refused").length !== 1 ||
    ledger.entries.filter((entry) => entry.trialCallsConsumed === 1).length !== 3 ||
    ledger.entries.some((entry) => !entry.taskSha256 || entry.taskChars <= 0)
  ) {
    throw new Error("Usage ledger did not record completed/refused trial calls correctly.");
  }

  const ledgerText = await readFile(`${stateDir}/agent-sources/usage-ledger.jsonl`, "utf8");
  if (/Usage smoke trial call/.test(ledgerText) || /archiveBase64|contentBase64|AGENTS\.md|PRIVATE_HARNESS/.test(ledgerText)) {
    throw new Error("Usage ledger contains raw task text or private markers.");
  }

  const cliUsage = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    userId,
    "marketplace",
    "usage",
    agentId,
  ]);
  if (!cliUsage.stdout.includes("Usage Ledger") || !cliUsage.stdout.includes("trial-1")) {
    throw new Error("CLI marketplace usage did not print usage ledger entries.");
  }

  await byName.get("hireme_marketplace_hire_agent").handler({
    agent_id: agentId,
    access_type: "hire",
    current_user_id: userId,
  });
  const hiredCall = await byName.get("hireme_call_agent_source").handler({
    agent_id: agentId,
    task: "Usage smoke hired call",
    current_user_id: userId,
  });
  if (
    hiredCall.status !== "completed" ||
    hiredCall.usage?.trialCallsConsumed !== 0 ||
    hiredCall.usage?.remainingTrialCalls !== null
  ) {
    throw new Error("Hire access should allow calls without consuming trial quota.");
  }

  console.log("Usage ledger and try quota smoke passed");
  console.log("Verified: try grant -> three quota decrements -> exhausted refusal -> safe ledger -> hire upgrade");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}

async function runNode(args) {
  const child = spawn("node", args, {
    env: {
      ...process.env,
      HIREME_AGENT_PROVIDER: "fixture",
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
