import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultRuntimeDir = ".hireme/walrus/protected-runtime";

loadEnvFile(".env");
loadEnvFile(".env.local");

export async function storeFileOnWalrus({ filePath, epochs = 3 }) {
  const args = ["store", "--json", "--epochs", String(epochs)];
  if (process.env.WALRUS_CONTEXT) {
    args.push("--context", process.env.WALRUS_CONTEXT);
  }
  if (process.env.WALRUS_CONFIG_PATH) {
    args.push("--config", process.env.WALRUS_CONFIG_PATH);
  }
  if (process.env.WALRUS_UPLOAD_RELAY_URL) {
    args.push(
      "--upload-relay",
      process.env.WALRUS_UPLOAD_RELAY_URL,
      "--skip-tip-confirmation",
    );
  }
  args.push(resolve(filePath));

  const { stdout } = await runCommand(walrusCliPath(), args, {
    maxBuffer: 20 * 1024 * 1024,
  });
  const result = parseJsonOutput(stdout);
  const blobId = findFirstByKey(result, [
    "blobId",
    "blob_id",
    "encodedBlobId",
    "encoded_blob_id",
  ]);

  if (!blobId) {
    throw new Error(
      `Walrus upload did not return a blob id. Raw output: ${JSON.stringify(result).slice(0, 2000)}`,
    );
  }

  return {
    result,
    blobId,
    suiObjectId: findWalrusObjectId(result),
  };
}

export async function readWalrusBlobToFile({ blobId, outPath }) {
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  const args = ["read", "--out", resolve(outPath)];
  if (process.env.WALRUS_CONTEXT) {
    args.push("--context", process.env.WALRUS_CONTEXT);
  }
  if (process.env.WALRUS_CONFIG_PATH) {
    args.push("--config", process.env.WALRUS_CONFIG_PATH);
  }
  args.push(blobId);
  await runCommand(walrusCliPath(), args, { maxBuffer: 20 * 1024 * 1024 });
  return resolve(outPath);
}

export async function readWalrusBlobBytes({
  blobId,
  runtimeDir = defaultRuntimeDir,
  fileName = `${safePathName(blobId)}.platform-encryption.json`,
}) {
  const outPath = join(runtimeDir, fileName);
  await readWalrusBlobToFile({ blobId, outPath });
  const bytes = await readFile(outPath);
  return {
    bytes,
    outPath: resolve(outPath),
    digest: `sha256:${sha256Hex(bytes)}`,
    sizeBytes: bytes.length,
  };
}

export function findFirstByKey(value, keys) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstByKey(item, keys);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key) && typeof child === "string" && child) {
      return child;
    }
  }

  for (const child of Object.values(value)) {
    const found = findFirstByKey(child, keys);
    if (found) return found;
  }

  return null;
}

export function findWalrusObjectId(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWalrusObjectId(item);
      if (found) return found;
    }
    return null;
  }

  for (const key of [
    "suiObjectId",
    "sui_object_id",
    "objectId",
    "object_id",
    "storageObjectId",
  ]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.startsWith("0x")) {
      return candidate;
    }
  }

  if (value.blobObject?.id && String(value.blobObject.id).startsWith("0x")) {
    return value.blobObject.id;
  }

  for (const child of Object.values(value)) {
    const found = findWalrusObjectId(child);
    if (found) return found;
  }

  return null;
}

function runCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    ...options,
    maxBuffer: options.maxBuffer || 5 * 1024 * 1024,
  }).catch((err) => {
    const stderr = err.stderr ? String(err.stderr).trim() : "";
    const stdout = err.stdout ? String(err.stdout).trim() : "";
    const detail = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  });
}

function parseJsonOutput(stdout) {
  const trimmed = String(stdout || "").trim();
  if (!trimmed) {
    throw new Error("Walrus CLI returned empty stdout");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const firstBracket = trimmed.indexOf("[");
    const start = [firstBrace, firstBracket]
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];
    if (start === undefined) {
      throw new Error(`Walrus CLI did not return JSON: ${trimmed.slice(0, 500)}`);
    }
    return JSON.parse(trimmed.slice(start));
  }
}

function walrusCliPath() {
  return process.env.WALRUS_CLI_PATH || "walrus";
}

function safePathName(value) {
  return basename(String(value || "blob").replace(/[^a-zA-Z0-9._-]+/g, "_"));
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function loadEnvFile(filename) {
  try {
    const file = readFileSync(resolve(process.cwd(), filename), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Missing env files are fine.
  }
}
