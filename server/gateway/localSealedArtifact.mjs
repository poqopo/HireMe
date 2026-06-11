import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const defaultRunnerIdentity = "hireme-local-protected-runner";
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
  const encryptionId = `hireme::agent-folder::${agentId}::${validation.folderManifestDigest.slice(7, 23)}`;
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
  const iv = randomBytes(12);
  const key = deriveLocalSealKey(encryptionId);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedObject = {
    format: "hireme.local-seal-ciphertext.v1",
    algorithm: "aes-256-gcm",
    encryptionId,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  const encryptedPayload = JSON.stringify(encryptedObject, null, 2);
  const encryptedBytes = Buffer.from(encryptedPayload, "utf8");
  const ciphertextDigest = `sha256:${sha256Hex(encryptedBytes)}`;
  const walrusBlobId = `local_walrus_${sha256Hex(encryptedBytes).slice(0, 32)}`;
  const suiObjectId = `0x${sha256Hex(`${walrusBlobId}:sui-object`).slice(0, 64)}`;

  await mkdir(outDir, { recursive: true });
  await mkdir(walrusDir, { recursive: true });

  const walrusPath = join(walrusDir, `${walrusBlobId}.seal.json`);
  const recordPath = join(outDir, `${agentId}.public-record.json`);

  await writeFile(walrusPath, encryptedPayload);

  const publicRecord = {
    format: "hireme.public-artifact-record.v1",
    agentId,
    network: process.env.WALRUS_NETWORK === "mainnet" ? "walrus-mainnet" : "walrus-testnet",
    sealPolicyId: `seal:local:${agentId}`,
    sealEncryptionId: encryptionId,
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
  const { publicRecord, bundle, approval, folderManifestDigest, paths } =
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
    walrusBlobVerified: true,
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

export async function runSealedArtifactTask({
  recordPath,
  walrusPath,
  hireReceiptObjectId,
  runnerIdentity = process.env.HIREME_GATEWAY_RUNNER_ID || defaultRunnerIdentity,
  task = "",
}) {
  const validation = await validateSealedArtifact({
    recordPath,
    walrusPath,
    hireReceiptObjectId,
    runnerIdentity,
  });
  const { publicRecord, bundle } = await decryptAndVerifyArtifact({
    recordPath,
    walrusPath,
    hireReceiptObjectId,
    runnerIdentity,
  });
  const result =
    publicRecord.agentId === "example-landing-designer"
      ? buildLandingPageBrief({ bundle, task })
      : buildGenericSealedTaskResult({ publicRecord, task });

  const safeResult = {
    status: "completed",
    gatewayOnlyDecrypt: true,
    agentId: publicRecord.agentId,
    taskDigest: `sha256:${sha256Hex(task)}`,
    validation,
    result,
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
  const encryptedPath = resolve(walrusPath || publicRecord.localWalrusPath);
  const encryptedBytes = await readFile(encryptedPath);
  const encryptedDigest = `sha256:${sha256Hex(encryptedBytes)}`;

  if (encryptedDigest !== publicRecord.ciphertextDigest) {
    throw userError("Ciphertext digest mismatch; refusing to decrypt");
  }

  const approval = approveLocalSealAccess({
    agentId: publicRecord.agentId,
    hireReceiptObjectId,
    runnerIdentity,
    sealEncryptionId: publicRecord.sealEncryptionId,
  });
  const bundle = decryptLocalSealObject({
    encryptedObject: JSON.parse(encryptedBytes.toString("utf8")),
    encryptionId: publicRecord.sealEncryptionId,
  });

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
    folderManifestDigest,
    paths,
  };
}

function approveLocalSealAccess({
  agentId,
  hireReceiptObjectId,
  runnerIdentity,
  sealEncryptionId,
}) {
  if (runnerIdentity !== defaultRunnerIdentity) {
    throw userError(`Runner identity is not approved: ${runnerIdentity}`);
  }

  if (!/^hire_receipt_[a-z0-9_-]+$/i.test(hireReceiptObjectId || "")) {
    throw userError("Missing or invalid paid hire receipt object id");
  }

  return {
    model: "local-seal-approval-simulation",
    agentId,
    sealEncryptionId,
    hireReceiptObjectId,
    runnerIdentity,
    txBytesDigest: `sha256:${sha256Hex(
      JSON.stringify({ agentId, hireReceiptObjectId, runnerIdentity, sealEncryptionId }),
    )}`,
    note:
      "Production replaces this with a Sui seal_approve transaction dry-run checked by Seal key servers.",
  };
}

function decryptLocalSealObject({ encryptedObject, encryptionId }) {
  if (encryptedObject.encryptionId !== encryptionId) {
    throw userError("Seal encryption id mismatch");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveLocalSealKey(encryptionId),
    Buffer.from(encryptedObject.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encryptedObject.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedObject.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

function readPublicContract(bundle) {
  const publicFile = bundle.files.find((file) => file.path === "public.json");
  if (!publicFile) return null;
  const publicJson = JSON.parse(Buffer.from(publicFile.contentBase64, "base64").toString("utf8"));
  return publicJson.publicContract || null;
}

function buildLandingPageBrief({ bundle, task }) {
  const designGuide = readBundleText(bundle, "design.md");
  const publicJson = readBundleJson(bundle, "public.json");
  const hasRequiredDesignGuide = Boolean(designGuide);

  if (!hasRequiredDesignGuide) {
    throw userError("Landing designer bundle is missing design.md");
  }

  return {
    type: "landing_page_brief",
    agent: publicJson.name || "Example Landing Designer",
    privateReferencesApplied: {
      agentsMd: true,
      designMd: true,
      rawDesignReturned: false,
    },
    request: {
      taskDigest: `sha256:${sha256Hex(task)}`,
      rawTaskReturned: false,
    },
    pageSections: [
      {
        name: "hero",
        guidance:
          "Open with a full-width pastel gradient mesh band, a thin-weight headline, one indigo pill CTA, and a dashboard/product mockup visible in the first viewport.",
      },
      {
        name: "proof",
        guidance:
          "Use a compact metrics strip with tabular numeric styling for counts, prices, or usage signals.",
      },
      {
        name: "features",
        guidance:
          "Use light feature cards paired with product UI panels rather than abstract illustrations.",
      },
      {
        name: "conversion",
        guidance:
          "Close with a restrained CTA band using a single filled indigo action and a secondary outline action when needed.",
      },
    ],
    visualSystem: {
      colors: {
        primary: "#533afd",
        ink: "#0d253d",
        canvasSoft: "#f6f9fc",
        brandDark: "#1c1e54",
        rubyAccent: "#ea2261",
      },
      typography:
        "Use Inter or Sohne-like thin display type at weight 300, negative tracking on display text, and tabular figures for numeric cells.",
      shapes:
        "Use pill buttons, 8-12px cards, and subtle product mockup shadows.",
    },
    componentGuidance: [
      "Use one primary filled indigo pill CTA per section.",
      "Create a dashboard-style mockup in deep navy or white chrome.",
      "Keep feature cards quiet, bordered, and text-led.",
      "Do not introduce unrelated accent colors or heavy display weights.",
    ],
    implementationNotes: [
      "The local Codex session should implement the page in the target repo; this gateway result is protected guidance, not a source file download.",
      "Any generated money, usage, or count cells should use font-feature-settings: \"tnum\".",
      "Verify mobile layout keeps the hero, CTA, and mockup readable without overlap.",
    ],
    verificationChecks: [
      "Hero includes gradient mesh treatment.",
      "Only one filled primary CTA appears in the hero band.",
      "Display text uses thin visual weight and tight tracking.",
      "The page includes a product/dashboard mockup, not a generic stock image.",
      "No private design.md or AGENTS.md text is returned.",
    ],
  };
}

function buildGenericSealedTaskResult({ publicRecord, task }) {
  return {
    type: "sealed_agent_result",
    agentId: publicRecord.agentId,
    taskDigest: `sha256:${sha256Hex(task)}`,
    rawTaskReturned: false,
    summary:
      "The protected runner validated the sealed folder and returned safe guidance without exposing private files.",
  };
}

function readBundleText(bundle, path) {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) return "";
  return Buffer.from(file.contentBase64, "base64").toString("utf8");
}

function readBundleJson(bundle, path) {
  const text = readBundleText(bundle, path);
  if (!text) return {};
  return JSON.parse(text);
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

function deriveLocalSealKey(encryptionId) {
  return createHash("sha256")
    .update(process.env.HIREME_LOCAL_SEAL_KEY || "hireme-local-dev-seal-key")
    .update(":")
    .update(encryptionId)
    .digest();
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
