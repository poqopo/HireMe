import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(".env");
loadEnvFile(".env.local");

const supabaseUrl = requiredEnv("VITE_SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("VITE_SUPABASE_ANON_KEY");

const response = await fetch(
  `${supabaseUrl}/rest/v1/agent_marketplace_cards?select=id&limit=1`,
  {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      prefer: "count=exact",
    },
  },
);

if (!response.ok) {
  throw new Error(
    `Supabase smoke failed: ${response.status} ${await response.text()}`,
  );
}

await response.json();

console.log(
  `Supabase smoke passed: agent_marketplace_cards reachable (${rowCount(response)} rows).`,
);

function rowCount(response) {
  const contentRange = response.headers.get("content-range") || "";
  return contentRange.split("/").at(-1) || "unknown";
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
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
    // Missing env files are fine; requiredEnv reports the actionable error.
  }
}
