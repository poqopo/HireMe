import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  randomUUID,
  sign,
  verify,
} from "node:crypto";

export const devicePackageLicenseSchema = "hireme.device_package_license.v1";
const localExecutionClass = "local_protected";

export function createDeviceLicenseIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const publicKeyBase64 = exportPublicKey(publicKey);
  return {
    deviceId: keyFingerprint(publicKeyBase64),
    publicKey: publicKeyBase64,
    privateKey,
    productionBoundary:
      "Store the private key as a non-exportable OS-backed key when the platform supports it.",
  };
}

export function createLicenseIssuerIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyBase64 = exportPublicKey(publicKey);
  return {
    keyId: keyFingerprint(publicKeyBase64),
    publicKey: publicKeyBase64,
    privateKey,
  };
}

export function issueDevicePackageLicense({
  packageKey,
  devicePublicKey,
  issuerPrivateKey,
  userId,
  agentId,
  packageDigest,
  expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  maxRuns = 1,
  licenseId = randomUUID(),
} = {}) {
  const keyBytes = decodeFixedBase64(packageKey, 32, "packageKey");
  const deviceKey = importPublicKey(devicePublicKey);
  const devicePublicKeyBase64 = exportPublicKey(deviceKey);
  const issuerKey = importPrivateKey(issuerPrivateKey);
  const issuerPublicKey = exportPublicKey(createPublicKey(issuerKey));
  const { publicKey: ephemeralPublic, privateKey: ephemeralPrivate } = generateKeyPairSync("x25519");
  const ephemeralPublicKey = exportPublicKey(ephemeralPublic);
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const metadata = {
    schema: devicePackageLicenseSchema,
    licenseId: requireUuid(licenseId, "licenseId"),
    executionClass: localExecutionClass,
    userId: requirePrincipal(userId, "userId"),
    agentId: requireAgentId(agentId),
    packageDigest: requireDigest(packageDigest),
    deviceId: keyFingerprint(devicePublicKeyBase64),
    issuerKeyId: keyFingerprint(issuerPublicKey),
    issuedAt: new Date().toISOString(),
    expiresAt: requireFutureTimestamp(expiresAt),
    maxRuns: requirePositiveInteger(maxRuns, "maxRuns", 1000),
    ephemeralPublicKey,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };
  const sharedSecret = diffieHellman({ privateKey: ephemeralPrivate, publicKey: deviceKey });
  const wrappingKey = deriveWrappingKey(sharedSecret, salt, metadata);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey, iv);
  cipher.setAAD(Buffer.from(stableStringify(metadata), "utf8"));
  const wrappedPackageKey = Buffer.concat([cipher.update(keyBytes), cipher.final()]);
  const unsigned = {
    ...metadata,
    authTag: cipher.getAuthTag().toString("base64"),
    wrappedPackageKey: wrappedPackageKey.toString("base64"),
  };
  const signature = sign(null, Buffer.from(stableStringify(unsigned), "utf8"), issuerKey);
  keyBytes.fill(0);
  wrappingKey.fill(0);
  sharedSecret.fill(0);
  return {
    ...unsigned,
    signature: signature.toString("base64"),
  };
}

export function unwrapDevicePackageLicense({
  license,
  devicePrivateKey,
  issuerPublicKey,
  expectedUserId,
  expectedAgentId,
  now = Date.now(),
} = {}) {
  validateLicenseShape(license);
  const deviceKey = importPrivateKey(devicePrivateKey);
  const issuerKey = importPublicKey(issuerPublicKey);
  const unsigned = { ...license };
  delete unsigned.signature;
  const signature = decodeBase64(license.signature, "signature");
  if (!verify(null, Buffer.from(stableStringify(unsigned), "utf8"), issuerKey, signature)) {
    throw new Error("Device package license signature is invalid.");
  }
  if (keyFingerprint(exportPublicKey(issuerKey)) !== license.issuerKeyId) {
    throw new Error("Device package license issuer does not match.");
  }
  if (keyFingerprint(exportPublicKey(createPublicKey(deviceKey))) !== license.deviceId) {
    throw new Error("Device package license is bound to another device.");
  }
  if (expectedUserId && requirePrincipal(expectedUserId, "expectedUserId") !== license.userId) {
    throw new Error("Device package license belongs to another user.");
  }
  if (expectedAgentId && requireAgentId(expectedAgentId) !== license.agentId) {
    throw new Error("Device package license belongs to another Agent.");
  }
  if (Date.parse(license.expiresAt) <= Number(now)) {
    throw new Error("Device package license has expired.");
  }
  const ephemeralPublicKey = importPublicKey(license.ephemeralPublicKey);
  const salt = decodeFixedBase64(license.salt, 32, "salt");
  const iv = decodeFixedBase64(license.iv, 12, "iv");
  const authTag = decodeFixedBase64(license.authTag, 16, "authTag");
  const wrappedPackageKey = decodeBase64(license.wrappedPackageKey, "wrappedPackageKey");
  const metadata = licenseMetadataForAad(license);
  const sharedSecret = diffieHellman({ privateKey: deviceKey, publicKey: ephemeralPublicKey });
  const wrappingKey = deriveWrappingKey(sharedSecret, salt, metadata);
  const decipher = createDecipheriv("aes-256-gcm", wrappingKey, iv);
  decipher.setAAD(Buffer.from(stableStringify(metadata), "utf8"));
  decipher.setAuthTag(authTag);
  let packageKey;
  try {
    packageKey = Buffer.concat([decipher.update(wrappedPackageKey), decipher.final()]);
  } catch {
    throw new Error("Device package license authentication failed.");
  } finally {
    wrappingKey.fill(0);
    sharedSecret.fill(0);
  }
  if (packageKey.length !== 32) throw new Error("Unwrapped package key has an invalid size.");
  const packageKeyBase64 = packageKey.toString("base64");
  packageKey.fill(0);
  return {
    packageKey: packageKeyBase64,
    grant: {
      licenseId: license.licenseId,
      userId: license.userId,
      agentId: license.agentId,
      packageDigest: license.packageDigest,
      executionClass: license.executionClass,
      expiresAt: license.expiresAt,
      maxRuns: license.maxRuns,
      persistentPlaintextCacheAllowed: false,
    },
  };
}

export function publicDeviceRegistration(identity) {
  const publicKey = typeof identity?.publicKey === "string"
    ? identity.publicKey
    : exportPublicKey(createPublicKey(importPrivateKey(identity?.privateKey)));
  return {
    schema: "hireme.device_registration.v1",
    deviceId: keyFingerprint(publicKey),
    keyType: "x25519",
    publicKey,
  };
}

function validateLicenseShape(license) {
  if (!license || typeof license !== "object") throw new Error("Device package license is required.");
  if (license.schema !== devicePackageLicenseSchema) throw new Error("Unsupported device package license schema.");
  requireUuid(license.licenseId, "licenseId");
  if (license.executionClass !== localExecutionClass) throw new Error("Device license is not for local protected execution.");
  requirePrincipal(license.userId, "userId");
  requireAgentId(license.agentId);
  requireDigest(license.packageDigest);
  requirePositiveInteger(license.maxRuns, "maxRuns", 1000);
  if (!Number.isFinite(Date.parse(license.issuedAt)) || !Number.isFinite(Date.parse(license.expiresAt))) {
    throw new Error("Device package license timestamps are invalid.");
  }
}

function licenseMetadataForAad(license) {
  return {
    schema: license.schema,
    licenseId: license.licenseId,
    executionClass: license.executionClass,
    userId: license.userId,
    agentId: license.agentId,
    packageDigest: license.packageDigest,
    deviceId: license.deviceId,
    issuerKeyId: license.issuerKeyId,
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
    maxRuns: license.maxRuns,
    ephemeralPublicKey: license.ephemeralPublicKey,
    salt: license.salt,
    iv: license.iv,
  };
}

function deriveWrappingKey(sharedSecret, salt, metadata) {
  const info = Buffer.from(
    `hireme-device-package-license\0${metadata.licenseId}\0${metadata.deviceId}\0${metadata.agentId}`,
    "utf8",
  );
  return Buffer.from(hkdfSync("sha256", sharedSecret, salt, info, 32));
}

function importPublicKey(value) {
  if (value?.type === "public") return value;
  return createPublicKey({
    key: decodeBase64(value, "publicKey"),
    format: "der",
    type: "spki",
  });
}

function importPrivateKey(value) {
  if (value?.type === "private") return value;
  return createPrivateKey({
    key: decodeBase64(value, "privateKey"),
    format: "der",
    type: "pkcs8",
  });
}

function exportPublicKey(value) {
  return value.export({ format: "der", type: "spki" }).toString("base64");
}

function keyFingerprint(publicKey) {
  return `sha256:${createHash("sha256").update(decodeBase64(publicKey, "publicKey")).digest("hex")}`;
}

function requirePrincipal(value, name) {
  const normalized = String(value || "").trim().slice(0, 160);
  if (!normalized || /[\u0000-\u001f]/.test(normalized)) throw new Error(`${name} is invalid.`);
  return normalized;
}

function requireAgentId(value) {
  const normalized = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(normalized)) throw new Error("agentId is invalid.");
  return normalized;
}

function requireDigest(value) {
  const normalized = String(value || "");
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) throw new Error("packageDigest is invalid.");
  return normalized;
}

function requireUuid(value, name) {
  const normalized = String(value || "");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(normalized)) {
    throw new Error(`${name} must be a UUID.`);
  }
  return normalized;
}

function requireFutureTimestamp(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new Error("expiresAt must be in the future.");
  return new Date(timestamp).toISOString();
}

function requirePositiveInteger(value, name, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new Error(`${name} must be between 1 and ${max}.`);
  }
  return number;
}

function decodeFixedBase64(value, length, name) {
  const bytes = decodeBase64(value, name);
  if (bytes.length !== length) throw new Error(`${name} must be ${length} bytes.`);
  return bytes;
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
