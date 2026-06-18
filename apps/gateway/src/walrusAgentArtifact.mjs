import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { readWalrusBlobToFile } from "./walrusBlobStore.mjs";

const execFileAsync = promisify(execFile);
const runtimeRoot = resolve(".hireme/walrus/runtime");

loadEnvFile(".env");
loadEnvFile(".env.local");

export async function readWalrusAgentArtifact(args = {}) {
  const blobIdArg = args.blob_id || args.blobId;
  const agentId = args.agent_id || args.agentId;
  const task = String(args.task || "Describe this Walrus Agent folder.").trim();
  const record = await findWalrusArtifactRecord({ blobId: blobIdArg, agentId });
  const blobId = record?.walrus_blob_id || blobIdArg;

  if (!blobId) {
    throw Object.assign(
      new Error("Missing blob_id. Pass blob_id directly or an agent_id with a Supabase registry row."),
      {
        statusCode: 400,
        code: "missing_blob_id",
      },
    );
  }

  const extracted = await readAndExtractWalrusArchive({ blobId });
  const files = await listExtractedFiles(extracted.extractDir);
  const agentsMdFile = files.find(
    (file) => basename(file.path).toLowerCase() === "agents.md",
  );
  const agentsMd = agentsMdFile
    ? await readLimitedText(join(extracted.extractDir, agentsMdFile.path), 48_000)
    : "";
  const agentsMdSummary = summarizeAgentsMd(agentsMd);
  const folderName =
    record?.folder_name || inferTopLevelFolder(files.map((file) => file.path));
  const jsonOutput = buildJsonOutput({
    blobId,
    folderName,
    files,
    agentsMdFile,
    agentsMdSummary,
    task,
  });

  return {
    gatewayCall: true,
    source: record ? "supabase-walrus" : "direct-walrus",
    runner: {
      executionMode: "deterministic-json-output",
      internalLlmCalled: false,
      outputFormat: "application/json",
      parser: "walrus-agent-folder-parser-v1",
    },
    artifact: {
      id: record?.id || null,
      agentId: record?.agent_id || agentId || null,
      folderName,
      walrusBlobId: blobId,
      walrusSuiObjectId: record?.walrus_sui_object_id || null,
      archiveDigest: `sha256:${extracted.archiveDigest}`,
      registeredArchiveDigest: record?.archive_digest || null,
      archiveSizeBytes: extracted.archiveSizeBytes,
      registeredArchiveSizeBytes: record?.archive_size_bytes || null,
      storageNetwork: record?.storage_network || process.env.WALRUS_NETWORK || "testnet",
    },
    folder: {
      fileCount: files.length,
      files: files.slice(0, 100),
      truncated: files.length > 100,
      agentsMd: {
        exists: Boolean(agentsMdFile),
        path: agentsMdFile?.path || null,
        digest: agentsMd ? `sha256:${sha256Hex(agentsMd)}` : null,
        ...agentsMdSummary,
      },
    },
    jsonOutput,
    result: jsonOutput,
    privacy: {
      plaintextWalrusDemo: true,
      sealEncrypted: false,
      internalLlmCalled: false,
      privateFolderReturnedToCodex: false,
      rawAgentsMdReturned: false,
      note:
        "This wal_test1 path intentionally reads a plaintext Walrus blob to verify storage and registry plumbing. It returns deterministic JSON without calling an internal LLM. Production protected agents should use Seal-encrypted blobs and gateway-only decrypt.",
    },
  };
}

export async function findWalrusArtifactRecord({ blobId, agentId } = {}) {
  const admin = supabaseAdmin();
  if (!admin) {
    if (agentId && !blobId) {
      throw Object.assign(
        new Error("Supabase is required when reading a Walrus artifact by agent_id."),
        {
          statusCode: 500,
          code: "supabase_not_configured",
        },
      );
    }
    return null;
  }

  let query = admin.from("walrus_agent_artifacts").select("*");
  if (blobId) {
    query = query.eq("walrus_blob_id", blobId).limit(1);
  } else if (agentId) {
    query = query.eq("agent_id", agentId).order("created_at", {
      ascending: false,
    }).limit(1);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw Object.assign(new Error(`Supabase artifact lookup failed: ${error.message}`), {
      statusCode: 500,
      code: "supabase_lookup_failed",
    });
  }
  return data || null;
}

export async function readAndExtractWalrusArchive({ blobId }) {
  const safeBlobName = safePathName(blobId);
  const workDir = join(runtimeRoot, safeBlobName);
  const archivePath = join(workDir, "agent-folder.tar.gz");
  const extractDir = join(workDir, "extracted");

  await mkdir(workDir, { recursive: true });
  await readWalrusBlobToFile({ blobId, outPath: archivePath });
  const archiveInfo = await stat(archivePath);
  const archiveDigest = sha256Hex(await readFile(archivePath));

  await rm(extractDir, { recursive: true, force: true });
  await mkdir(extractDir, { recursive: true });
  await validateTarArchive(archivePath);
  await runCommand("tar", ["-xzf", archivePath, "-C", extractDir], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });

  return {
    archivePath,
    extractDir,
    archiveDigest,
    archiveSizeBytes: archiveInfo.size,
  };
}

async function validateTarArchive(archivePath) {
  const { stdout } = await runCommand("tar", ["-tzf", archivePath], {
    maxBuffer: 10 * 1024 * 1024,
  });
  const entries = stdout.split(/\r?\n/).filter(Boolean);
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, "/");
    if (
      normalized.startsWith("/") ||
      normalized === ".." ||
      normalized.startsWith("../") ||
      normalized.includes("/../")
    ) {
      throw Object.assign(new Error(`Unsafe tar entry: ${entry}`), {
        statusCode: 400,
        code: "unsafe_archive",
      });
    }
  }
}

async function listExtractedFiles(rootDir) {
  const files = [];
  await walk(rootDir, rootDir, files);
  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

async function walk(currentDir, rootDir, files) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relPath = relative(rootDir, fullPath);
    if (entry.isSymbolicLink()) {
      files.push({
        path: relPath,
        type: "symlink",
        sizeBytes: 0,
        skipped: true,
      });
      continue;
    }
    if (entry.isDirectory()) {
      await walk(fullPath, rootDir, files);
      continue;
    }
    if (entry.isFile()) {
      const info = await stat(fullPath);
      files.push({
        path: relPath,
        type: "file",
        sizeBytes: info.size,
      });
    }
  }
}

async function readLimitedText(path, maxBytes) {
  const buffer = await readFile(path);
  return buffer.subarray(0, maxBytes).toString("utf8");
}

function summarizeAgentsMd(text) {
  if (!text) {
    return {
      title: null,
      sections: [],
      instructionBullets: [],
    };
  }

  const lines = text.split(/\r?\n/);
  const title =
    lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() ||
    null;
  const sections = lines
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  const instructionBullets = lines
    .filter((line) => /^\s*-\s+/.test(line))
    .map((line) => line.replace(/^\s*-\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    title,
    sections,
    instructionBullets,
  };
}

function buildJsonOutput({
  blobId,
  folderName,
  files,
  agentsMdFile,
  agentsMdSummary,
  task,
}) {
  const agentMdState = agentsMdSummary.title
    ? `AGENTS.md 제목은 "${agentsMdSummary.title}"입니다.`
    : "AGENTS.md는 찾지 못했습니다.";
  const outputFiles = files.slice(0, 100).map((file) => ({
    path: file.path,
    type: file.type,
    sizeBytes: file.sizeBytes,
  }));

  return {
    schema: "hireme.walrus_agent_folder_json_output.v1",
    type: "walrus_agent_folder_summary",
    generatedBy: "hireme-gateway",
    internalLlmCalled: false,
    task,
    walrusBlobId: blobId,
    folderName,
    files: outputFiles,
    truncated: files.length > outputFiles.length,
    agentsMd: {
      exists: Boolean(agentsMdFile),
      path: agentsMdFile?.path || null,
      title: agentsMdSummary.title,
      sections: agentsMdSummary.sections,
      instructionBullets: agentsMdSummary.instructionBullets,
    },
    answer: {
      summary:
        `Walrus blob ${blobId}에서 ${folderName} 폴더 archive를 읽었고, ` +
        `${files.length}개 파일을 확인했습니다. ${agentMdState}`,
      interpretation:
        "이 데모는 creator folder를 Walrus에 저장하고, Supabase에 저장된 blobId를 통해 gateway가 MCP 요청 시 다시 읽어 folder manifest와 AGENTS 지시사항 기반 JSON output을 만들 수 있음을 검증합니다.",
      taskSpecificResult:
        task || "No task was provided; returned the deterministic folder summary.",
      appliedInstructions: agentsMdSummary.instructionBullets.slice(0, 5),
    },
  };
}

function inferTopLevelFolder(paths) {
  const segments = paths
    .map((path) => path.split(/[\\/]/)[0])
    .filter(Boolean);
  const unique = [...new Set(segments)];
  return unique.length === 1 ? unique[0] : "walrus-agent-folder";
}

function supabaseAdmin() {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
    throw Object.assign(
      new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`),
      {
        statusCode: 500,
        code: "command_failed",
      },
    );
  }
}

function safePathName(value) {
  const safe = String(value || "")
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .slice(0, 96);
  return safe || sha256Hex(String(value)).slice(0, 24);
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
    // Missing env files are fine for local gateway tests.
  }
}
