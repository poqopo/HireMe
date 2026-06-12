import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  approveSealAccess,
  assertCiphertextDoesNotContainPlaintext,
  decryptSealEnvelope,
  defaultRunnerIdentity,
  encryptWithSealEnvelope,
  readSealEnvelopeMetadata,
} from "./sealEnvelope.mjs";
import { readWalrusBlobBytes, storeFileOnWalrus } from "./walrusBlobStore.mjs";

const defaultOutDir = ".hireme/memwal";

export async function publishMemWalSnapshot({
  agentId,
  memoryPath,
  epochs = 3,
  outDir = defaultOutDir,
  uploadToWalrus = true,
}) {
  const resolvedMemoryPath = resolve(memoryPath);
  const memoryBytes = await readFile(resolvedMemoryPath);
  const memoryDigest = `sha256:${sha256Hex(memoryBytes)}`;
  const memory = JSON.parse(memoryBytes.toString("utf8"));
  const encryptionId = `hireme::memwal::${agentId}::${memoryDigest.slice(7, 23)}`;
  const plaintextObject = {
    format: "hireme.memwal.snapshot.v1",
    agentId,
    sourceFileName: basename(resolvedMemoryPath),
    createdAt: new Date().toISOString(),
    memoryDigest,
    memory,
  };
  const plaintext = Buffer.from(JSON.stringify(plaintextObject), "utf8");
  const { encryptedBytes, sealMetadata } = await encryptWithSealEnvelope({
    plaintext,
    agentId,
    encryptionId,
    sealPolicyId: `platform:memwal:${agentId}`,
  });

  assertCiphertextDoesNotContainPlaintext({
    encryptedBytes,
    blockedPlaintextMarkers: extractMemoryLeakMarkers(memory),
  });

  await mkdir(outDir, { recursive: true });
  const localCiphertextPath = join(outDir, `${agentId}.memwal.json`);
  const recordPath = join(outDir, `${agentId}.memwal-record.json`);
  await writeFile(localCiphertextPath, encryptedBytes);

  const record = {
    format: "hireme.memwal-public-record.v1",
    kind: "memory_snapshot",
    agentId,
    storageProvider: "local-file",
    encryptionProvider: sealMetadata.provider,
    platformKmsKeyId: sealMetadata.kmsKeyId,
    encryptionId,
    policyId: `platform:memwal:${agentId}`,
    ciphertextFormat: "hireme.platform-ciphertext-envelope.v1",
    ciphertextDigest: `sha256:${sha256Hex(encryptedBytes)}`,
    ciphertextSizeBytes: encryptedBytes.length,
    memoryDigest,
    localCiphertextPath,
    plaintextStoredInDb: false,
    plaintextReturnedToHirer: false,
    createdAt: new Date().toISOString(),
  };

  if (uploadToWalrus) {
    const upload = await storeFileOnWalrus({
      filePath: localCiphertextPath,
      epochs,
    });
    record.storageProvider = "walrus";
    record.storageNetwork = process.env.WALRUS_NETWORK || process.env.WALRUS_CONTEXT || "testnet";
    record.storageEpochs = epochs;
    record.walrusBlobId = upload.blobId;
    record.walrusSuiObjectId = upload.suiObjectId;
    record.walrusStoreResult = upload.result;
    record.walrusUploadedAt = new Date().toISOString();
  }

  await writeFile(recordPath, JSON.stringify(record, null, 2));

  return {
    status: "published",
    recordPath,
    localCiphertextPath,
    publicRecord: record,
  };
}

export async function readMemWalSnapshot({
  recordPath,
  hireReceiptObjectId,
  runnerIdentity = process.env.HIREME_GATEWAY_RUNNER_ID || defaultRunnerIdentity,
}) {
  const publicRecord = JSON.parse(await readFile(resolve(recordPath), "utf8"));
  const { encryptedBytes, ciphertextSource } = await loadMemWalCiphertext(publicRecord);
  const ciphertextDigest = `sha256:${sha256Hex(encryptedBytes)}`;

  if (ciphertextDigest !== publicRecord.ciphertextDigest) {
    throw userError("memWal ciphertext digest mismatch; refusing to decrypt");
  }

  const envelopeMetadata = readSealEnvelopeMetadata(encryptedBytes);
  const approval = approveSealAccess({
    agentId: publicRecord.agentId,
    hireReceiptObjectId,
    runnerIdentity,
    sealEncryptionId: publicRecord.encryptionId,
    sealPolicyId: publicRecord.policyId,
    sealMetadata: envelopeMetadata,
  });
  const plaintext = decryptSealEnvelope({
    encryptedBytes,
    encryptionId: publicRecord.encryptionId,
    approval,
  });
  const snapshot = JSON.parse(plaintext.toString("utf8"));

  if (snapshot.memoryDigest !== publicRecord.memoryDigest) {
    throw userError("memWal memory digest mismatch after decrypt");
  }

  return {
    status: "validated",
    agentId: publicRecord.agentId,
    kind: "memory_snapshot",
    platformManagedEncryption: true,
    gatewayOnlyDecrypt: true,
    ciphertextSource,
    encryption: {
      provider: envelopeMetadata.provider || publicRecord.encryptionProvider,
      ciphertextFormat: publicRecord.ciphertextFormat,
      platformKmsKeyId: envelopeMetadata.kmsKeyId || publicRecord.platformKmsKeyId,
      plaintextInWalrus: false,
    },
    safeSummary: summarizeMemory(snapshot.memory),
    runner: {
      identity: runnerIdentity,
      decryptedInRunnerOnly: true,
      privateMemoryReturnedToHirer: false,
      plaintextStoredInDb: false,
      returnedMemoryEntries: [],
    },
    approval,
  };
}

async function loadMemWalCiphertext(publicRecord) {
  if (
    publicRecord.storageProvider === "walrus" &&
    publicRecord.walrusBlobId
  ) {
    const walrusRead = await readWalrusBlobBytes({
      blobId: publicRecord.walrusBlobId,
      fileName: `${publicRecord.agentId}.memwal.json`,
    });
    return {
      encryptedBytes: walrusRead.bytes,
      ciphertextSource: {
        type: "walrus",
        blobId: publicRecord.walrusBlobId,
        cachePath: walrusRead.outPath,
        digest: walrusRead.digest,
        sizeBytes: walrusRead.sizeBytes,
      },
    };
  }

  if (publicRecord.localCiphertextPath) {
    const encryptedPath = resolve(publicRecord.localCiphertextPath);
    return {
      encryptedBytes: await readFile(encryptedPath),
      ciphertextSource: {
        type: "local-file",
        path: encryptedPath,
      },
    };
  }

  throw userError("memWal record has no readable ciphertext source");
}

function summarizeMemory(memory) {
  const entries = Array.isArray(memory.entries) ? memory.entries : [];
  const tags = new Set();
  for (const entry of entries) {
    for (const tag of Array.isArray(entry.tags) ? entry.tags : []) {
      tags.add(String(tag));
    }
  }

  return {
    title: memory.title || null,
    entryCount: entries.length,
    tags: Array.from(tags).slice(0, 20),
    safeCapabilities: Array.isArray(memory.safeCapabilities)
      ? memory.safeCapabilities.slice(0, 12)
      : [],
    rawMemoryReturned: false,
  };
}

function extractMemoryLeakMarkers(memory) {
  const markers = [];
  if (memory.title) markers.push(String(memory.title));
  for (const entry of Array.isArray(memory.entries) ? memory.entries : []) {
    if (entry.privateNote) markers.push(String(entry.privateNote));
    if (entry.text) markers.push(String(entry.text));
  }
  return markers.filter((marker) => marker.length >= 16);
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
