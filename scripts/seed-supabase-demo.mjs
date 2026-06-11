import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { agents } from "../src/lib/agents.ts";

loadEnvFile(".env");
loadEnvFile(".env.local");

const supabaseUrl = (
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).replace(/\/$/, "");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const creatorIds = new Map();
for (const creator of unique(agents.map((agent) => agent.creator))) {
  const user = await findOrCreateCreatorUser(creator);
  creatorIds.set(creator, user.id);

  await must(
    admin.from("profiles").upsert(
      {
        id: user.id,
        display_name: creator,
        username: slugify(creator),
        avatar_url: null,
      },
      { onConflict: "id" },
    ),
    `upsert profile for ${creator}`,
  );
}

let seededAgents = 0;
for (const agent of agents) {
  const creatorId = creatorIds.get(agent.creator);
  const slug = agent.id;

  const agentRow = await mustSingle(
    admin
      .from("agents")
      .upsert(
        {
          creator_id: creatorId,
          slug,
          name: agent.name,
          handle: agent.handle,
          category: toDbCategory(agent.category),
          status: toDbStatus(agent.status),
          headline: agent.headline,
          public_summary: agent.publicSummary,
          public_skills: agent.skills,
          public_mcp_contract: agent.publicContract,
          accent: agent.accent,
          rating: agent.rating,
          historical_calls: agent.calls,
          median_latency_ms: agent.latencyMs,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single(),
    `upsert agent ${agent.id}`,
  );

  const versionRow = await mustSingle(
    admin
      .from("agent_versions")
      .upsert(
        {
          agent_id: agentRow.id,
          version_number: 1,
          status: "published",
          public_mcp_contract: agent.publicContract,
          release_notes: "Seeded demo Agent version.",
          artifact_manifest: {
            publicSkills: agent.skills,
            protectedAssetClasses: agent.protectedAssets,
          },
          created_by: creatorId,
          published_at: new Date().toISOString(),
        },
        { onConflict: "agent_id,version_number" },
      )
      .select("id")
      .single(),
    `upsert version for ${agent.id}`,
  );

  await must(
    admin
      .from("agents")
      .update({ current_version_id: versionRow.id })
      .eq("id", agentRow.id),
    `set current version for ${agent.id}`,
  );

  await must(
    admin.from("protected_artifacts").upsert(
      {
        agent_id: agentRow.id,
        agent_version_id: versionRow.id,
        kind: "agent_folder",
        network: agent.sealedHarness.network,
        seal_policy_id: agent.sealedHarness.sealPolicyId,
        walrus_blob_id: agent.sealedHarness.walrusBlobId,
        walrus_sui_object_id: agent.sealedHarness.suiObjectId,
        ciphertext_digest: agent.sealedHarness.ciphertextDigest,
        metadata: {
          visibility: agent.sealedHarness.visibility,
          protectedAssetClasses: agent.protectedAssets,
        },
        created_by: creatorId,
      },
      { onConflict: "agent_version_id,kind" },
    ),
    `upsert protected artifact for ${agent.id}`,
  );

  await must(
    admin.from("agent_pricing").delete().eq("agent_id", agentRow.id),
    `clear pricing for ${agent.id}`,
  );

  await must(
    admin.from("agent_pricing").insert({
      agent_id: agentRow.id,
      agent_version_id: versionRow.id,
      price_per_mcp_call_usd: agent.pricePerCallUsd,
      free_calls: agent.freeCalls,
      max_budget_calls: 100,
      active: true,
    }),
    `insert pricing for ${agent.id}`,
  );

  seededAgents += 1;
}

console.log(
  `Supabase demo seed complete: ${seededAgents} agents, ${creatorIds.size} creators.`,
);

async function findOrCreateCreatorUser(creator) {
  const email = `${slugify(creator)}@hireme.demo`;
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: creator },
  });

  if (error) {
    const retryExisting = await findUserByEmail(email);
    if (retryExisting) return retryExisting;
    throw new Error(`create auth user for ${creator}: ${error.message}`);
  }

  return data.user;
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      throw new Error(`list auth users: ${error.message}`);
    }
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function must(builder, label) {
  const { error } = await builder;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

async function mustSingle(builder, label) {
  const { data, error } = await builder;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

function toDbCategory(category) {
  return category.toLowerCase();
}

function toDbStatus(status) {
  if (status === "Available") return "listed";
  if (status === "Private Beta") return "private_beta";
  return "paused";
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(values) {
  return [...new Set(values)];
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
