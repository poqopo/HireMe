import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import {
  approveSealAccess,
  assertCiphertextDoesNotContainPlaintext,
  buildLocalSealPolicyId,
  buildSealEncryptionId,
  decryptSealEnvelope,
  defaultRunnerIdentity,
  encryptWithSealEnvelope,
  platformEncryptionFormat,
  readSealEnvelopeMetadata,
} from "./sealEnvelope.mjs";
import { readWalrusBlobBytes } from "./walrusBlobStore.mjs";

const defaultArtifactsDir = ".hireme/artifacts";
const defaultWalrusDir = ".hireme/local-walrus";

export async function sealAgentFolder({
  folderPath,
  agentId,
  epochs = 3,
  pricePerCallUsd = 0.028,
  outDir = defaultArtifactsDir,
  walrusDir = defaultWalrusDir,
}) {
  const resolvedFolder = resolve(folderPath);
  const validation = await validateAgentFolder(resolvedFolder);
  const encryptionId = buildSealEncryptionId({
    agentId,
    folderManifestDigest: validation.folderManifestDigest,
  });
  const sealPolicyId = buildLocalSealPolicyId(agentId);
  const bundle = {
    format: "hireme.local-sealed-agent-folder.v1",
    agentId,
    sourceFolderName: basename(resolvedFolder),
    createdAt: new Date().toISOString(),
    manifest: validation.manifest,
    files: await Promise.all(
      validation.files.map(async (file) => ({
        path: file.path,
        size: file.size,
        digest: file.digest,
        contentBase64: (await readFile(join(resolvedFolder, file.path))).toString("base64"),
      })),
    ),
  };
  const plaintext = Buffer.from(JSON.stringify(bundle), "utf8");
  const {
    encryptedBytes,
    sealMetadata,
  } = await encryptWithSealEnvelope({
    plaintext,
    agentId,
    encryptionId,
    sealPolicyId,
  });
  const ciphertextDigest = `sha256:${sha256Hex(encryptedBytes)}`;
  const walrusBlobId = `local_walrus_${sha256Hex(encryptedBytes).slice(0, 32)}`;
  const suiObjectId = `0x${sha256Hex(`${walrusBlobId}:sui-object`).slice(0, 64)}`;

  await mkdir(outDir, { recursive: true });
  await mkdir(walrusDir, { recursive: true });

  const walrusPath = join(walrusDir, `${walrusBlobId}.platform-encryption.json`);
  const recordPath = join(outDir, `${agentId}.public-record.json`);

  assertCiphertextDoesNotContainPlaintext({
    encryptedBytes,
    blockedPlaintextMarkers: bundle.files.flatMap((file) => {
      const content = Buffer.from(file.contentBase64, "base64").toString("utf8");
      const firstMeaningfulLine = content
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length >= 16);
      return [file.path, firstMeaningfulLine].filter(Boolean);
    }),
  });
  await writeFile(walrusPath, encryptedBytes);

  const publicRecord = {
    format: "hireme.public-artifact-record.v1",
    agentId,
    network: process.env.WALRUS_NETWORK === "mainnet" ? "walrus-mainnet" : "walrus-testnet",
    encryptionProvider: sealMetadata.provider,
    platformKmsKeyId: sealMetadata.kmsKeyId,
    ciphertextFormat: platformEncryptionFormat,
    policyId: sealPolicyId,
    sealProvider: sealMetadata.provider,
    sealPolicyId,
    sealEncryptionId: encryptionId,
    sealPackageId: sealMetadata.packageId,
    sealApproveTarget: sealMetadata.sealApproveTarget,
    sealThreshold: sealMetadata.threshold,
    sealKeyServerIds: sealMetadata.keyServerIds,
    sealPolicyMode: sealMetadata.policyMode || sealMetadata.policyModel,
    sealCiphertextFormat: platformEncryptionFormat,
    walrusBlobId,
    walrusSuiObjectId: suiObjectId,
    ciphertextDigest,
    ciphertextSizeBytes: encryptedBytes.length,
    folderManifestDigest: validation.folderManifestDigest,
    folderName: basename(resolvedFolder),
    manifestEntries: validation.files.map(({ path, size, digest }) => ({
      path,
      size,
      digest,
    })),
    localWalrusPath: walrusPath,
    storageEpochs: epochs,
    pricePerCallUsd,
    createdAt: new Date().toISOString(),
    plaintextStoredInDb: false,
    plaintextReturnedToHirer: false,
  };

  assertNoPlaintextLeak(publicRecord);
  await writeFile(recordPath, JSON.stringify(publicRecord, null, 2));

  return {
    status: "sealed",
    recordPath,
    walrusPath,
    publicRecord,
    validation,
  };
}

export async function validateAgentFolder(folderPath) {
  const resolvedFolder = resolve(folderPath);
  const folderStats = await stat(resolvedFolder).catch(() => null);
  if (!folderStats?.isDirectory()) {
    throw userError(`Agent folder does not exist: ${resolvedFolder}`);
  }

  const files = await listFiles(resolvedFolder);
  const paths = files.map((file) => file.path);

  if (!paths.includes("AGENTS.md")) {
    throw userError("Protected agent folder must include AGENTS.md");
  }

  if (!paths.some((path) => path.startsWith("skills/") && path.endsWith("SKILL.md"))) {
    throw userError("Protected agent folder must include at least one skills/**/SKILL.md file");
  }

  if (!paths.includes("public.json")) {
    throw userError("Protected agent folder must include public.json for marketplace metadata");
  }

  for (const blockedPath of paths) {
    if (
      blockedPath === ".env" ||
      blockedPath.startsWith(".env.") ||
      blockedPath.includes("/.env") ||
      blockedPath.includes("node_modules/")
    ) {
      throw userError(`Refusing to seal unsafe path: ${blockedPath}`);
    }
  }

  const manifest = {
    format: "hireme.agent-folder-manifest.v1",
    folderName: basename(resolvedFolder),
    fileCount: files.length,
    files: files.map(({ path, size, digest }) => ({ path, size, digest })),
  };
  const folderManifestDigest = `sha256:${sha256Hex(JSON.stringify(manifest))}`;

  return {
    ok: true,
    folderPath: resolvedFolder,
    requiredFiles: {
      agentsMd: true,
      publicMetadata: true,
      skillCount: paths.filter((path) => path.startsWith("skills/") && path.endsWith("SKILL.md")).length,
    },
    fileCount: files.length,
    files,
    manifest,
    folderManifestDigest,
  };
}

export async function validateSealedArtifact({
  recordPath,
  walrusPath,
  hireReceiptObjectId,
  runnerIdentity = process.env.HIREME_GATEWAY_RUNNER_ID || defaultRunnerIdentity,
}) {
  const { publicRecord, bundle, approval, sealMetadata, encryptedSource, folderManifestDigest, paths } =
    await decryptAndVerifyArtifact({
      recordPath,
      walrusPath,
      hireReceiptObjectId,
      runnerIdentity,
    });

  const safeResult = {
    status: "validated",
    agentId: publicRecord.agentId,
    gatewayOnlyDecrypt: true,
    hireReceiptVerified: true,
    runnerApproved: true,
    sealPolicyApproved: true,
    platformAccessApproved: true,
    walrusBlobVerified: true,
    sealEncryption: {
      provider: sealMetadata.provider || publicRecord.sealProvider || "unknown",
      ciphertextFormat: publicRecord.ciphertextFormat || publicRecord.sealCiphertextFormat || "legacy",
      packageId: sealMetadata.packageId || publicRecord.sealPackageId || null,
      sealApproveTarget: sealMetadata.sealApproveTarget || null,
      policyId: publicRecord.sealPolicyId,
      encryptionId: publicRecord.sealEncryptionId,
      threshold: sealMetadata.threshold ?? publicRecord.sealThreshold ?? null,
      keyServerIds: sealMetadata.keyServerIds || publicRecord.sealKeyServerIds || [],
      platformKmsKeyId: sealMetadata.kmsKeyId || publicRecord.platformKmsKeyId || null,
      plaintextInWalrus: false,
    },
    ciphertextSource: encryptedSource,
    folderManifestDigest,
    safeSummary: {
      folderName: publicRecord.folderName,
      fileCount: bundle.files.length,
      skillCount: paths.filter((path) => path.startsWith("skills/") && path.endsWith("SKILL.md")).length,
      publicContract: readPublicContract(bundle),
    },
    runner: {
      identity: runnerIdentity,
      decryptedInRunnerOnly: true,
      privateFolderReturnedToHirer: false,
      plaintextStoredInDb: false,
      returnedFiles: [],
    },
    approval,
  };

  assertNoPlaintextLeak(safeResult);
  return safeResult;
}

export async function loadPublicRecord(recordPath) {
  return JSON.parse(await readFile(resolve(recordPath), "utf8"));
}

async function decryptAndVerifyArtifact({
  recordPath,
  walrusPath,
  hireReceiptObjectId,
  runnerIdentity,
}) {
  const publicRecord = JSON.parse(await readFile(resolve(recordPath), "utf8"));
  const { encryptedBytes, encryptedSource } = await loadEncryptedArtifactBytes({
    publicRecord,
    walrusPath,
  });
  const encryptedDigest = `sha256:${sha256Hex(encryptedBytes)}`;
  const sealMetadata = readSealEnvelopeMetadata(encryptedBytes);

  if (encryptedDigest !== publicRecord.ciphertextDigest) {
    throw userError("Ciphertext digest mismatch; refusing to decrypt");
  }

  if (sealMetadata.encryptionId && sealMetadata.encryptionId !== publicRecord.sealEncryptionId) {
    throw userError("Seal metadata encryption id mismatch");
  }

  const approval = approveSealAccess({
    agentId: publicRecord.agentId,
    hireReceiptObjectId,
    runnerIdentity,
    sealEncryptionId: publicRecord.sealEncryptionId,
    sealPolicyId: publicRecord.sealPolicyId,
    sealMetadata,
  });
  const plaintext = decryptSealEnvelope({
    encryptedBytes,
    encryptionId: publicRecord.sealEncryptionId,
    approval,
  });
  const bundle = JSON.parse(plaintext.toString("utf8"));

  const reconstructedManifest = {
    format: "hireme.agent-folder-manifest.v1",
    folderName: bundle.sourceFolderName,
    fileCount: bundle.files.length,
    files: bundle.files.map(({ path, size, digest }) => ({ path, size, digest })),
  };
  const folderManifestDigest = `sha256:${sha256Hex(JSON.stringify(reconstructedManifest))}`;

  if (folderManifestDigest !== publicRecord.folderManifestDigest) {
    throw userError("Folder manifest digest mismatch after gateway decrypt");
  }

  for (const file of bundle.files) {
    const content = Buffer.from(file.contentBase64, "base64");
    const digest = `sha256:${sha256Hex(content)}`;
    if (digest !== file.digest) {
      throw userError(`File digest mismatch after decrypt: ${file.path}`);
    }
  }

  const paths = bundle.files.map((file) => file.path);
  if (!paths.includes("AGENTS.md")) {
    throw userError("Decrypted bundle is missing AGENTS.md");
  }

  return {
    publicRecord,
    bundle,
    approval,
    sealMetadata,
    encryptedSource,
    folderManifestDigest,
    paths,
  };
}

async function loadEncryptedArtifactBytes({ publicRecord, walrusPath }) {
  if (walrusPath) {
    const encryptedPath = resolve(walrusPath);
    return {
      encryptedBytes: await readFile(encryptedPath),
      encryptedSource: {
        type: "local-file",
        path: encryptedPath,
      },
    };
  }

  if (
    publicRecord.storageProvider === "walrus" &&
    publicRecord.walrusBlobId &&
    !String(publicRecord.walrusBlobId).startsWith("local_walrus_")
  ) {
    const walrusRead = await readWalrusBlobBytes({
      blobId: publicRecord.walrusBlobId,
      fileName: `${publicRecord.agentId || "agent"}.platform-encryption.json`,
    });
    return {
      encryptedBytes: walrusRead.bytes,
      encryptedSource: {
        type: "walrus",
        blobId: publicRecord.walrusBlobId,
        cachePath: walrusRead.outPath,
        digest: walrusRead.digest,
        sizeBytes: walrusRead.sizeBytes,
      },
    };
  }

  if (publicRecord.localWalrusPath) {
    const encryptedPath = resolve(publicRecord.localWalrusPath);
    return {
      encryptedBytes: await readFile(encryptedPath),
      encryptedSource: {
        type: "local-walrus-cache",
        path: encryptedPath,
      },
    };
  }

  throw userError("Public artifact record has no readable Walrus ciphertext source");
}

function readPublicContract(bundle) {
  const publicFile = bundle.files.find((file) => file.path === "public.json");
  if (!publicFile) return null;
  const publicJson = JSON.parse(Buffer.from(publicFile.contentBase64, "base64").toString("utf8"));
  return publicJson.publicContract || null;
}

async function listFiles(root) {
  const results = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const fullPath = join(dir, entry.name);
      const localPath = normalizePath(relative(root, fullPath));
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = await readFile(fullPath);
      results.push({
        path: localPath,
        size: bytes.length,
        digest: `sha256:${sha256Hex(bytes)}`,
      });
    }
  }

  await walk(root);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function assertNoPlaintextLeak(value) {
  const serialized = JSON.stringify(value);
  const blocked = [
    "Private Operating Notes",
    "Hidden Scoring Criteria",
    "contentBase64",
    "AGENTS.md content",
    "decryption_key",
  ];
  const leaked = blocked.find((text) => serialized.includes(text));
  if (leaked) {
    throw userError(`Safe response contains blocked plaintext marker: ${leaked}`);
  }
}

function normalizePath(path) {
  return path.split("\\").join("/");
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
