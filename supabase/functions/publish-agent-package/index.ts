import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();
const maxPackageBytes = 8 * 1024 * 1024;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const agentIdPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const versionPattern = /^\d+\.\d+\.\d+$/;

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401);

    const url = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const identity = await userClient.auth.getUser();
    if (identity.error || !identity.data.user) return json({ error: "Authentication is required." }, 401);
    const user = identity.data.user;

    const input = await request.json();
    const agentId = requireAgentId(input?.agentId);
    const displayVersion = requireVersion(input?.version);
    const packageBytes = decodeBase64(input?.packageBase64, "packageBase64");
    if (packageBytes.length > maxPackageBytes) return json({ error: "Agent package exceeds the publish size limit." }, 413);
    const packageDocument = parsePackage(packageBytes, agentId);

    const admin = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const published = await publish({ admin, userId: user.id, agentId, displayVersion, packageBytes, packageDocument });
    packageBytes.fill(0);
    return json(published, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Agent package publication failed." }, 400);
  }
});

async function publish({ admin, userId, agentId, displayVersion, packageBytes, packageDocument }) {
  const existingResult = await admin.from("agents")
    .select("id, creator_id, current_version")
    .eq("slug", agentId)
    .maybeSingle();
  if (existingResult.error) throw new Error(`Agent lookup failed: ${existingResult.error.message}`);
  if (existingResult.data && existingResult.data.creator_id !== userId) throw new Error("You do not own this Agent.");

  const preflight = reviewPreflight(packageDocument);
  if (!preflight.passed) {
    throw new Error(`Agent safety preflight failed: ${preflight.blocking.join(" ")}`);
  }
  const metadata = publicMetadata(packageDocument, agentId, userId, existingResult.data);
  const agentResult = existingResult.data
    ? await admin.from("agents").update(metadata).eq("id", existingResult.data.id).select("id, slug").single()
    : await admin.from("agents").insert(metadata).select("id, slug").single();
  if (agentResult.error) throw new Error(`Agent metadata publish failed: ${agentResult.error.message}`);
  const agent = agentResult.data;

  const latestResult = await admin.from("agent_versions")
    .select("version_number")
    .eq("agent_id", agent.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestResult.error) throw new Error(`Agent version lookup failed: ${latestResult.error.message}`);
  const versionNumber = Number(latestResult.data?.version_number || 0) + 1;

  const masterSecret = await admin.rpc("get_agent_package_runtime_secret");
  if (masterSecret.error || typeof masterSecret.data !== "string") throw new Error("Agent package encryption key is unavailable.");
  const packageKey = await deriveLocalPackageKey({
    masterSecret: masterSecret.data,
    agentId,
    agentVersion: displayVersion,
    packageDigest: packageDocument.integrity.packageDigest,
  });
  const encrypted = await encryptPackage({ packageBytes, masterSecret: packageKey, agentId, agentVersion: displayVersion, packageDigest: packageDocument.integrity.packageDigest });
  const objectPath = `${userId}/${agentId}/v${versionNumber}/${encrypted.ciphertextDigest.slice(7)}.hireme-agent.enc.json`;
  const upload = await admin.storage.from("agent-packages").upload(objectPath, encrypted.bytes, {
    contentType: "application/vnd.hireme.encrypted-agent+json",
    cacheControl: "0",
    upsert: false,
  });
  if (upload.error) throw new Error(`Encrypted Agent package upload failed: ${upload.error.message}`);

  const runtimeRef = `supabase-storage://agent-packages/${upload.data.path}`;
  try {
    const versionResult = await admin.from("agent_versions").insert({
      agent_id: agent.id,
      version_number: versionNumber,
      display_version: displayVersion,
      release_notes: "Published from HireMe desktop.",
      manifest: publicManifest(packageDocument.manifest),
      package_digest: packageDocument.integrity.packageDigest,
      package_ciphertext_digest: encrypted.ciphertextDigest,
      package_size_bytes: encrypted.bytes.length,
      package_encryption: { ...encrypted.encryption, executionClass: "local_protected" },
      runtime_ref: runtimeRef,
      review_status: "pending",
      published_at: null,
    }).select("id").single();
    if (versionResult.error) throw new Error(`Agent version publish failed: ${versionResult.error.message}`);
    const reviewResult = await admin.from("agent_version_reviews").insert({
      agent_version_id: versionResult.data.id,
      status: "pending",
      automated_report: preflight,
    });
    if (reviewResult.error) throw new Error(`Agent safety review queue failed: ${reviewResult.error.message}`);
  } catch (error) {
    await admin.storage.from("agent-packages").remove([upload.data.path]).catch(() => {});
    throw error;
  }

  return {
    status: "review_pending",
    agent: { id: agent.id, slug: agent.slug },
    displayVersion,
    versionNumber,
    packageDigest: packageDocument.integrity.packageDigest,
    safetyReview: { status: "pending", report: preflight },
    storage: { bucket: "agent-packages", path: upload.data.path, runtimeRef },
  };
}

async function encryptPackage({ packageBytes, masterSecret, agentId, agentVersion, packageDigest }) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const metadata = {
    schema: "hireme.encrypted_agent_package.v1", encryptionVersion: 1, algorithm: "aes-256-gcm", kdf: "hkdf-sha256",
    keyId: "hireme_agent_package_master_key_v1", agentId, agentVersion, packageDigest,
    payloadDigest: await sha256(packageBytes), createdAt: new Date().toISOString(), salt: toBase64(salt), iv: toBase64(iv),
  };
  const masterKey = await crypto.subtle.importKey("raw", decodeBase64(masterSecret, "masterSecret"), "HKDF", false, ["deriveBits"]);
  const info = encoder.encode(`hireme-agent-package\0${metadata.keyId}\0${agentId}\0${agentVersion}`);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, masterKey, 256);
  const key = await crypto.subtle.importKey("raw", bits, { name: "AES-GCM" }, false, ["encrypt"]);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(stableStringify(metadata)), tagLength: 128 }, key, packageBytes));
  const ciphertext = sealed.slice(0, -16);
  const ciphertextDigest = await sha256(ciphertext);
  const envelope = { ...metadata, ciphertextDigest, authTag: toBase64(sealed.slice(-16)), ciphertext: toBase64(ciphertext) };
  const bytes = encoder.encode(`${stableStringify(envelope)}\n`);
  return { bytes, ciphertextDigest, encryption: { schema: metadata.schema, algorithm: metadata.algorithm, kdf: metadata.kdf, keyId: metadata.keyId, payloadDigest: metadata.payloadDigest } };
}

async function deriveLocalPackageKey({ masterSecret, agentId, agentVersion, packageDigest }) {
  const master = await crypto.subtle.importKey("raw", decodeBase64(masterSecret, "masterSecret"), "HKDF", false, ["deriveBits"]);
  const salt = await crypto.subtle.digest("SHA-256", encoder.encode(agentId));
  const info = encoder.encode(`hireme-local-protected-package\0${agentVersion}\0${packageDigest}`);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, master, 256);
  return toBase64(new Uint8Array(bits));
}

function parsePackage(bytes, agentId) {
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("Agent package is not valid JSON."); }
  if (value?.schema !== "hireme.local_specialist.package.v1" || value?.agent?.id !== agentId || !digestPattern.test(value?.integrity?.packageDigest || "")) {
    throw new Error("Agent package integrity is invalid.");
  }
  return value;
}

function publicMetadata(packageDocument, agentId, userId, existing) {
  const profile = packageDocument.publicProfile || {};
  return {
    creator_id: userId, slug: agentId, name: text(profile.name || packageDocument.agent?.name || agentId, 120),
    category: category(profile.category || packageDocument.agent?.category),
    // A new Agent remains private until a trusted review approves a version.
    // An already-public Agent keeps its currently approved version online.
    status: existing?.current_version ? "published" : "review",
    visibility: existing?.current_version ? "public" : "private",
    headline: text(profile.headline, 240), public_summary: text(profile.public_summary, 4000),
    public_skills: strings(profile.skills, 20, 120), result_types: strings(packageDocument.manifest?.finalizers, 10, 40),
    public_design_contract: publicDesignContract(profile.design_contract),
    pricing: profile.pricing && typeof profile.pricing === "object" ? profile.pricing : { mode: "free" },
  };
}

function publicDesignContract(value: unknown) {
  const contract = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const questions = (Array.isArray(contract.questions) ? contract.questions : [])
    .map((raw, index) => {
      const question = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const label = text(question.label, 500);
      if (!label) return null;
      const rawKind = String(question.kind || "short");
      const kind = ["single", "multi", "short", "long"].includes(rawKind) ? rawKind : "short";
      return {
        id: text(question.id || `question-${index + 1}`, 80),
        label,
        helper: text(question.helper, 500),
        kind,
        required: question.required !== false,
        options: strings(question.options, 20, 200),
      };
    })
    .filter(Boolean)
    .slice(0, 20);
  if (!questions.length) return {};
  return {
    purpose: text(contract.purpose, 2_000),
    priority_count: Math.max(0, Math.min(20, Number(contract.priority_count) || 0)),
    quality_bar_count: Math.max(0, Math.min(20, Number(contract.quality_bar_count) || 0)),
    questions,
  };
}

function reviewPreflight(packageDocument) {
  const files = Array.isArray(packageDocument.files) ? packageDocument.files : [];
  const manifest = packageDocument.manifest && typeof packageDocument.manifest === "object"
    ? packageDocument.manifest
    : {};
  const blocking = [];
  const warnings = [];
  const forbiddenPath = /(^|\/)(\.env|id_rsa|credentials?|secrets?)(\.|$)|node_modules|(^|\/)\.git(\/|$)/i;
  const permittedExtensions = /\.(?:md|txt|json|jsonl|mjs|cjs|js|py|toml|ya?ml|svg|png|jpe?g|webp|gif|gitkeep)$/i;

  if (packageDocument.packageMode !== "local_protected") {
    blocking.push("Marketplace packages must use local_protected execution.");
  }
  if (!files.length || files.length > 400) blocking.push("Package file count is outside the review limit.");
  if (!Array.isArray(manifest.outputModes) || !manifest.outputModes.length) {
    blocking.push("A declared output contract is required.");
  }
  if (!Array.isArray(manifest.finalizers) || !manifest.finalizers.length) {
    blocking.push("A declared result finalizer is required.");
  }
  for (const file of files) {
    const path = String(file?.path || "");
    if (!path || path.startsWith("/") || path.includes("..")) blocking.push("Package contains an unsafe file path.");
    if (forbiddenPath.test(path)) blocking.push(`Forbidden package file: ${path}`);
    if (!permittedExtensions.test(path)) warnings.push(`Manual review required for file type: ${path}`);
    if (Number(file?.bytes || 0) > 5 * 1024 * 1024) warnings.push(`Large file requires review: ${path}`);
  }
  return {
    schema: "hireme.agent_safety_preflight.v1",
    passed: blocking.length === 0,
    blocking: [...new Set(blocking)].slice(0, 20),
    warnings: [...new Set(warnings)].slice(0, 50),
    checkedAt: new Date().toISOString(),
    executionBoundary: "licensed_device_runtime",
  };
}

function publicManifest(manifest) {
  const value = manifest && typeof manifest === "object" ? manifest : {};
  return { schema: text(value.schema || "hireme.local_specialist.manifest.v1", 120), capabilities: strings(value.capabilities, 40, 120), inputModes: strings(value.inputModes, 20, 80), outputModes: strings(value.outputModes, 20, 80), finalizers: strings(value.finalizers, 20, 80), intentTags: strings(value.intentTags, 40, 80), execution: {} };
}

function category(value) { const textValue = String(value || "").toLowerCase(); if (/image|design|character/.test(textValue)) return "image"; if (/writing|copy/.test(textValue)) return "writing"; if (/business|launch|growth/.test(textValue)) return "business"; if (/research|data/.test(textValue)) return "research"; if (/productivity/.test(textValue)) return "productivity"; return "other"; }
function strings(value, max, length) { return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, length)).filter(Boolean))].slice(0, max); }
function text(value, max) { return String(value || "").trim().slice(0, max); }
function requireAgentId(value) { const id = String(value || "").trim(); if (!agentIdPattern.test(id)) throw new Error("Agent id is invalid."); return id; }
function requireVersion(value) { const version = String(value || "").trim(); if (!versionPattern.test(version)) throw new Error("Agent version is invalid."); return version; }
function requiredEnv(key) { const value = Deno.env.get(key); if (!value) throw new Error(`Missing ${key}.`); return value; }
function decodeBase64(value, name) { const source = String(value || ""); if (!source || !/^[A-Za-z0-9+/]+={0,2}$/.test(source)) throw new Error(`${name} is invalid.`); const binary = atob(source); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }
function toBase64(bytes) { let binary = ""; for (const value of bytes) binary += String.fromCharCode(value); return btoa(binary); }
async function sha256(bytes) { const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); return `sha256:${[...digest].map((value) => value.toString(16).padStart(2, "0")).join("")}`; }
function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }); }
