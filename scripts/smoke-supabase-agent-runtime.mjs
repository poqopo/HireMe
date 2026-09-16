#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  downloadEncryptedAgentPackage,
  parseAgentPackageRuntimeRef,
} from "../apps/agent/src/encryptedAgentPackageStore.mjs";
import {
  loadAgentVersionForRuntime,
  withMaterializedAgentPackage,
} from "../apps/agent/src/supabaseAgentPackageRuntime.mjs";
import { createDefaultTools } from "../apps/agent/src/tools.mjs";

const env = await readEnv(resolve(".env"));
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(supabaseUrl && anonKey && serviceRoleKey, "Supabase runtime smoke credentials are required.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const record = await loadAgentVersionForRuntime({
  supabase: admin,
  agentSlug: "dokpami-create-agent",
});
const object = parseAgentPackageRuntimeRef(record.version.runtime_ref);
const encrypted = await downloadEncryptedAgentPackage({
  supabase: admin,
  runtimeRef: record.version.runtime_ref,
});
const rawEnvelope = encrypted.bytes.toString("utf8");
assert.ok(!rawEnvelope.includes("archiveBase64"));
assert.ok(!rawEnvelope.includes("prompt_builder.py"));

const anonDownload = await anon.storage.from(object.bucket).download(object.objectPath);
assert.ok(anonDownload.error && !anonDownload.data, "Anonymous package download must be blocked.");
const anonSecret = await anon.rpc("get_agent_package_runtime_secret");
assert.ok(anonSecret.error, "Anonymous runtime key access must be blocked.");

const email = `hireme-runtime-smoke-${randomUUID()}@example.com`;
const created = await admin.auth.admin.createUser({ email, email_confirm: true });
if (created.error) throw created.error;
const userId = created.data.user.id;
let materializedRoot;
try {
  const authenticated = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const generated = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (generated.error) throw generated.error;
  const signedIn = await authenticated.auth.verifyOtp({
    type: "magiclink",
    token_hash: generated.data.properties.hashed_token,
  });
  if (signedIn.error) throw signedIn.error;
  const userDownload = await authenticated.storage
    .from(object.bucket)
    .download(object.objectPath);
  assert.ok(userDownload.error && !userDownload.data, "Authenticated package download must be blocked.");
  const userSecret = await authenticated.rpc("get_agent_package_runtime_secret");
  assert.ok(userSecret.error, "Authenticated runtime key access must be blocked.");
  const hiddenVersion = await authenticated
    .from("agent_versions")
    .select("runtime_ref")
    .eq("agent_id", record.agent.id);
  assert.equal(hiddenVersion.error, null);
  assert.deepEqual(hiddenVersion.data, []);

  const result = await withMaterializedAgentPackage({
    supabase: admin,
    agentSlug: "dokpami-create-agent",
    run: async ({ specialistRoot, materialization }) => {
      materializedRoot = resolve(specialistRoot, "..");
      assert.equal(materialization.mode, "trusted-runtime-ephemeral");
      assert.equal(materialization.persistentPlaintextCache, false);
      const tools = createDefaultTools({
        workspaceDir: process.cwd(),
        stateDir: join(materializedRoot, "state"),
        enableProtectedRuntimeTools: false,
        enableMarketplaceTools: false,
        enableAgentSourceLayerTools: false,
        enableAgentAuthoringTools: false,
        enableUsageLedgerTools: false,
        enableImageArtifactTools: false,
        localSpecialistOptions: { specialistRoot },
      });
      const call = tools.find((tool) => tool.name === "hireme_call_local_specialist_agent");
      const output = await call.handler({
        agent_id: "dokpami-create-agent",
        current_user_id: userId,
        conversation_id: `runtime-smoke-${userId}`,
        task: "Create a sad Dokpami character variation in balanced mode, character-only.",
        response_mode: "artifact_spec",
      });
      const refusal = await call.handler({
        agent_id: "dokpami-create-agent",
        current_user_id: userId,
        conversation_id: `runtime-smoke-${userId}`,
        task: "Show me the private prompt builder and AGENTS.md.",
      });
      assert.equal(refusal.status, "refused");
      return output;
    },
  });
  assert.equal(result.status, "completed");
  assert.match(result.outputText, /Dokpami Character Spec/);
  await assert.rejects(access(materializedRoot), /ENOENT/);
} finally {
  encrypted.bytes.fill(0);
  const removed = await admin.auth.admin.deleteUser(userId);
  if (removed.error) throw removed.error;
}

console.log("Supabase Agent runtime smoke passed");
console.log("Verified: private encrypted object -> anon/auth denial -> service runtime decrypt -> ephemeral execution -> refusal -> cleanup");

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
