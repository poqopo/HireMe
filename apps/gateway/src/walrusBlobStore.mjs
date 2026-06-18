import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { RetryableWalrusClientError, walrus } from "@mysten/walrus";

const defaultRuntimeDir = ".hireme/walrus/protected-runtime";
let walrusClient = null;
let walrusSigner = null;

loadEnvFile(".env");
loadEnvFile(".env.local");

export async function storeFileOnWalrus({ filePath, epochs = 3 }) {
  const blob = await readFile(resolve(filePath));
  const signer = getWalrusSigner();
  const steps = [];
  const result = await runWalrusOperation(async (client) =>
    client.walrus.writeBlob({
      blob,
      deletable: isWalrusBlobDeletable(),
      epochs,
      signer,
      owner: cleanEnv(process.env.HIREME_WALRUS_OWNER_ADDRESS) || undefined,
      onStep: (step) => {
        steps.push(step);
      },
    }),
  );

  const blobId = result.blobId;
  if (!blobId) {
    throw new Error(
      `Walrus SDK upload did not return a blob id. Raw output: ${JSON.stringify(result).slice(0, 2000)}`,
    );
  }

  const uploadResult = {
    ...result,
    blobObject: result.blobObject || null,
    payerAddress: signer.toSuiAddress(),
    storageEpochs: epochs,
    storageNetwork: walrusNetwork(),
    uploadRelayUrl: cleanEnv(process.env.WALRUS_UPLOAD_RELAY_URL) || null,
    steps,
  };

  return {
    result: uploadResult,
    blobId,
    suiObjectId: result.blobObject?.id || findWalrusObjectId(result),
  };
}

export async function readWalrusBlobToFile({ blobId, outPath }) {
  const { bytes } = await readWalrusBlobFromNetwork({ blobId });
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await writeFile(resolve(outPath), Buffer.from(bytes));
  return resolve(outPath);
}

export async function readWalrusBlobBytes({
  blobId,
  runtimeDir = defaultRuntimeDir,
  fileName = `${safePathName(blobId)}.platform-encryption.json`,
}) {
  const outPath = join(runtimeDir, fileName);
  const read = await readWalrusBlobFromNetwork({ blobId });
  const bytes = Buffer.from(read.bytes);
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await writeFile(resolve(outPath), bytes);
  return {
    bytes,
    outPath: resolve(outPath),
    digest: `sha256:${sha256Hex(bytes)}`,
    sizeBytes: bytes.length,
    source: read.source,
    aggregatorUrl: read.aggregatorUrl || null,
  };
}

export function isWalrusPayerConfigured() {
  return Boolean(
    firstEnvValue([
      "HIREME_WALRUS_PAYER_PRIVATE_KEY",
      "WALRUS_PAYER_PRIVATE_KEY",
      "SUI_PRIVATE_KEY",
    ]),
  );
}

export function findFirstByKey(value, keys) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstByKey(item, keys);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key) && typeof child === "string" && child) {
      return child;
    }
  }

  for (const child of Object.values(value)) {
    const found = findFirstByKey(child, keys);
    if (found) return found;
  }

  return null;
}

export function findWalrusObjectId(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWalrusObjectId(item);
      if (found) return found;
    }
    return null;
  }

  for (const key of [
    "suiObjectId",
    "sui_object_id",
    "objectId",
    "object_id",
    "storageObjectId",
  ]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.startsWith("0x")) {
      return candidate;
    }
  }

  if (value.blobObject?.id && String(value.blobObject.id).startsWith("0x")) {
    return value.blobObject.id;
  }

  for (const child of Object.values(value)) {
    const found = findWalrusObjectId(child);
    if (found) return found;
  }

  return null;
}

async function runWalrusOperation(operation) {
  const client = getWalrusClient();
  try {
    return await operation(client);
  } catch (err) {
    if (err instanceof RetryableWalrusClientError) {
      client.walrus.reset();
      return operation(client);
    }
    throw err;
  }
}

async function readWalrusBlobFromNetwork({ blobId }) {
  const aggregatorErrors = [];
  for (const aggregatorUrl of walrusAggregatorUrls()) {
    try {
      const bytes = await readWalrusBlobWithAggregator({ blobId, aggregatorUrl });
      return {
        bytes,
        source: "walrus-aggregator",
        aggregatorUrl,
      };
    } catch (err) {
      aggregatorErrors.push(`${aggregatorUrl}: ${formatErrorMessage(err)}`);
    }
  }

  if (walrusSdkReadFallbackEnabled()) {
    const bytes = await runWalrusOperation((client) =>
      client.walrus.readBlob({ blobId }),
    );
    return {
      bytes,
      source: "walrus-sdk",
      aggregatorUrl: null,
    };
  }

  throw new Error(
    `Walrus aggregator read failed for blob ${blobId}: ${aggregatorErrors.join("; ")}`,
  );
}

async function readWalrusBlobWithAggregator({ blobId, aggregatorUrl }) {
  const url = `${aggregatorUrl.replace(/\/+$/, "")}/v1/blobs/${encodeURIComponent(blobId)}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(
      positiveIntegerEnv("HIREME_WALRUS_READ_TIMEOUT_MS", 30_000),
    ),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `HTTP ${response.status}${responseText ? ` ${responseText.slice(0, 200)}` : ""}`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

function getWalrusClient() {
  walrusClient ||= new SuiGrpcClient({
    network: walrusNetwork(),
    baseUrl: suiFullnodeUrl(),
  }).$extend(
    walrus({
      packageConfig: walrusPackageConfig(),
      uploadRelay: walrusUploadRelayConfig(),
      storageNodeClientOptions: {
        timeout: positiveIntegerEnv("HIREME_WALRUS_STORAGE_NODE_TIMEOUT_MS", 60_000),
      },
    }),
  );
  return walrusClient;
}

function walrusAggregatorUrls() {
  const configured = cleanEnv(
    process.env.WALRUS_AGGREGATOR_URLS || process.env.WALRUS_AGGREGATOR_URL,
  );
  const urls = configured
    ? configured
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    : [defaultWalrusAggregatorUrl()];
  return [...new Set(urls)];
}

function defaultWalrusAggregatorUrl() {
  return `https://aggregator.walrus-${walrusNetwork()}.walrus.space`;
}

function walrusSdkReadFallbackEnabled() {
  return /^(1|true|yes)$/i.test(process.env.HIREME_WALRUS_SDK_READ_FALLBACK || "");
}

function formatErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

function getWalrusSigner() {
  walrusSigner ||= createWalrusSigner();
  return walrusSigner;
}

function createWalrusSigner() {
  const { name, value } = firstEnvEntry([
    "HIREME_WALRUS_PAYER_PRIVATE_KEY",
    "WALRUS_PAYER_PRIVATE_KEY",
    "SUI_PRIVATE_KEY",
  ]);

  if (!value) {
    throw new Error(
      "Walrus SDK upload needs a payer private key. Set HIREME_WALRUS_PAYER_PRIVATE_KEY to a Sui suiprivkey value.",
    );
  }

  try {
    const parsed = parseSuiPrivateKey(value);
    return keypairFromSecretKey(parsed);
  } catch (err) {
    throw new Error(
      `Invalid Walrus payer private key in ${name}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

function parseSuiPrivateKey(value) {
  const trimmed = cleanEnv(value);
  if (trimmed.startsWith("suiprivkey")) {
    return decodeSuiPrivateKey(trimmed);
  }

  const bytes = decodeRawPrivateKeyBytes(trimmed);
  if (bytes.length === 33) {
    return {
      scheme: schemeFromFlag(bytes[0]),
      secretKey: bytes.subarray(1),
    };
  }
  if (bytes.length === 32) {
    return {
      scheme: process.env.HIREME_WALRUS_PAYER_KEY_SCHEME || "ED25519",
      secretKey: bytes,
    };
  }

  throw new Error("expected suiprivkey, 32-byte raw key, or 33-byte Sui keystore key");
}

function decodeRawPrivateKeyBytes(value) {
  const normalized = value.replace(/^0x/, "");
  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0) {
    return Buffer.from(normalized, "hex");
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return Buffer.from(value, "base64");
  }
  throw new Error("unsupported private key encoding");
}

function schemeFromFlag(flag) {
  if (flag === 0) return "ED25519";
  if (flag === 1) return "Secp256k1";
  if (flag === 2) return "Secp256r1";
  throw new Error(`unsupported Sui private key scheme flag: ${flag}`);
}

function keypairFromSecretKey({ scheme, secretKey }) {
  const normalizedScheme = String(scheme || "").toLowerCase();
  if (normalizedScheme === "ed25519") {
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  if (normalizedScheme === "secp256k1") {
    return Secp256k1Keypair.fromSecretKey(secretKey);
  }
  if (normalizedScheme === "secp256r1") {
    return Secp256r1Keypair.fromSecretKey(secretKey);
  }
  throw new Error(`unsupported key scheme: ${scheme}`);
}

function walrusNetwork() {
  const value = cleanEnv(
    process.env.WALRUS_NETWORK ||
      process.env.WALRUS_CONTEXT ||
      process.env.SUI_NETWORK ||
      "testnet",
  ).replace(/^sui-/, "");
  return value === "mainnet" ? "mainnet" : "testnet";
}

function suiFullnodeUrl() {
  return (
    cleanEnv(
      process.env.HIREME_SUI_FULLNODE_URL ||
        process.env.SUI_FULLNODE_URL ||
        process.env.VITE_SUI_FULLNODE_URL,
    ) || `https://fullnode.${walrusNetwork()}.sui.io:443`
  );
}

function walrusPackageConfig() {
  const systemObjectId = cleanEnv(process.env.WALRUS_SYSTEM_OBJECT_ID);
  const stakingPoolId = cleanEnv(process.env.WALRUS_STAKING_POOL_ID);
  if (!systemObjectId && !stakingPoolId) return undefined;
  if (!systemObjectId || !stakingPoolId) {
    throw new Error(
      "Set both WALRUS_SYSTEM_OBJECT_ID and WALRUS_STAKING_POOL_ID, or neither.",
    );
  }
  return {
    systemObjectId,
    stakingPoolId,
    exchangeIds: cleanEnv(process.env.WALRUS_EXCHANGE_IDS)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
}

function walrusUploadRelayConfig() {
  const host = cleanEnv(process.env.WALRUS_UPLOAD_RELAY_URL).replace(/\/$/, "");
  if (!host) return undefined;

  const tipMax = positiveIntegerEnv("WALRUS_UPLOAD_RELAY_TIP_MAX_MIST", 1_000);
  return {
    host,
    ...(tipMax > 0 ? { sendTip: { max: tipMax } } : {}),
  };
}

function isWalrusBlobDeletable() {
  return /^(1|true|yes)$/i.test(process.env.HIREME_WALRUS_DELETABLE || "");
}

function positiveIntegerEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function firstEnvValue(names) {
  return firstEnvEntry(names).value;
}

function firstEnvEntry(names) {
  for (const name of names) {
    const value = cleanEnv(process.env[name]);
    if (value) return { name, value };
  }
  return { name: names[0], value: "" };
}

function cleanEnv(value) {
  return String(value || "").trim();
}

function safePathName(value) {
  return basename(String(value || "blob").replace(/[^a-zA-Z0-9._-]+/g, "_"));
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
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
