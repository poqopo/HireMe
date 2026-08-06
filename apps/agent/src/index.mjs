#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAgentMemory } from "./memory.mjs";
import { createModelProvider } from "./providers.mjs";
import { readHireMeConfig, resolveImageBridgeConfig } from "./hiremeConfig.mjs";
import { createStandaloneAgent, loadStandaloneAgentProfile } from "./runtime.mjs";
import { createDefaultTools } from "./tools.mjs";

loadEnvFiles([".env", ".env.local"]);

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const goal = options.goal || options._.join(" ");
if (!goal.trim()) {
  throw new Error("A goal is required. Pass --goal \"...\" or provide it as positional text.");
}

const agentDir = resolve(options.agent || "apps/agent/agents/hireme-operator");
const profile = await loadStandaloneAgentProfile(agentDir);
const stateDir = resolve(options.stateDir || `.hireme/standalone-agent/${profile.id}`);
const workspaceDir = resolve(options.workspace || process.cwd());
const hiremeConfig = await readHireMeConfig({ configPath: options.config });
const imageBridge = resolveImageBridgeConfig({
  config: hiremeConfig,
  cliOptions: options,
});
const provider = createModelProvider({
  provider: options.provider || profile.defaultProvider,
  model: options.model,
  baseUrl: options.baseUrl,
  apiKey: options.apiKey,
  workspaceDir,
});
const memory = createAgentMemory({ stateDir });
const tools = createDefaultTools({
  workspaceDir,
  stateDir,
  modelProvider: provider,
  allowShell: false,
  enableHireMeTools: options.noHiremeTools !== true,
  enableLocalSpecialistCreatorTools: false,
  enableAgentAuthoringTools: false,
  runtimeMode: "work",
  imageArtifactOptions: imageBridge.imageArtifactOptions,
});
const agent = createStandaloneAgent({
  profile,
  model: provider,
  memory,
  tools,
  limits: {
    maxIterations: readInteger(options.maxIterations, 8),
    maxToolCalls: readInteger(options.maxToolCalls, 10),
  },
});

const result = await agent.run({
  goal,
  context: {
    workspaceDir,
    stateDir,
    runtimeMode: "work",
    managementPolicyText: goal,
    cli: {
      allowShell: false,
      hireMeTools: options.noHiremeTools !== true,
      imageBridge: {
        configured: imageBridge.configured,
        source: imageBridge.source,
        command: imageBridge.command || null,
      },
    },
  },
});

if (options.json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(`${result.outputText}\n`);
  if (options.printEvents) {
    process.stdout.write(`\nEvents:\n${JSON.stringify(result.events, null, 2)}\n`);
  }
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = toCamelCase(rawKey);
    if (["json", "printEvents", "allowShell", "noHiremeTools"].includes(key)) {
      parsed[key] = true;
      continue;
    }
    const next = inlineValue ?? argv[i + 1];
    if (inlineValue == null) i += 1;
    parsed[key] = next;
  }
  return parsed;
}

function toCamelCase(value) {
  return String(value || "").replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadEnvFiles(paths) {
  for (const path of paths) {
    let text = "";
    try {
      text = readFileSync(path, "utf8");
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
      continue;
    }
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = stripEnvQuotes(match[2]);
    }
  }
}

function stripEnvQuotes(value) {
  const text = String(value || "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function printHelp() {
  process.stdout.write(`Usage:
  npm run agent:run -- --goal "Inspect this repo and suggest the next build step"

Options:
  --agent PATH              Agent profile directory. Default: apps/agent/agents/hireme-operator
  --workspace PATH          Workspace root. Default: current directory
  --state-dir PATH          Durable agent state. Default: .hireme/standalone-agent/<agent-id>
  --provider NAME           fixture, openai, or ollama. Default comes from agent.json
  --model NAME              Provider model override
  --base-url URL            Provider base URL override
  --api-key KEY             Provider API key override
  --config PATH             HireMe config path. Default: ~/.hireme/config.json
  --image-bridge-command PATH
                            Custom image provider command
  --image-bridge-args JSON  JSON array of extra bridge args
  --image-bridge-timeout-ms MS
                            Image provider timeout. Default: 120000
  --allow-shell             Expose run_command tool to the agent
  --no-hireme-tools         Disable local HireMe Agent tools
  --json                    Print full JSON result
  --print-events            Print event trace after plain output
`);
}
