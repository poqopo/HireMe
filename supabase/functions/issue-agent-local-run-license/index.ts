import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();
const agentIdPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

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
    const input = await request.json();
    const agentId = requireAgentId(input?.agentId);
    const device = await validateDevice(input?.device);
    const admin = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await issue({ admin, userId: identity.data.user.id, agentId, device });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Agent run authorization failed." }, 400);
  }
});

async function issue({ admin, userId, agentId, device }) {
  const agentResult = await admin.from("agents")
    .select("id, creator_id, slug, status, visibility, current_version")
    .eq("slug", agentId)
    .single();
  if (agentResult.error || !agentResult.data) throw new Error("Agent를 찾지 못했습니다.");
  const agent = agentResult.data;
  if (agent.status !== "published" || agent.visibility !== "public" || !agent.current_version) {
    throw new Error("아직 실행 가능한 공개 Agent 버전이 없습니다.");
  }
  if (agent.creator_id !== userId) {
    const access = await admin.from("agent_access")
      .select("status, remaining_runs")
      .eq("user_id", userId)
      .eq("agent_id", agent.id)
      .maybeSingle();
    if (access.error || !access.data || access.data.status !== "active") {
      throw new Error("이 Agent를 고용한 뒤에 작업할 수 있습니다.");
    }
    if (access.data.remaining_runs !== null && Number(access.data.remaining_runs) <= 0) {
      throw new Error("이 Agent의 남은 실행 횟수가 없습니다.");
    }
  }
  const versionResult = await admin.from("agent_versions")
    .select("id, version_number, display_version, package_digest, package_encryption, runtime_ref, review_status")
    .eq("agent_id", agent.id)
    .eq("version_number", agent.current_version)
    .single();
  if (versionResult.error || !versionResult.data) throw new Error("Agent 실행 버전을 찾지 못했습니다.");
  const version = versionResult.data;
  if (version.review_status !== "approved") throw new Error("Agent 버전 검토가 아직 완료되지 않았습니다.");
  if (version.package_encryption?.executionClass !== "local_protected") {
    throw new Error("이 Agent 버전은 현재 기기 보호 실행을 지원하지 않습니다. 제작자가 새 버전을 공개해야 합니다.");
  }
  const location = parseRuntimeRef(version.runtime_ref);
  const signed = await admin.storage.from(location.bucket).createSignedUrl(location.path, 5 * 60);
  if (signed.error || !signed.data?.signedUrl) throw new Error("보호된 Agent 패키지 링크를 만들지 못했습니다.");
  const masterSecret = await admin.rpc("get_agent_package_runtime_secret");
  if (masterSecret.error || typeof masterSecret.data !== "string") throw new Error("Agent package encryption key is unavailable.");
  const packageDigest = requireDigest(version.package_digest);
  const displayVersion = String(version.display_version || `${version.version_number}.0.0`);
  const packageKey = await deriveLocalPackageKey({
    masterSecret: masterSecret.data,
    agentId,
    agentVersion: displayVersion,
    packageDigest,
  });
  const license = await issueDeviceLicense({
    packageKey,
    devicePublicKey: device.publicKey,
    userId,
    agentId,
    packageDigest,
  });
  if (agent.creator_id !== userId) {
    const consumed = await admin.rpc("consume_agent_run_entitlement", {
      target_user_id: userId,
      target_agent_id: agent.id,
    });
    if (consumed.error) throw new Error("실행 권한을 사용할 수 없습니다.");
  }
  return {
    schema: "hireme.local_protected_run_grant.v1",
    packageUrl: signed.data.signedUrl,
    packageDigest,
    license,
    issuerPublicKey: requiredEnv("HIREME_LOCAL_LICENSE_ISSUER_PUBLIC_KEY"),
    expiresAt: license.expiresAt,
  };
}

async function issueDeviceLicense({ packageKey, devicePublicKey, userId, agentId, packageDigest }) {
  const issuerPrivateKey = decodeBase64(requiredEnv("HIREME_LOCAL_LICENSE_ISSUER_PRIVATE_KEY"), "issuer private key");
  const issuer = await crypto.subtle.importKey("pkcs8", issuerPrivateKey, { name: "Ed25519" }, true, ["sign"]);
  const issuerPublicKey = requiredEnv("HIREME_LOCAL_LICENSE_ISSUER_PUBLIC_KEY");
  await crypto.subtle.importKey("spki", decodeBase64(issuerPublicKey, "issuer public key"), { name: "Ed25519" }, false, ["verify"]);
  const device = await crypto.subtle.importKey("spki", decodeBase64(devicePublicKey, "device public key"), { name: "X25519" }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const ephemeralPublicKey = toBase64(new Uint8Array(await crypto.subtle.exportKey("spki", ephemeral.publicKey)));
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const metadata = {
    schema: "hireme.device_package_license.v1",
    licenseId: crypto.randomUUID(),
    executionClass: "local_protected",
    userId,
    agentId,
    packageDigest,
    deviceId: await fingerprint(devicePublicKey),
    issuerKeyId: await fingerprint(issuerPublicKey),
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    maxRuns: 1,
    ephemeralPublicKey,
    salt: toBase64(salt),
    iv: toBase64(iv),
  };
  const shared = await crypto.subtle.deriveBits({ name: "X25519", public: device }, ephemeral.privateKey, 256);
  const wrappingKey = await deriveWrappingKey(new Uint8Array(shared), salt, metadata);
  const cipher = await crypto.subtle.importKey("raw", wrappingKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(stableStringify(metadata)), tagLength: 128 }, cipher, decodeBase64(packageKey, "package key")));
  const unsigned = { ...metadata, authTag: toBase64(sealed.slice(-16)), wrappedPackageKey: toBase64(sealed.slice(0, -16)) };
  const signature = await crypto.subtle.sign("Ed25519", issuer, encoder.encode(stableStringify(unsigned)));
  return { ...unsigned, signature: toBase64(new Uint8Array(signature)) };
}

async function deriveWrappingKey(sharedSecret, salt, metadata) {
  const key = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  const info = encoder.encode(`hireme-device-package-license\0${metadata.licenseId}\0${metadata.deviceId}\0${metadata.agentId}`);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, 256);
  return new Uint8Array(bits);
}

async function deriveLocalPackageKey({ masterSecret, agentId, agentVersion, packageDigest }) {
  const master = await crypto.subtle.importKey("raw", decodeBase64(masterSecret, "masterSecret"), "HKDF", false, ["deriveBits"]);
  const salt = await crypto.subtle.digest("SHA-256", encoder.encode(agentId));
  const info = encoder.encode(`hireme-local-protected-package\0${agentVersion}\0${packageDigest}`);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, master, 256);
  return toBase64(new Uint8Array(bits));
}

async function validateDevice(value) {
  if (!value || value.schema !== "hireme.device_registration.v1" || value.keyType !== "x25519") throw new Error("Device registration is invalid.");
  const publicKey = String(value.publicKey || "");
  const deviceId = String(value.deviceId || "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey) || !/^sha256:[a-f0-9]{64}$/.test(deviceId)) throw new Error("Device registration is invalid.");
  if (deviceId !== await fingerprint(publicKey)) throw new Error("Device registration is invalid.");
  return { publicKey, deviceId };
}

function parseRuntimeRef(value) {
  const match = /^supabase-storage:\/\/([a-z0-9][a-z0-9._-]*)\/([A-Za-z0-9._/-]+)$/.exec(String(value || ""));
  if (!match || match[2].split("/").some((part) => !part || part === "." || part === "..")) throw new Error("Agent package locator is invalid.");
  return { bucket: match[1], path: match[2] };
}

async function fingerprint(base64) { return `sha256:${(await digest(decodeBase64(base64, "public key"))).replace("sha256:", "")}`; }
async function digest(bytes) { const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); return `sha256:${[...hash].map((value) => value.toString(16).padStart(2, "0")).join("")}`; }
function requireAgentId(value) { const id = String(value || "").trim(); if (!agentIdPattern.test(id)) throw new Error("Agent id is invalid."); return id; }
function requireDigest(value) { const digest = String(value || ""); if (!digestPattern.test(digest)) throw new Error("Package digest is invalid."); return digest; }
function requiredEnv(key) { const value = Deno.env.get(key); if (!value) throw new Error(`Missing ${key}.`); return value; }
function decodeBase64(value, name) { const source = String(value || ""); if (!source || !/^[A-Za-z0-9+/]+={0,2}$/.test(source)) throw new Error(`${name} is invalid.`); const binary = atob(source); return Uint8Array.from(binary, (item) => item.charCodeAt(0)); }
function toBase64(bytes) { let binary = ""; for (const value of bytes) binary += String.fromCharCode(value); return btoa(binary); }
function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }); }
