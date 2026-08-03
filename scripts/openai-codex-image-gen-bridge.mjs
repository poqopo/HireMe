#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";

const schemaVersion = "hireme.codex_image_gen.request.v1";
const defaultModel = "openai/gpt-image-2";

const request = JSON.parse(await readStdin());
if (request.schema !== schemaVersion) {
  throw new Error(`Unexpected schema: ${request.schema || "missing"}`);
}
if (!request.prompt || !request.outputPath) {
  throw new Error("prompt and outputPath are required.");
}

await mkdir(dirname(request.outputPath), { recursive: true });

const model =
  process.env.HIREME_OPENAI_CODEX_IMAGE_MODEL ||
  process.env.HIREME_OPENCLAW_IMAGE_MODEL ||
  request.model ||
  defaultModel;
const timeoutMs = readPositiveInteger(
  process.env.HIREME_OPENAI_CODEX_IMAGE_TIMEOUT_MS ||
    process.env.HIREME_OPENCLAW_IMAGE_TIMEOUT_MS,
  readPositiveInteger(request.timeoutMs, 600_000),
);
const outputFormat = outputFormatFor(request.mimeType, request.outputPath);
const referenceImages = Array.isArray(request.referenceImages)
  ? request.referenceImages
      .map((item) => item?.path)
      .filter(Boolean)
      .slice(0, 5)
  : [];
const mode = referenceImages.length ? "edit" : "generate";
const args = [
  "infer",
  "image",
  mode,
  "--json",
  "--model",
  model,
  "--prompt",
  request.prompt,
  "--output",
  request.outputPath,
  "--output-format",
  outputFormat,
  "--timeout-ms",
  String(timeoutMs),
];

if (request.size) args.push("--size", String(request.size));
const quality =
  process.env.HIREME_OPENAI_CODEX_IMAGE_QUALITY ||
  process.env.HIREME_OPENCLAW_IMAGE_QUALITY;
if (quality) {
  args.push("--quality", quality);
}
const background =
  process.env.HIREME_OPENAI_CODEX_IMAGE_BACKGROUND ||
  process.env.HIREME_OPENCLAW_IMAGE_BACKGROUND;
if (background) {
  args.push("--background", background);
}
for (const path of referenceImages) {
  args.push("--file", path);
}

const command =
  process.env.HIREME_OPENAI_CODEX_IMAGE_COMMAND ||
  process.env.HIREME_OPENCLAW_COMMAND ||
  "openclaw";
const result = await run(command, args, { timeoutMs: timeoutMs + 30_000 });
const openclawResult = parseJsonObjectFromText(result.stdout) || {};
const outputFile = await inspectImageFile(request.outputPath);

process.stdout.write(
  `${JSON.stringify({
    status: "completed",
    provider: "openai",
    model,
    auth: "codex-oauth",
    transport: "openclaw/codex-responses",
    mode,
    path: request.outputPath,
    mimeType: outputFile.mimeType,
    bytes: outputFile.bytes,
    bridge: {
      id: "openclaw",
      command,
    },
    openclaw: {
      ok: openclawResult.ok ?? true,
      capability: openclawResult.capability || `image.${mode}`,
      provider: openclawResult.provider || "openai",
      model: openclawResult.model || model.split("/").at(-1),
      outputs: Array.isArray(openclawResult.outputs)
        ? openclawResult.outputs.map((item) => ({
            path: item.path || null,
            mimeType: item.mimeType || null,
            size: item.size || null,
            width: item.width || null,
            height: item.height || null,
          }))
        : [],
    },
  })}\n`,
);

function readStdin() {
  return new Promise((resolveRead, rejectRead) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolveRead(text));
    process.stdin.on("error", rejectRead);
  });
}

function run(command, args, { timeoutMs }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      rejectRun(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectRun(err);
    });
    child.on("exit", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (exitCode === 0) {
        resolveRun({ stdout, stderr });
        return;
      }
      rejectRun(
        new Error(
          `${command} exited with ${exitCode}: ${[stderr, stdout]
            .filter(Boolean)
            .join("\n")
            .slice(0, 4000)}`,
        ),
      );
    });
  });
}

async function inspectImageFile(path) {
  const [fileStat, bytes] = await Promise.all([stat(path), readFile(path)]);
  if (!fileStat.isFile() || fileStat.size <= 0) {
    throw new Error("Generated image file is empty or not a file.");
  }
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw new Error("Generated file is not a supported image type.");
  }
  return { bytes: fileStat.size, mimeType };
}

function detectImageMimeType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.slice(0, 4).toString("ascii") === "RIFF" &&
    bytes.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "";
}

function outputFormatFor(mimeType, outputPath) {
  const text = String(mimeType || "").toLowerCase();
  const path = String(outputPath || "").toLowerCase();
  if (text === "image/jpeg" || /\.jpe?g$/.test(path)) return "jpeg";
  if (text === "image/webp" || /\.webp$/.test(path)) return "webp";
  return "png";
}

function parseJsonObjectFromText(value) {
  const text = String(value || "").trim();
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") continue;
    const parsed = parseJson(text.slice(index));
    if (parsed && typeof parsed === "object") return parsed;
  }
  return null;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
