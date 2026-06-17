import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const defaultRunnerIdentity = "hireme-local-protected-runner";
export const platformEncryptionFormat = "hireme.platform_encryption.v1";
export const platformEncryptionProvider = "platform_encryption";

const defaultKeyServers = [];
const defaultLocalPackageId = "platform:local:hireme-authority";

loadEnvFile(".env");
loadEnvFile(".env.local");

export function buildSealEncryptionId({ agentId, folderManifestDigest }) {
  return `hireme::agent-folder::${agentId}::${folderManifestDigest.slice(7, 23)}`;
}

export function buildLocalSealPolicyId(agentId) {
  return `platform:agent:${agentId}`;
}

export async function encryptWithSealEnvelope({
  plaintext,
  agentId,
  encryptionId,
  sealPolicyId = buildLocalSealPolicyId(agentId),
  threshold = readPlatformThreshold(),
  keyServerIds = readKeyServerIds(),
}) {
  const plaintextBytes = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
  const iv = randomBytes(12);
  const key = deriveLocalSealKey(encryptionId);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBytes), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const sealMetadata = {
    provider: platformEncryptionProvider,
    mode: "trusted-platform-mvp",
    packageId: readSealPackageId(),
    policyId: sealPolicyId,
    encryptionId,
    threshold,
    keyServerIds,
    sealApproveTarget: buildSealApproveTarget(readSealPackageId()),
    kmsKeyId: process.env.HIREME_PLATFORM_KMS_KEY_ID || "platform:local-dev-key",
    policyModel: "paid-hire-receipt-and-approved-platform-gateway",
  };
  const encryptedObject = {
    format: platformEncryptionFormat,
    platform: sealMetadata,
    dem: {
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    },
  };
  const encryptedBytes = Buffer.from(JSON.stringify(encryptedObject, null, 2), "utf8");

  assertCiphertextDoesNotContainPlaintext({
    encryptedBytes,
    blockedPlaintextMarkers: ["Private Operating Notes", "Hidden Scoring Criteria", "contentBase64"],
  });

  return {
    encryptedBytes,
    encryptedObject,
    sealMetadata,
  };
}

export function approveSealAccess({
  agentId,
  hireReceiptObjectId,
  runnerIdentity,
  sealEncryptionId,
  sealPolicyId,
  sealMetadata,
}) {
  if (runnerIdentity !== defaultRunnerIdentity) {
    throw userError(`Runner identity is not approved: ${runnerIdentity}`);
  }

  if (!/^hire_receipt_[a-z0-9_-]+$/i.test(hireReceiptObjectId || "")) {
    throw userError("Missing or invalid paid hire receipt object id");
  }

  return {
    model: "platform-managed-decrypt-approval",
    provider: sealMetadata?.provider || platformEncryptionProvider,
    policyModel: sealMetadata?.policyModel || "paid-hire-receipt-and-approved-platform-gateway",
    agentId,
    packageId: sealMetadata?.packageId || readSealPackageId(),
    sealApproveTarget:
      sealMetadata?.sealApproveTarget || buildSealApproveTarget(sealMetadata?.packageId || readSealPackageId()),
    sealPolicyId,
    sealEncryptionId,
    hireReceiptObjectId,
    runnerIdentity,
    threshold: sealMetadata?.threshold ?? null,
    keyServerIds: sealMetadata?.keyServerIds || [],
    kmsKeyId: sealMetadata?.kmsKeyId || process.env.HIREME_PLATFORM_KMS_KEY_ID || "platform:local-dev-key",
    txBytesDigest: `sha256:${sha256Hex(
      JSON.stringify({ agentId, hireReceiptObjectId, runnerIdentity, sealEncryptionId, sealPolicyId }),
    )}`,
    note:
      "MVP uses platform-managed decryption after paid receipt verification. Sui Seal can be added later as a separate provider.",
  };
}

export function decryptSealEnvelope({
  encryptedBytes,
  encryptionId,
  approval,
}) {
  if (!approval?.sealEncryptionId || approval.sealEncryptionId !== encryptionId) {
    throw userError("Platform encryption approval does not match the encrypted object identity");
  }

  const encryptedObject = JSON.parse(Buffer.from(encryptedBytes).toString("utf8"));

  if (encryptedObject.format === "hireme.local-seal-ciphertext.v1") {
    return decryptLegacyLocalSealObject({ encryptedObject, encryptionId });
  }

  if (
    encryptedObject.format !== platformEncryptionFormat &&
    encryptedObject.format !== "hireme.platform-ciphertext-envelope.v1" &&
    encryptedObject.format !== "hireme.seal-ciphertext-envelope.v1"
  ) {
    throw userError(`Unsupported protected ciphertext format: ${encryptedObject.format || "unknown"}`);
  }

  const envelopeMetadata = encryptedObject.platform || encryptedObject.seal || {};
  if (envelopeMetadata.encryptionId !== encryptionId) {
    throw userError("Protected encryption id mismatch");
  }

  const dem = encryptedObject.dem || {};
  if (dem.algorithm !== "aes-256-gcm") {
    throw userError(`Unsupported platform encryption DEM algorithm: ${dem.algorithm || "unknown"}`);
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveLocalSealKey(encryptionId),
    Buffer.from(dem.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(dem.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dem.ciphertext, "base64")),
    decipher.final(),
  ]);
}

export function readSealEnvelopeMetadata(encryptedBytes) {
  const encryptedObject = JSON.parse(Buffer.from(encryptedBytes).toString("utf8"));
  if (encryptedObject.format === "hireme.local-seal-ciphertext.v1") {
    return {
      provider: "legacy-local-aes-gcm",
      mode: "legacy-local",
      packageId: readSealPackageId(),
      encryptionId: encryptedObject.encryptionId,
      threshold: null,
      keyServerIds: [],
      sealApproveTarget: buildSealApproveTarget(readSealPackageId()),
      policyModel: "legacy-local-runner-only",
    };
  }
  return encryptedObject.platform || encryptedObject.seal || {};
}

export function readSealPackageId() {
  return (
    process.env.HIREME_SEAL_PACKAGE_ID ||
    readPublishedSuiPackageRecord()?.packageId ||
    defaultLocalPackageId
  );
}

export function buildSealApproveTarget(packageId = readSealPackageId()) {
  return (
    process.env.HIREME_SEAL_APPROVE_TARGET ||
    readPublishedSuiPackageRecord()?.sealApproveTarget ||
    `${packageId}::access::seal_approve`
  );
}

function readPublishedSuiPackageRecord() {
  try {
    return JSON.parse(
      readFileSync(
        resolve(process.env.HIREME_SUI_PACKAGE_RECORD || ".hireme/sui/hireme-package.json"),
        "utf8",
      ),
    );
  } catch {
    return null;
  }
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
    // Missing env files are fine.
  }
}

export function assertCiphertextDoesNotContainPlaintext({
  encryptedBytes,
  blockedPlaintextMarkers,
}) {
  const serialized = Buffer.from(encryptedBytes).toString("utf8");
  const leaked = blockedPlaintextMarkers.find((text) => text && serialized.includes(text));
  if (leaked) {
    throw userError(`Protected ciphertext contains blocked plaintext marker: ${leaked}`);
  }
}

function decryptLegacyLocalSealObject({ encryptedObject, encryptionId }) {
  if (encryptedObject.encryptionId !== encryptionId) {
    throw userError("Legacy local encryption id mismatch");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveLocalSealKey(encryptionId),
    Buffer.from(encryptedObject.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encryptedObject.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedObject.ciphertext, "base64")),
    decipher.final(),
  ]);
}

function readKeyServerIds() {
  const raw = process.env.HIREME_SEAL_KEY_SERVER_IDS;
  if (!raw) return defaultKeyServers;
  const ids = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : defaultKeyServers;
}

function readPlatformThreshold() {
  const raw = process.env.HIREME_PLATFORM_THRESHOLD || process.env.HIREME_SEAL_THRESHOLD;
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function deriveLocalSealKey(encryptionId) {
  return createHash("sha256")
    .update(
      process.env.HIREME_PLATFORM_KMS_KEY ||
        process.env.HIREME_LOCAL_SEAL_KEY ||
        "hireme-local-dev-platform-key",
    )
    .update(":")
    .update(encryptionId)
    .digest();
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function userError(message) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: "bad_request",
  });
}
