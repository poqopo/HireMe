#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const workspace = process.cwd();
const required = process.argv.includes("--required");
const values = {
  ...(await readEnvFile(resolve(workspace, "renderer/.env"))),
  ...(await readEnvFile(resolve(workspace, ".env"))),
  ...process.env,
};
const supabaseUrl = first(values.HIREME_SUPABASE_URL, values.VITE_SUPABASE_URL);
const supabaseAnonKey = first(
  values.HIREME_SUPABASE_ANON_KEY,
  values.VITE_SUPABASE_ANON_KEY,
);
const projectRef = first(values.SUPABASE_PROJECT_REF, projectRefFromUrl(supabaseUrl));
const configured = Boolean(supabaseUrl && supabaseAnonKey);

if (required && !configured) {
  throw new Error(
    "Desktop auth config is required. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
}

if (supabaseUrl && !isValidSupabaseUrl(supabaseUrl)) {
  throw new Error("VITE_SUPABASE_URL must be a valid HTTPS URL.");
}

const target = resolve(workspace, "electron/public-config.json");
const temp = `${target}.${process.pid}.tmp`;
await mkdir(dirname(target), { recursive: true });
await writeFile(temp, `${JSON.stringify({
  schema: "hireme.desktop.public_config.v1",
  supabase: {
    configured,
    url: supabaseUrl || null,
    anonKey: supabaseAnonKey || null,
    projectRef: projectRef || null,
  },
}, null, 2)}\n`, "utf8");
await rename(temp, target);

console.log(`Desktop public config: ${configured ? "configured" : "not configured"}`);
if (projectRef) console.log(`Supabase project: ${projectRef}`);

async function readEnvFile(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    result[match[1]] = unquote(match[2]);
  }
  return result;
}

function unquote(value) {
  const text = String(value || "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function first(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function projectRefFromUrl(value) {
  try {
    return new URL(value).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function isValidSupabaseUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
