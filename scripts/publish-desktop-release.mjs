#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "desktop-releases";
const options = parseArgs(process.argv.slice(2));
const env = await readEnv(resolve(options.env || ".env"));
const supabaseUrl = env.VITE_SUPABASE_URL || env.HIREME_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("VITE_SUPABASE_URL (or HIREME_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const version = requireVersion(options.version);
const platform = options.platform || "macos";
const arch = options.arch || "arm64";
const artifactPath = resolve(options.file || `release/HireMe-${version}-mac-${arch}.dmg`);
const artifact = await readFile(artifactPath);
const extension = extensionFor(artifactPath);
const mimeType = mimeTypeFor(extension);
const objectPath = `${platform}/${arch}/v${version}/${basename(artifactPath)}`;
const sha256 = createHash("sha256").update(artifact).digest("hex");
const expiresIn = parseExpiresIn(options.expiresIn);
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const upload = await supabase.storage.from(BUCKET).upload(objectPath, artifact, {
  contentType: mimeType,
  upsert: Boolean(options.overwrite),
  cacheControl: "31536000",
  metadata: {
    version,
    platform,
    arch,
    sha256,
  },
});
if (upload.error) {
  if (upload.error.statusCode === "413") {
    throw new Error(
      `The ${formatBytes(artifact.byteLength)} artifact exceeds this Supabase project's Storage plan limit. `
      + "Upgrade the project Storage limit or publish desktop installers to an external release bucket (for example Cloudflare R2 or S3).",
    );
  }
  throw upload.error;
}

const signed = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, expiresIn, {
  download: basename(artifactPath),
});
if (signed.error) throw signed.error;

console.log(JSON.stringify({
  status: "published",
  bucket: BUCKET,
  objectPath,
  file: basename(artifactPath),
  bytes: artifact.byteLength,
  sha256: `sha256:${sha256}`,
  expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  downloadUrl: signed.data.signedUrl,
}, null, 2));

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_match, value) => value.toUpperCase());
    const next = args[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function requireVersion(value) {
  if (!value || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)) {
    throw new Error("Usage: npm run desktop:release:publish -- --version <semver> [--file <dmg>] [--expires-in <seconds>] [--overwrite]");
  }
  return value;
}

function extensionFor(path) {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (![".dmg", ".zip"].includes(extension)) throw new Error("Only .dmg and .zip desktop artifacts can be published.");
  return extension;
}

function mimeTypeFor(extension) {
  return extension === ".dmg" ? "application/x-apple-diskimage" : "application/zip";
}

function parseExpiresIn(value) {
  if (value === undefined) return 60 * 60 * 24 * 7;
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 60 || seconds > 60 * 60 * 24 * 7) {
    throw new Error("--expires-in must be between 60 seconds and 7 days.");
  }
  return seconds;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function readEnv(path) {
  const text = await readFile(path, "utf8");
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}
