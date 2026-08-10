import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export const encryptedAgentPackageSchema = "hireme.encrypted_agent_package.v1";
export const encryptedAgentPackageMimeType =
  "application/vnd.hireme.encrypted-agent+json";
export const defaultAgentPackageBucket = "agent-packages";
export const defaultAgentPackageKeyId = "hireme_agent_package_master_key_v1";

const maxPackageBytes = 100 * 1024 * 1024;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function encryptAgentPackage({
  packageBytes,
  masterSecret,
  agentId,
  agentVersion,
  keyId = defaultAgentPackageKeyId,
} = {}) {
  const plaintext = requireBytes(packageBytes, "packageBytes");
  if (plaintext.length > maxPackageBytes) {
    throw new Error(`Agent package exceeds ${maxPackageBytes} bytes.`);
  }
  const packageDocument = parsePackageDocument(plaintext);
  const normalizedAgentId = requireAgentId(agentId || packageDocument.agent?.id);
  const normalizedVersion = requireVersion(agentVersion || packageDocument.agent?.version || "1");
  if (packageDocument.agent?.id !== normalizedAgentId) {
    throw new Error("Agent package id does not match the encryption request.");
  }
  const packageDigest = requireDigest(packageDocument.integrity?.packageDigest, "packageDigest");
  const payloadDigest = sha256(plaintext);
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const createdAt = new Date().toISOString();
  const metadata = {
    schema: encryptedAgentPackageSchema,
    encryptionVersion: 1,
    algorithm: "aes-256-gcm",
    kdf: "hkdf-sha256",
    keyId: requireKeyId(keyId),
    agentId: normalizedAgentId,
    agentVersion: normalizedVersion,
    packageDigest,
    payloadDigest,
    createdAt,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };
  const key = derivePackageKey(masterSecret, salt, metadata);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(stableStringify(metadata), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertextDigest = sha256(ciphertext);
  const envelope = {
    ...metadata,
    ciphertextDigest,
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  const envelopeBytes = Buffer.from(`${stableStringify(envelope)}\n`, "utf8");
  return {
    bytes: envelopeBytes,
    packageDigest,
    payloadDigest,
    ciphertextDigest,
    sizeBytes: envelopeBytes.length,
    encryption: publicEncryptionMetadata(envelope),
  };
}

export function decryptAgentPackage({ envelopeBytes, masterSecret } = {}) {
  const encoded = requireBytes(envelopeBytes, "envelopeBytes");
  if (encoded.length > maxPackageBytes * 2) {
    throw new Error("Encrypted Agent package envelope is too large.");
  }
  const envelope = parseEnvelope(encoded);
  const salt = decodeFixedBase64(envelope.salt, 32, "salt");
  const iv = decodeFixedBase64(envelope.iv, 12, "iv");
  const authTag = decodeFixedBase64(envelope.authTag, 16, "authTag");
  const ciphertext = decodeBase64(envelope.ciphertext, "ciphertext");
  if (sha256(ciphertext) !== envelope.ciphertextDigest) {
    throw new Error("Encrypted Agent package ciphertext digest mismatch.");
  }
  const metadata = encryptionMetadataForAad(envelope);
  const key = derivePackageKey(masterSecret, salt, metadata);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(stableStringify(metadata), "utf8"));
  decipher.setAuthTag(authTag);
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Encrypted Agent package authentication failed.");
  }
  if (plaintext.length > maxPackageBytes) {
    throw new Error("Decrypted Agent package is too large.");
  }
  if (sha256(plaintext) !== envelope.payloadDigest) {
    throw new Error("Decrypted Agent package payload digest mismatch.");
  }
  const packageDocument = parsePackageDocument(plaintext);
  if (
    packageDocument.agent?.id !== envelope.agentId ||
    packageDocument.integrity?.packageDigest !== envelope.packageDigest
  ) {
    throw new Error("Decrypted Agent package metadata mismatch.");
  }
  return {
    bytes: plaintext,
    package: packageDocument,
    packageDigest: envelope.packageDigest,
    payloadDigest: envelope.payloadDigest,
    ciphertextDigest: envelope.ciphertextDigest,
    encryption: publicEncryptionMetadata(envelope),
  };
}

export async function readAgentPackageRuntimeSecret(supabase) {
  requireSupabaseClient(supabase);
  const { data, error } = await supabase.rpc("get_agent_package_runtime_secret");
  if (error) throw new Error(`Agent package runtime key is unavailable: ${error.message}`);
  if (typeof data !== "string" || !data.trim()) {
    throw new Error("Agent package runtime key is empty.");
  }
  decodeMasterSecret(data);
  return data;
}

export async function uploadEncryptedAgentPackage({
  supabase,
  objectPath,
  envelopeBytes,
  bucket = defaultAgentPackageBucket,
  overwrite = false,
} = {}) {
  requireSupabaseClient(supabase);
  const path = requireObjectPath(objectPath);
  const bytes = requireBytes(envelopeBytes, "envelopeBytes");
  const { data, error } = await supabase.storage.from(requireBucket(bucket)).upload(path, bytes, {
    cacheControl: "0",
    contentType: encryptedAgentPackageMimeType,
    upsert: overwrite === true,
  });
  if (error) throw new Error(`Encrypted Agent package upload failed: ${error.message}`);
  return {
    bucket,
    path: data?.path || path,
    runtimeRef: buildAgentPackageRuntimeRef({ bucket, objectPath: data?.path || path }),
    sizeBytes: bytes.length,
  };
}

export async function downloadEncryptedAgentPackage({ supabase, runtimeRef } = {}) {
  requireSupabaseClient(supabase);
  const { bucket, objectPath } = parseAgentPackageRuntimeRef(runtimeRef);
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(`Encrypted Agent package download failed: ${error?.message || "empty object"}`);
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > maxPackageBytes * 2) {
    throw new Error("Encrypted Agent package envelope is too large.");
  }
  return { bucket, objectPath, bytes };
}

export function buildAgentPackageRuntimeRef({
  bucket = defaultAgentPackageBucket,
  objectPath,
} = {}) {
  return `supabase-storage://${requireBucket(bucket)}/${requireObjectPath(objectPath)}`;
}

export function parseAgentPackageRuntimeRef(runtimeRef) {
  let url;
  try {
    url = new URL(String(runtimeRef || ""));
  } catch {
    throw new Error("Invalid Agent package runtime reference.");
  }
  if (url.protocol !== "supabase-storage:" || !url.hostname) {
    throw new Error("Unsupported Agent package runtime reference.");
  }
  return {
    bucket: requireBucket(url.hostname),
    objectPath: requireObjectPath(decodeURIComponent(url.pathname.replace(/^\/+/, ""))),
  };
}

function parseEnvelope(bytes) {
  let envelope;
  try {
    envelope = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Encrypted Agent package envelope is not valid JSON.");
  }
  const expected = {
    schema: encryptedAgentPackageSchema,
    encryptionVersion: 1,
    algorithm: "aes-256-gcm",
    kdf: "hkdf-sha256",
  };
  for (const [key, value] of Object.entries(expected)) {
    if (envelope?.[key] !== value) throw new Error(`Unsupported Agent package ${key}.`);
  }
  requireKeyId(envelope.keyId);
  requireAgentId(envelope.agentId);
  requireVersion(envelope.agentVersion);
  requireDigest(envelope.packageDigest, "packageDigest");
  requireDigest(envelope.payloadDigest, "payloadDigest");
  requireDigest(envelope.ciphertextDigest, "ciphertextDigest");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(envelope.createdAt || ""))) {
    throw new Error("Encrypted Agent package createdAt is invalid.");
  }
  return envelope;
}

function parsePackageDocument(bytes) {
  let document;
  try {
    document = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Agent package is not valid JSON.");
  }
  if (document?.schema !== "hireme.local_specialist.package.v1") {
    throw new Error("Unsupported HireMe Agent package schema.");
  }
  requireDigest(document.integrity?.packageDigest, "packageDigest");
  return document;
}

function derivePackageKey(masterSecret, salt, metadata) {
  const masterKey = decodeMasterSecret(masterSecret);
  const info = Buffer.from(
    `hireme-agent-package\0${metadata.keyId}\0${metadata.agentId}\0${metadata.agentVersion}`,
    "utf8",
  );
  return Buffer.from(hkdfSync("sha256", masterKey, salt, info, 32));
}

function decodeMasterSecret(value) {
  const bytes = decodeBase64(String(value || "").trim(), "masterSecret");
  if (bytes.length !== 32) throw new Error("Agent package master key must be 32 bytes.");
  return bytes;
}

function encryptionMetadataForAad(envelope) {
  return {
    schema: envelope.schema,
    encryptionVersion: envelope.encryptionVersion,
    algorithm: envelope.algorithm,
    kdf: envelope.kdf,
    keyId: envelope.keyId,
    agentId: envelope.agentId,
    agentVersion: envelope.agentVersion,
    packageDigest: envelope.packageDigest,
    payloadDigest: envelope.payloadDigest,
    createdAt: envelope.createdAt,
    salt: envelope.salt,
    iv: envelope.iv,
  };
}

function publicEncryptionMetadata(envelope) {
  return {
    schema: envelope.schema,
    algorithm: envelope.algorithm,
    kdf: envelope.kdf,
    keyId: envelope.keyId,
    payloadDigest: envelope.payloadDigest,
  };
}

function requireBytes(value, name) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error(`${name} is required.`);
}

function decodeBase64(value, name) {
  const normalized = String(value || "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error(`${name} is not valid base64.`);
  }
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.toString("base64").replace(/=+$/, "") !== normalized.replace(/=+$/, "")) {
    throw new Error(`${name} is not canonical base64.`);
  }
  return bytes;
}

function decodeFixedBase64(value, length, name) {
  const bytes = decodeBase64(value, name);
  if (bytes.length !== length) throw new Error(`${name} must be ${length} bytes.`);
  return bytes;
}

function requireDigest(value, name) {
  const digest = String(value || "");
  if (!digestPattern.test(digest)) throw new Error(`${name} is invalid.`);
  return digest;
}

function requireAgentId(value) {
  const id = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(id)) {
    throw new Error("Agent id is invalid.");
  }
  return id;
}

function requireVersion(value) {
  const version = String(value || "").trim();
  if (!version || version.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)) {
    throw new Error("Agent version is invalid.");
  }
  return version;
}

function requireKeyId(value) {
  const keyId = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(keyId)) {
    throw new Error("Agent package key id is invalid.");
  }
  return keyId;
}

function requireBucket(value) {
  const bucket = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucket)) {
    throw new Error("Agent package bucket is invalid.");
  }
  return bucket;
}

function requireObjectPath(value) {
  const path = String(value || "").replace(/^\/+/, "");
  if (
    !path ||
    path.length > 900 ||
    path.includes("\\") ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    !/^[A-Za-z0-9._/-]+$/.test(path)
  ) {
    throw new Error("Agent package object path is invalid.");
  }
  return path;
}

function requireSupabaseClient(value) {
  if (!value?.storage?.from || !value?.rpc) throw new Error("Supabase runtime client is required.");
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
