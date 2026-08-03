import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  decryptAgentPackage,
  downloadEncryptedAgentPackage,
  encryptAgentPackage,
  readAgentPackageRuntimeSecret,
  uploadEncryptedAgentPackage,
} from "./encryptedAgentPackageStore.mjs";
import {
  exportLocalSpecialistAgentPackage,
  importLocalSpecialistAgentPackage,
} from "./localSpecialistCreatorTools.mjs";
import { publicExecutionPolicy } from "./executionPolicy.mjs";

export async function publishLocalAgentPackage({
  supabase,
  specialistRoot,
  workspaceRoot = process.cwd(),
  agentId,
  creatorId,
  versionNumber = 1,
  releaseNotes = "",
  packageMode = "hosted_secure",
} = {}) {
  requireRuntimeClient(supabase);
  const root = resolve(specialistRoot || "examples/local-specialist-agents");
  const id = requireAgentId(agentId);
  const ownerId = requireUuid(creatorId, "creatorId");
  const version = requirePositiveInteger(versionNumber, "versionNumber");
  await assertVersionIsPublishable({
    supabase,
    agentId: id,
    creatorId: ownerId,
    versionNumber: version,
  });
  const tempRoot = await mkdtemp(join(tmpdir(), "hireme-agent-publish-"));
  let packageBytes;
  let uploaded;
  let versionRecord;
  let published = false;
  try {
    const exported = await exportLocalSpecialistAgentPackage({
      root,
      workspaceRoot: tempRoot,
      agent_id: id,
      output_path: "package.hireme-agent.json",
      package_mode: packageMode,
      creator_id: ownerId,
      current_user_id: ownerId,
      overwrite: true,
    });
    packageBytes = await readFile(join(tempRoot, "package.hireme-agent.json"));
    const packageDocument = JSON.parse(packageBytes.toString("utf8"));
    const publicProfile = packageDocument.publicProfile || {};
    const masterSecret = await readAgentPackageRuntimeSecret(supabase);
    const encrypted = encryptAgentPackage({
      packageBytes,
      masterSecret,
      agentId: id,
      agentVersion: String(packageDocument.agent?.version || version),
    });
    const digestSuffix = encrypted.ciphertextDigest.replace(/^sha256:/, "");
    const objectPath = `${ownerId}/${id}/v${version}/${digestSuffix}.hireme-agent.enc.json`;
    uploaded = await uploadEncryptedAgentPackage({
      supabase,
      objectPath,
      envelopeBytes: encrypted.bytes,
      overwrite: true,
    });
    const agent = await upsertAgentMetadata({
      supabase,
      creatorId: ownerId,
      agentId: id,
      packageDocument,
    });
    versionRecord = await insertAgentVersion({
      supabase,
      agentDatabaseId: agent.id,
      versionNumber: version,
      releaseNotes,
      packageDocument,
      exported,
      encrypted,
      runtimeRef: uploaded.runtimeRef,
    });
    const current = await supabase
      .from("agents")
      .update({ current_version: version })
      .eq("id", agent.id)
      .eq("creator_id", ownerId)
      .select("id, slug, current_version")
      .single();
    if (current.error) throw new Error(`Agent current version update failed: ${current.error.message}`);
    published = true;
    return {
      agent: { id: agent.id, slug: agent.slug, creatorId: ownerId },
      version: { id: versionRecord.id, number: version },
      packageDigest: encrypted.packageDigest,
      ciphertextDigest: encrypted.ciphertextDigest,
      packageSizeBytes: encrypted.sizeBytes,
      runtimeRef: uploaded.runtimeRef,
      storage: { bucket: uploaded.bucket, path: uploaded.path },
    };
  } finally {
    if (!published && versionRecord?.id) {
      try {
        await supabase.from("agent_versions").delete().eq("id", versionRecord.id);
      } catch {
        // Best-effort compensation for a failed cross-service publication.
      }
    }
    if (!published && uploaded?.bucket && uploaded?.path) {
      try {
        await supabase.storage.from(uploaded.bucket).remove([uploaded.path]);
      } catch {
        // The encrypted orphan can be removed by a later storage reconciliation job.
      }
    }
    packageBytes?.fill(0);
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function withMaterializedAgentPackage({
  supabase,
  agentSlug,
  versionNumber,
  userId,
  run,
} = {}) {
  requireRuntimeClient(supabase);
  if (typeof run !== "function") throw new Error("Trusted runtime callback is required.");
  const record = await loadAgentVersionForRuntime({ supabase, agentSlug, versionNumber });
  const access = await assertRuntimeAccess({ supabase, userId, agent: record.agent });
  if (access.consumeRun) await consumeRuntimeEntitlement({ supabase, userId, agentId: record.agent.id });
  const downloaded = await downloadEncryptedAgentPackage({
    supabase,
    runtimeRef: record.version.runtime_ref,
  });
  if (
    record.version.package_size_bytes !== null &&
    Number(record.version.package_size_bytes) !== downloaded.bytes.length
  ) {
    downloaded.bytes.fill(0);
    throw new Error("Stored Agent package size does not match the registry record.");
  }
  const masterSecret = await readAgentPackageRuntimeSecret(supabase);
  const decrypted = decryptAgentPackage({
    envelopeBytes: downloaded.bytes,
    masterSecret,
  });
  if (
    decrypted.packageDigest !== record.version.package_digest ||
    decrypted.ciphertextDigest !== record.version.package_ciphertext_digest
  ) {
    downloaded.bytes.fill(0);
    decrypted.bytes.fill(0);
    throw new Error("Stored Agent package digest does not match the registry record.");
  }

  const runtimeRoot = await mkdtemp(join(tmpdir(), "hireme-trusted-agent-runtime-"));
  const specialistRoot = join(runtimeRoot, "agents");
  await mkdir(specialistRoot, { recursive: true });
  try {
    const imported = await importLocalSpecialistAgentPackage({
      root: specialistRoot,
      workspaceRoot: runtimeRoot,
      package: decrypted.package,
      current_user_id: decrypted.package.ownership?.creatorId,
      materialization_context: decrypted.package.packageMode === "hosted_secure"
        ? "trusted_runtime"
        : "creator_local",
      overwrite: false,
    });
    return await run({
      agent: publicRuntimeAgent(record.agent),
      version: {
        number: record.version.version_number,
        packageDigest: record.version.package_digest,
      },
      agentId: record.agent.slug,
      agentRoot: join(specialistRoot, record.agent.slug),
      specialistRoot,
      materialization: {
        mode: "trusted-runtime-ephemeral",
        persistentPlaintextCache: false,
        importedFileCount: imported.fileCount,
      },
    });
  } finally {
    downloaded.bytes.fill(0);
    decrypted.bytes.fill(0);
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function loadAgentVersionForRuntime({
  supabase,
  agentSlug,
  versionNumber,
} = {}) {
  requireRuntimeClient(supabase);
  const slug = requireAgentId(agentSlug);
  const agentResult = await supabase
    .from("agents")
    .select("id, creator_id, slug, name, category, status, visibility, current_version")
    .eq("slug", slug)
    .single();
  if (agentResult.error) throw new Error(`Runtime Agent lookup failed: ${agentResult.error.message}`);
  if (agentResult.data.status !== "published" || agentResult.data.visibility !== "public") {
    throw new Error("Agent is not approved for trusted runtime execution.");
  }
  const selectedVersion = versionNumber ?? agentResult.data.current_version;
  const version = requirePositiveInteger(selectedVersion, "versionNumber");
  const versionResult = await supabase
    .from("agent_versions")
    .select(
      "id, agent_id, version_number, package_digest, package_ciphertext_digest, package_size_bytes, package_encryption, runtime_ref, review_status",
    )
    .eq("agent_id", agentResult.data.id)
    .eq("version_number", version)
    .single();
  if (versionResult.error) {
    throw new Error(`Runtime Agent version lookup failed: ${versionResult.error.message}`);
  }
  if (!versionResult.data.package_ciphertext_digest) {
    throw new Error("Runtime Agent version is missing encrypted package metadata.");
  }
  if (versionResult.data.review_status !== "approved") {
    throw new Error("Agent version is not approved for trusted runtime execution.");
  }
  return { agent: agentResult.data, version: versionResult.data };
}

async function assertRuntimeAccess({ supabase, userId, agent }) {
  const normalizedUserId = requireUuid(userId, "userId");
  if (agent.creator_id === normalizedUserId) return { consumeRun: false };
  const access = await supabase
    .from("agent_access")
    .select("status, remaining_runs")
    .eq("user_id", normalizedUserId)
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (access.error) throw new Error(`Runtime Agent access lookup failed: ${access.error.message}`);
  if (!access.data || access.data.status !== "active") {
    throw new Error("An active Agent entitlement is required.");
  }
  if (access.data.remaining_runs !== null && Number(access.data.remaining_runs) <= 0) {
    throw new Error("No Agent runs remain for this entitlement.");
  }
  return { consumeRun: access.data.remaining_runs !== null };
}

async function consumeRuntimeEntitlement({ supabase, userId, agentId }) {
  const result = await supabase.rpc("consume_agent_run_entitlement", {
    target_user_id: requireUuid(userId, "userId"),
    target_agent_id: requireUuid(agentId, "agentId"),
  });
  if (result.error) throw new Error(`Runtime Agent entitlement consumption failed: ${result.error.message}`);
}

async function upsertAgentMetadata({ supabase, creatorId, agentId, packageDocument }) {
  const existing = await supabase
    .from("agents")
    .select("id, creator_id, slug")
    .eq("slug", agentId)
    .maybeSingle();
  if (existing.error) throw new Error(`Agent lookup failed: ${existing.error.message}`);
  if (existing.data && existing.data.creator_id !== creatorId) {
    throw new Error("Agent slug is already owned by another creator.");
  }
  const profile = packageDocument.publicProfile || {};
  const pricing = normalizePricing(profile.pricing);
  const metadata = {
    creator_id: creatorId,
    slug: agentId,
    name: String(profile.name || packageDocument.agent?.name || agentId).slice(0, 120),
    category: normalizeCategory(profile.category || packageDocument.agent?.category),
    status: "published",
    visibility: "public",
    headline: String(profile.headline || "").slice(0, 240),
    public_summary: String(profile.public_summary || "").slice(0, 4000),
    public_skills: normalizeStringList(profile.skills, 20, 120),
    result_types: normalizeResultTypes(packageDocument.manifest?.finalizers),
    pricing,
  };
  const query = existing.data
    ? supabase.from("agents").update(metadata).eq("id", existing.data.id)
    : supabase.from("agents").insert(metadata);
  const result = await query
    .select(
      "id, creator_id, slug, name, category, status, visibility, headline, public_summary, public_skills, result_types, pricing",
    )
    .single();
  if (result.error) throw new Error(`Agent metadata publish failed: ${result.error.message}`);
  return result.data;
}

async function insertAgentVersion({
  supabase,
  agentDatabaseId,
  versionNumber,
  releaseNotes,
  packageDocument,
  exported,
  encrypted,
  runtimeRef,
}) {
  const result = await supabase
    .from("agent_versions")
    .insert({
      agent_id: agentDatabaseId,
      version_number: versionNumber,
      release_notes: String(releaseNotes || "").slice(0, 4000),
      manifest: sanitizeManifest(packageDocument.manifest),
      package_digest: exported.digest,
      package_ciphertext_digest: encrypted.ciphertextDigest,
      package_size_bytes: encrypted.sizeBytes,
      package_encryption: encrypted.encryption,
      runtime_ref: runtimeRef,
      published_at: new Date().toISOString(),
    })
    .select("id, agent_id, version_number")
    .single();
  if (result.error) throw new Error(`Agent version publish failed: ${result.error.message}`);
  return result.data;
}

async function assertVersionIsPublishable({
  supabase,
  agentId,
  creatorId,
  versionNumber,
}) {
  const agentResult = await supabase
    .from("agents")
    .select("id, creator_id")
    .eq("slug", agentId)
    .maybeSingle();
  if (agentResult.error) throw new Error(`Agent publish preflight failed: ${agentResult.error.message}`);
  if (!agentResult.data) return;
  if (agentResult.data.creator_id !== creatorId) {
    throw new Error("Agent slug is already owned by another creator.");
  }
  const versionResult = await supabase
    .from("agent_versions")
    .select("id")
    .eq("agent_id", agentResult.data.id)
    .eq("version_number", versionNumber)
    .maybeSingle();
  if (versionResult.error) {
    throw new Error(`Agent version preflight failed: ${versionResult.error.message}`);
  }
  if (versionResult.data) {
    throw new Error(
      `Agent version ${versionNumber} is already published. Publish a new version number instead.`,
    );
  }
}

function sanitizeManifest(value) {
  const manifest = value && typeof value === "object" ? value : {};
  return {
    schema: String(manifest.schema || "hireme.local_specialist.manifest.v1"),
    capabilities: normalizeStringList(manifest.capabilities, 40, 120),
    inputModes: normalizeStringList(manifest.inputModes, 20, 80),
    outputModes: normalizeStringList(manifest.outputModes, 20, 80),
    finalizers: normalizeStringList(manifest.finalizers, 20, 80),
    intentTags: normalizeStringList(manifest.intentTags, 40, 80),
    execution: publicExecutionPolicy(manifest.execution),
  };
}

function normalizePricing(value) {
  const run = value?.run || (value?.usage ? { ...value.usage, unit: "run" } : null);
  const subscription = value?.subscription;
  if (run && subscription) return { mode: "hybrid", run, subscription };
  if (subscription) return { mode: "subscription", subscription };
  if (run) return { mode: "run", run };
  return { mode: "free" };
}

function normalizeResultTypes(finalizers) {
  const values = normalizeStringList(finalizers, 10, 40).filter((value) =>
    ["text", "image", "file"].includes(value),
  );
  return values.length ? values : ["text"];
}

function normalizeStringList(value, maxItems, maxLength) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim().slice(0, maxLength))
      .filter(Boolean),
  )].slice(0, maxItems);
}

function normalizeCategory(value) {
  const category = String(value || "").toLowerCase();
  if (/image|design|character/.test(category)) return "image";
  if (/writing|copy/.test(category)) return "writing";
  if (/business|launch|growth/.test(category)) return "business";
  if (/research|data/.test(category)) return "research";
  if (/productivity/.test(category)) return "productivity";
  return "other";
}

function publicRuntimeAgent(agent) {
  return {
    id: agent.id,
    creatorId: agent.creator_id,
    slug: agent.slug,
    name: agent.name,
    category: agent.category,
    status: agent.status,
    visibility: agent.visibility,
  };
}

function requireRuntimeClient(value) {
  if (!value?.from || !value?.storage?.from || !value?.rpc) {
    throw new Error("Supabase trusted runtime client is required.");
  }
}

function requireAgentId(value) {
  const id = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(id)) throw new Error("agentId is invalid.");
  return id;
}

function requireUuid(value, name) {
  const id = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) {
    throw new Error(`${name} must be a UUID.`);
  }
  return id;
}

function requirePositiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${name} must be positive.`);
  return number;
}
