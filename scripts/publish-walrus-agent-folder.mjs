import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  findFirstByKey,
  findWalrusObjectId,
  storeFileOnWalrus,
} from "../apps/gateway/src/walrusBlobStore.mjs";

const execFileAsync = promisify(execFile);

loadEnvFile(".env");
loadEnvFile(".env.local");

const options = parseArgs(process.argv.slice(2));
const folderPath = resolve(options._[0] || "examples/wal_test1");
const folderName = basename(folderPath);
const agentId = options.agentId || options["agent-id"] || folderName.replaceAll("_", "-");
const epochs = Number.parseInt(options.epochs || "1", 10);
const archiveDir = resolve(".hireme/walrus/uploads");
const archivePath = join(archiveDir, `${folderName}.tar.gz`);

if (!Number.isInteger(epochs) || epochs < 1) {
  throw new Error("--epochs must be a positive integer");
}

await assertValidAgentFolder(folderPath);
await mkdir(archiveDir, { recursive: true });
await runCommand(
  "tar",
  ["-czf", archivePath, "-C", dirname(folderPath), folderName],
  { env: { ...process.env, COPYFILE_DISABLE: "1" } },
);

const archive = await readFile(archivePath);
const archiveDigest = `sha256:${sha256Hex(archive)}`;
const archiveSizeBytes = archive.byteLength;
const upload = await storeFileOnWalrus({ filePath: archivePath, epochs });
const blobId = upload.blobId || findFirstByKey(upload, [
  "blobId",
  "blob_id",
  "encodedBlobId",
  "encoded_blob_id",
]);
const suiObjectId = upload.suiObjectId || findWalrusObjectId(upload);

if (!blobId) {
  throw new Error(
    `Walrus upload did not return a blob id. Raw output: ${JSON.stringify(upload).slice(0, 2000)}`,
  );
}

const row = await upsertSupabaseRecord({
  agentId,
  folderName,
  blobId,
  suiObjectId,
  archiveDigest,
  archiveSizeBytes,
  epochs,
  folderPath,
  upload,
});

console.log(
  JSON.stringify(
    {
      status: "published",
      agentId,
      folderName,
      walrusBlobId: blobId,
      walrusSuiObjectId: suiObjectId,
      archivePath,
      archiveDigest,
      archiveSizeBytes,
      supabaseRowId: row.id,
    },
    null,
    2,
  ),
);

async function assertValidAgentFolder(path) {
  const info = await stat(path).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Agent folder does not exist: ${path}`);
  }

  const agentsMd = await stat(join(path, "AGENTS.md")).catch(() => null);
  if (!agentsMd?.isFile()) {
    throw new Error(`Agent folder must contain AGENTS.md: ${path}`);
  }

  const entries = await readdir(path);
  if (entries.length === 0) {
    throw new Error(`Agent folder is empty: ${path}`);
  }
}

async function upsertSupabaseRecord({
  agentId,
  folderName,
  blobId,
  suiObjectId,
  archiveDigest,
  archiveSizeBytes,
  epochs,
  folderPath,
  upload,
}) {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await admin
    .from("walrus_agent_artifacts")
    .upsert(
      {
        agent_id: agentId,
        folder_name: folderName,
        walrus_blob_id: blobId,
        walrus_sui_object_id: suiObjectId,
        archive_digest: archiveDigest,
        archive_size_bytes: archiveSizeBytes,
        archive_format: "tar.gz",
        storage_provider: "walrus",
        storage_network: process.env.WALRUS_NETWORK || process.env.WALRUS_CONTEXT || "testnet",
        storage_epochs: epochs,
        source_path: folderPath,
        metadata: {
          uploader: "scripts/publish-walrus-agent-folder.mjs",
          walrusStoreResult: upload,
        },
      },
      { onConflict: "walrus_blob_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return data;
}

async function runCommand(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      ...options,
      maxBuffer: options.maxBuffer || 5 * 1024 * 1024,
    });
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : "";
    const stdout = err.stdout ? String(err.stdout).trim() : "";
    const detail = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
}

function parseArgs(args) {
  const parsed = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
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
    // Missing env files are fine; required values are validated before use.
  }
}
