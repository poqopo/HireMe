#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createDefaultTools } from "../runtime/src/tools.mjs";

const stateDir = resolve(".hireme/tmp/marketplace-entitlements-smoke");
const strongPrivateMarkerPattern =
  /archiveBase64|contentBase64|BEGIN_PRIVATE|END_PRIVATE|PRIVATE_HARNESS|SECRET_[A-Z0-9_]*|private-source\/|examples\/private\/|evals\/private\/|harness\/(?:policy|routing)\.(?:json|md)|skills\/[^\s"']+|AGENTS\.md|SOUL\.md|OPENAI_API_KEY|refresh token|access token/i;

await rm(stateDir, { recursive: true, force: true });

try {
  const tools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const expectedTool of [
    "hireme_marketplace_list_agents",
    "hireme_marketplace_get_agent",
    "hireme_marketplace_hire_agent",
    "hireme_marketplace_get_entitlement",
    "hireme_marketplace_list_entitlements",
  ]) {
    if (!byName.has(expectedTool)) throw new Error(`Missing marketplace tool: ${expectedTool}`);
  }

  const listed = await byName.get("hireme_marketplace_list_agents").handler({
    query: "launch",
    current_user_id: "smoke-user",
  });
  const available = listed.agents.find((agent) => agent.id === "third-party-launch-operator");
  if (
    !available ||
    available.entitlement !== null ||
    available.protection?.localMaterialization !== "licensed_device_only" ||
    available.runtime?.localHarnessMaterialized !== false
  ) {
    throw new Error("Marketplace list did not return the expected protected available card.");
  }
  assertNoStrongPrivateMarkers("marketplace list", JSON.stringify(listed));

  const deniedCall = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    "smoke-user",
    "agent",
    "call",
    "third-party-launch-operator",
    "HireMe 소개문을 만들어줘",
  ]);
  if (
    !deniedCall.stdout.includes("not hired") ||
    deniedCall.stdout.includes("Protected Runtime Launch Draft")
  ) {
    throw new Error("CLI agent call should require marketplace entitlement before protected runtime execution.");
  }

  const inspect = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    "smoke-user",
    "marketplace",
    "inspect",
    "third-party-launch-operator",
  ]);
  if (
    !inspect.stdout.includes("Third-Party Launch Operator") ||
    !inspect.stdout.includes("private harness: not available")
  ) {
    throw new Error("Marketplace inspect did not return the expected public-safe card.");
  }
  assertNoStrongPrivateMarkers("marketplace inspect", inspect.stdout);

  const hire = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    "smoke-user",
    "marketplace",
    "hire",
    "third-party-launch-operator",
  ]);
  if (!hire.stdout.includes("hired third-party-launch-operator")) {
    throw new Error("Marketplace hire did not grant a local mock entitlement.");
  }

  const entitlement = await byName.get("hireme_marketplace_get_entitlement").handler({
    agent_id: "third-party-launch-operator",
    current_user_id: "smoke-user",
  });
  if (!entitlement.allowed || entitlement.entitlement?.access !== "hire") {
    throw new Error("Marketplace entitlement check did not report active hire access.");
  }

  const allowedCall = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--user-id",
    "smoke-user",
    "agent",
    "call",
    "third-party-launch-operator",
    "HireMe 소개문을 런타임으로 만들어줘",
  ]);
  if (
    !allowedCall.stdout.includes("Protected Runtime Launch Draft") ||
    !allowedCall.stdout.includes("localHarnessMaterialized=true")
  ) {
    throw new Error("CLI agent call did not route hired DB Agent through protected runtime.");
  }

  const entitlementFile = await readFile(`${stateDir}/agent-sources/db/entitlements.json`, "utf8");
  if (!entitlementFile.includes("third-party-launch-operator") || strongPrivateMarkerPattern.test(entitlementFile)) {
    throw new Error("Marketplace entitlement file contains unexpected private material.");
  }

  console.log("Marketplace entitlement smoke passed");
  console.log("Verified: list -> inspect -> denied call -> hire -> entitlement -> local-protected runtime call");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}

function assertNoStrongPrivateMarkers(label, value) {
  if (strongPrivateMarkerPattern.test(String(value || ""))) {
    throw new Error(`${label} contains a strong private marker.`);
  }
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
