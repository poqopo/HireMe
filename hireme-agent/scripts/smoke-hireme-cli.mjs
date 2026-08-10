#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const stateDir = resolve(".hireme/tmp/hireme-cli-smoke");
const configPath = resolve(stateDir, "config.json");
await rm(stateDir, { recursive: true, force: true });

try {
  const help = await runNode(["cli/hireme.mjs", "--help"]);
  if (!help.stdout.includes("Usage:") || !help.stdout.includes("hireme")) {
    throw new Error("hireme --help did not print CLI help.");
  }

  const oneShot = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "Say hello once",
  ]);
  if (!oneShot.stdout.includes("Standalone agent fixture completed.")) {
    throw new Error("hireme one-shot command did not run the standalone agent.");
  }
  if (!oneShot.stdout.includes("elapsed") || !oneShot.stdout.includes("tools")) {
    throw new Error("hireme one-shot command did not print final timing metadata.");
  }

  const bridgeShowBefore = await runNode([
    "cli/hireme.mjs",
    "--config",
    configPath,
    "image-bridge",
    "show",
  ]);
  const bridgeStatusBefore = JSON.parse(bridgeShowBefore.stdout);
  if (bridgeStatusBefore.configured !== false) {
    throw new Error("hireme image-bridge show should start unconfigured in isolated config.");
  }

  const bridgeSetFixture = await runNode([
    "cli/hireme.mjs",
    "--config",
    configPath,
    "image-bridge",
    "set-fixture",
  ]);
  if (!bridgeSetFixture.stdout.includes("local fixture mode")) {
    throw new Error("hireme image-bridge set-fixture did not save fixture mode.");
  }

  const bridgeTest = await runNode([
    "cli/hireme.mjs",
    "--config",
    configPath,
    "--state-dir",
    stateDir,
    "image-bridge",
    "test",
  ]);
  const bridgeTestStatus = JSON.parse(bridgeTest.stdout);
  if (
    bridgeTestStatus.status !== "completed" ||
    bridgeTestStatus.provider !== "codex_image_gen" ||
    bridgeTestStatus.mimeType !== "image/png" ||
    !bridgeTestStatus.path?.endsWith("image-bridge-test.png")
  ) {
    throw new Error("hireme image-bridge test did not materialize a validated PNG.");
  }

  const agentList = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "!",
  ]);
  if (
    !agentList.stdout.includes("Available !agents") ||
    !agentList.stdout.includes("!launch-brief-specialist") ||
    !agentList.stdout.includes("!dokpami-create-agent")
  ) {
    throw new Error("hireme ! shortcut did not list local specialist Agents.");
  }

  const fileList = await runNode([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "@",
  ]);
  if (
    !fileList.stdout.includes("Available @files") ||
    !fileList.stdout.includes("@runtime/src/tools.mjs")
  ) {
    throw new Error("hireme @ shortcut did not list workspace files.");
  }

  const selectAgent = await runInteractive([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--session",
    "agent-select-smoke",
  ], "!dokpami-create-agent\n!clear\n/exit\n");
  if (
    !selectAgent.stdout.includes("selected !dokpami-create-agent") ||
    !selectAgent.stdout.includes("cleared active !agent selection")
  ) {
    throw new Error("hireme !agent selection shortcut did not work.");
  }

  const chat = await runInteractive([
    "cli/hireme.mjs",
    "--provider",
    "fixture",
    "--state-dir",
    stateDir,
    "--session",
    "smoke-session",
  ], "/provider\n/exit\n");
  if (!chat.stdout.includes("HireMe Agent") || !chat.stdout.includes("fixture")) {
    throw new Error("hireme interactive session did not start.");
  }
  if (!chat.stdout.includes("bye")) {
    throw new Error("hireme interactive session did not handle /exit.");
  }

  console.log("HireMe CLI smoke passed");
  console.log("Verified: help -> one-shot -> image bridge -> !agent list/select -> @file list -> interactive session");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}

async function runNode(args) {
  return runInteractive(args, "");
}

async function runInteractive(args, stdinText) {
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
  if (stdinText) child.stdin.write(stdinText);
  child.stdin.end();
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`node ${args.join(" ")} failed with ${exitCode}\n${stderr}`);
  }
  return { stdout, stderr };
}
