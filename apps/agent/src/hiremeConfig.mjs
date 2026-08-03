import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const defaultImageBridgeTimeoutMs = 600_000;

export async function readHireMeConfig({ configPath = hiremeConfigPath() } = {}) {
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT") return {};
    throw err;
  }
}

export async function writeHireMeConfig(config, { configPath = hiremeConfigPath() } = {}) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function hiremeConfigPath() {
  return process.env.HIREME_CONFIG || resolve(homedir(), ".hireme", "config.json");
}

export function resolveImageBridgeConfig({
  config = {},
  cliOptions = {},
  env = process.env,
} = {}) {
  const saved = normalizeSavedImageBridge(config.imageGeneration || config.imageBridge || {});
  const envArgs = readJsonArray(env.HIREME_CODEX_IMAGE_GEN_ARGS);
  const cliArgs = readJsonArray(cliOptions.imageBridgeArgs);

  const cliCommand = nonEmpty(cliOptions.imageBridgeCommand);
  const envCommand = nonEmpty(env.HIREME_CODEX_IMAGE_GEN_COMMAND);
  const savedCommand = nonEmpty(saved.command);
  const command = cliCommand || envCommand || savedCommand || "";

  const args =
    cliArgs ||
    envArgs ||
    (Array.isArray(saved.args) ? saved.args.map(String) : []);

  const cliTimeout = readPositiveInteger(cliOptions.imageBridgeTimeoutMs);
  const envTimeout = readPositiveInteger(env.HIREME_CODEX_IMAGE_GEN_TIMEOUT_MS);
  const savedTimeout = readPositiveInteger(saved.timeoutMs);
  const timeoutMs = cliTimeout || envTimeout || savedTimeout || defaultImageBridgeTimeoutMs;

  const source = cliCommand
    ? "cli"
    : envCommand
      ? "env"
      : savedCommand
        ? "config"
        : "none";

  return {
    configured: Boolean(command),
    source,
    command,
    args,
    timeoutMs,
    saved,
    imageArtifactOptions: {
      codexImageGenCommand: command,
      codexImageGenArgs: args,
      codexImageGenTimeoutMs: timeoutMs,
    },
  };
}

export function normalizeSavedImageBridge(value = {}) {
  const raw = value || {};
  return {
    kind: raw.kind || "codex_host_bridge",
    command: nonEmpty(raw.command) || "",
    args: Array.isArray(raw.args) ? raw.args.map(String) : [],
    timeoutMs: readPositiveInteger(raw.timeoutMs) || defaultImageBridgeTimeoutMs,
    updatedAt: raw.updatedAt || null,
  };
}

export function publicImageBridgeStatus(config = {}, cliOptions = {}) {
  const resolved = resolveImageBridgeConfig({ config, cliOptions });
  return {
    configPath: cliOptions.config || hiremeConfigPath(),
    configured: resolved.configured,
    source: resolved.source,
    command: resolved.command || null,
    args: resolved.args,
    timeoutMs: resolved.timeoutMs,
    saved: resolved.saved.command
      ? {
          kind: resolved.saved.kind,
          command: resolved.saved.command,
          args: resolved.saved.args,
          timeoutMs: resolved.saved.timeoutMs,
          updatedAt: resolved.saved.updatedAt,
        }
      : null,
    env: {
      commandSet: Boolean(process.env.HIREME_CODEX_IMAGE_GEN_COMMAND),
      argsSet: Boolean(process.env.HIREME_CODEX_IMAGE_GEN_ARGS),
      timeoutSet: Boolean(process.env.HIREME_CODEX_IMAGE_GEN_TIMEOUT_MS),
    },
  };
}

function nonEmpty(value) {
  const text = String(value || "").trim();
  return text || "";
}

function readJsonArray(value) {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value.map(String);
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return text.split(/\s+/).filter(Boolean);
  }
}

function readPositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
