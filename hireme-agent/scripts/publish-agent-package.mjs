#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { publishLocalAgentPackage } from "../runtime/src/supabaseAgentPackageRuntime.mjs";

const options = parseArgs(process.argv.slice(2));
const env = await readEnv(resolve(options.env || ".env"));
const supabaseUrl = env.VITE_SUPABASE_URL || env.HIREME_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
if (!options.agent || !options.creatorId) {
  throw new Error("Usage: publish-agent-package --agent <slug> --creator-id <uuid> [--version 1]");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const result = await publishLocalAgentPackage({
  supabase,
  specialistRoot: resolve(options.specialistRoot || "examples/local-specialist-agents"),
  agentId: options.agent,
  creatorId: options.creatorId,
  versionNumber: Number(options.version || 1),
  releaseNotes: options.releaseNotes || "Initial protected package publication.",
});

console.log(JSON.stringify({
  status: "published",
  agent: result.agent,
  version: result.version,
  packageDigest: result.packageDigest,
  ciphertextDigest: result.ciphertextDigest,
  packageSizeBytes: result.packageSizeBytes,
  runtimeRef: result.runtimeRef,
}, null, 2));

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_match, value) => value.toUpperCase());
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

async function readEnv(path) {
  const text = await readFile(path, "utf8");
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}
