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
    sealPolicyModel: sealMetadata.policyModel,
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
  const { publicRecord, bundle, sealMetadata, encryptedSource } = await decryptAndVerifyArtifact({
    recordPath,
    walrusPath,
    hireReceiptObjectId,
    runnerIdentity,
  });
  const result =
    publicRecord.agentId === "example-landing-designer"
      ? buildLandingPageBrief({ bundle, task })
      : publicRecord.agentId === "example-aster-x1-launcher"
        ? buildAsterX1PreorderPage({ bundle, task })
      : publicRecord.agentId === "example-code-reviewer"
        ? buildCodeReviewGuidance({ publicRecord, task })
      : buildGenericSealedTaskResult({ publicRecord, task });
  const harness = buildSafeHarnessContext({ bundle, publicRecord });
  const jsonOutput = buildProtectedAgentJsonOutput({
    publicRecord,
    task,
    result,
    harness,
    validation,
    runnerIdentity,
  });

  const safeResult = {
    status: "completed",
    gatewayOnlyDecrypt: true,
    agentId: publicRecord.agentId,
    taskDigest: `sha256:${sha256Hex(task)}`,
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
    validation,
    harness,
    jsonOutput,
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

function buildLandingPageBrief({ bundle, task }) {
  const designGuide = readBundleText(bundle, "design.md");
  const publicJson = readBundleJson(bundle, "public.json");
  const hasRequiredDesignGuide = Boolean(designGuide);
  const inputInterpretation = interpretLandingTask(task);

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
      task,
      taskDigest: `sha256:${sha256Hex(task)}`,
      rawTaskReturned: true,
    },
    inputInterpretation,
    pageSections: [
      {
        name: "hero",
        guidance:
          `Open with a full-width pastel gradient mesh band for ${inputInterpretation.productContext}, a thin-weight headline, one indigo pill CTA, and a product mockup visible in the first viewport.`,
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
      `Optimize the first CTA for ${inputInterpretation.conversionGoal}.`,
      `Shape the copy for ${inputInterpretation.targetAudience}.`,
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

function interpretLandingTask(task) {
  const normalized = String(task || "").toLowerCase();
  const mentionsPhone = /phone|mobile|핸드폰|휴대폰|스마트폰/.test(normalized);
  const mentionsBilling = /billing|usage|meter|invoice|pricing|사용량|과금|결제/.test(normalized);

  return {
    productContext: mentionsPhone
      ? "a premium mobile phone detail page"
      : mentionsBilling
        ? "a usage-based AI billing product"
        : "the requested product landing page",
    targetAudience: mentionsBilling
      ? "developers and operators evaluating AI usage costs"
      : "buyers comparing the product from the landing page",
    conversionGoal: mentionsPhone
      ? "product detail exploration and preorder clicks"
      : "qualified signup or demo conversion",
    inferredFromTask: true,
  };
}

function buildAsterX1PreorderPage({ bundle, task }) {
  const publicJson = readBundleJson(bundle, "public.json");
  const dossier = readBundleJson(bundle, "product-dossier.json");
  const playbook = readBundleJson(bundle, "launch-playbook.json");
  const visualHarness = readBundleJson(bundle, "visual-layout-harness.json");

  if (!dossier.productName || !playbook.campaignName || !visualHarness.compositionRules) {
    throw userError("Aster X1 launch bundle is missing product dossier, launch playbook, or visual layout harness");
  }

  return {
    type: "aster_x1_preorder_landing",
    agent: publicJson.name || "Example Aster X1 Launch Agent",
    privateReferencesApplied: {
      agentsMd: true,
      productDossier: true,
      launchPlaybook: true,
      visualLayoutHarness: true,
      preorderSkill: true,
      mobileConversionLayoutSkill: true,
      rawDossierReturned: false,
      rawPlaybookReturned: false,
      rawVisualHarnessReturned: false,
    },
    request: {
      task,
      taskDigest: `sha256:${sha256Hex(task)}`,
      rawTaskReturned: true,
    },
    productPositioning: {
      productName: dossier.productName,
      tagline: dossier.tagline,
      positioning: dossier.positioning,
      primaryAudience: playbook.primaryAudience,
      conversionGoal: playbook.conversionGoal,
      campaignName: playbook.campaignName,
      launchWindow: playbook.launchWindow,
    },
    visualSystem: {
      colors: dossier.colors,
      typography:
        "Use thin premium display type for headlines and tabular numerals for prices, storage, battery, and countdown values.",
      deviceStage:
        "Use a dark device stage with a three-quarter floating phone, visible camera island, and titanium rail.",
      accentRule:
        "Use Signal Green only for verified availability, savings, or preorder status.",
      layoutHarness: {
        name: visualHarness.name,
        intent: visualHarness.intent,
        radiusPx: visualHarness.visualRules?.radiusPx,
        headlineWeight: visualHarness.visualRules?.headlineWeight,
        primaryCtaShape: visualHarness.visualRules?.primaryCtaShape,
      },
    },
    heroComposition: {
      headline: "Aster X1 is open for First Signal preorders.",
      subhead:
        "A pocket cinema phone with pro-grade signal, two-day confidence, and repair pricing shown before checkout.",
      primaryCta: playbook.cta.primary,
      secondaryCta: playbook.cta.secondary,
      requiredElements: [
        "three-quarter product mockup",
        "72-hour preorder countdown",
        "$49 refundable deposit chip",
        "trade-in value chip",
        "single filled primary CTA",
      ],
      guidance: playbook.heroRule,
      mobileOrder: visualHarness.compositionRules.hero.mobileOrder,
      requiredAboveFold: visualHarness.compositionRules.hero.requiredAboveFold,
    },
    metricStrip: [
      { value: "48h", label: "adaptive battery target" },
      { value: "1-inch", label: "class main sensor" },
      { value: "29m", label: "fast-charge target" },
      { value: "$49", label: "refundable preorder deposit" },
    ],
    launchOfferStack: playbook.offerStack,
    preorderTiers: dossier.models,
    specHighlights: dossier.safeClaims,
    trustModules: playbook.proofModules,
    layoutRules: playbook.layoutRules,
    mobileLayoutSystem: {
      stickyPreorderBar: {
        required: visualHarness.compositionRules.mobileStickyCta.required === true,
        safeArea: visualHarness.compositionRules.mobileStickyCta.safeArea === true,
        content: visualHarness.compositionRules.mobileStickyCta.content,
      },
      sectionOrder: visualHarness.compositionRules.sections,
      mobileOrder: visualHarness.compositionRules.hero.mobileOrder,
      modelSelector: "mobile snap rail or single-column cards with 44px minimum tap targets",
      proofDensity:
        "Use compact number-first proof cells on mobile; avoid paragraph-heavy feature cards.",
    },
    implementationNotes: [
      "Render a real Aster X1 product-detail page, not a generic smartphone landing page.",
      "Put preorder economics, countdown, model tiers, and repair transparency before the final CTA.",
      "At mobile width, render a sticky preorder bar with safe-area padding and no section heading overlap.",
      "Use a device-stage hero and a mobile-first order rather than a desktop-only split hero.",
      "Use product-specific safe claims only; do not invent benchmark comparisons.",
      "Local Codex should implement from jsonOutput.payload and never request raw private dossier/playbook files.",
    ],
    responsiveChecks: visualHarness.mobileChecks,
    verificationChecks: [
      ...playbook.verificationChecks,
      ...visualHarness.mobileChecks,
    ],
    blockedClaims: dossier.avoid,
  };
}

function buildCodeReviewGuidance({ publicRecord, task }) {
  const interpretation = interpretCodeReviewTask(task);

  return {
    type: "code_review_guidance",
    agentId: publicRecord.agentId,
    inputInterpretation: interpretation,
    request: {
      task,
      taskDigest: `sha256:${sha256Hex(task)}`,
      rawTaskReturned: true,
    },
    findings: [
      {
        severity: "medium",
        title: "Inspect behavior-changing paths before editing",
        rationale:
          `The request appears to involve ${interpretation.reviewTarget}; local Codex should first read the relevant diff and call sites before proposing changes.`,
        localCodexAction:
          "Open the migration or code diff, identify changed runtime behavior, and report concrete file/line findings before broad refactors.",
      },
      {
        severity: "medium",
        title: "Verify rollback and data integrity assumptions",
        rationale:
          "Protected review guidance prioritizes migration safety, access-control drift, and data-loss risk.",
        localCodexAction:
          "Check whether the change has a reversible path, preserves existing rows, and has tests for the highest-risk path.",
      },
    ],
    safeSummary:
      "Use this as review guidance for the local workspace. The private rubric was applied inside the gateway, but private files were not returned.",
    testSuggestions: interpretation.testSuggestions,
    localCodexActionPlan: [
      "Read the relevant diff or migration files in the local repo.",
      "Return findings first, ordered by severity with file/line references.",
      "Run the narrowest relevant tests or explain why they cannot run.",
    ],
  };
}

function interpretCodeReviewTask(task) {
  const normalized = String(task || "").toLowerCase();
  const migration = /migration|schema|sql|db|database|supabase/.test(normalized);
  const auth = /auth|rls|policy|permission|access/.test(normalized);

  return {
    reviewTarget: migration
      ? "a database or migration diff"
      : "a code change",
    riskFocus: [
      migration ? "data integrity" : "correctness",
      auth ? "access control" : "regression coverage",
      "missing tests",
    ],
    testSuggestions: migration
      ? [
          "Run the migration against a disposable database.",
          "Check rollback or forward-fix behavior.",
          "Run any Supabase/RLS policy tests that touch changed tables.",
        ]
      : [
          "Run the focused unit or integration tests for changed code.",
          "Add a regression test for any behavior-changing finding.",
        ],
  };
}

function buildGenericSealedTaskResult({ publicRecord, task }) {
  return {
    type: "sealed_agent_result",
    agentId: publicRecord.agentId,
    request: {
      task,
      taskDigest: `sha256:${sha256Hex(task)}`,
      rawTaskReturned: true,
    },
    taskDigest: `sha256:${sha256Hex(task)}`,
    rawTaskReturned: true,
    summary:
      "The protected runner validated the sealed folder and returned safe guidance without exposing private files.",
  };
}

function buildSafeHarnessContext({ bundle, publicRecord }) {
  const publicJson = readBundleJson(bundle, "public.json");
  const policy = readBundleJson(bundle, "harness/policy.json");
  const paths = bundle.files.map((file) => file.path);

  return {
    runner: policy.runner || defaultRunnerIdentity,
    publicContract:
      policy.publicContract ||
      publicJson.publicContract ||
      readPublicContract(bundle),
    requiredPrivateReferences: safePolicyList(policy.requiredPrivateReferences),
    allowedOutputs: safePolicyList(policy.allowedOutputs),
    blockedOutputs: safePolicyList(policy.blockedOutputs),
    appliedPrivateReferences: {
      agentsMd: paths.includes("AGENTS.md"),
      designMd: paths.includes("design.md"),
      skillCount: paths.filter((path) => path.startsWith("skills/") && path.endsWith("SKILL.md")).length,
      harnessPolicy: paths.includes("harness/policy.json"),
    },
    artifact: {
      folderName: publicRecord.folderName,
      folderManifestDigest: publicRecord.folderManifestDigest,
      walrusBlobId: publicRecord.walrusBlobId,
      ciphertextDigest: publicRecord.ciphertextDigest,
      sealProvider: publicRecord.sealProvider || "legacy-local-aes-gcm",
      sealCiphertextFormat: publicRecord.ciphertextFormat || publicRecord.sealCiphertextFormat || "legacy",
      platformKmsKeyId: publicRecord.platformKmsKeyId || null,
      sealPackageId: publicRecord.sealPackageId || null,
      sealPolicyId: publicRecord.sealPolicyId,
      sealEncryptionId: publicRecord.sealEncryptionId,
      plaintextInWalrus: false,
    },
    rawHarnessReturned: false,
    rawAgentsReturned: false,
    rawSkillsReturned: false,
  };
}

function safePolicyList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) =>
      String(value)
        .replace(/decryption_key/gi, "decryption material")
        .replace(/contentBase64/gi, "encoded private file content"),
    )
    .filter(Boolean);
}

function buildProtectedAgentJsonOutput({
  publicRecord,
  task,
  result,
  harness,
  validation,
  runnerIdentity,
}) {
  return {
    schema: "hireme.protected_agent_json_output.v1",
    type: result.type || "protected_agent_guidance",
    generatedBy: "hireme-gateway",
    executionMode: "trusted-gateway-mvp",
    agent: {
      id: publicRecord.agentId,
      publicContract: harness.publicContract,
    },
    input: {
      task,
      taskDigest: `sha256:${sha256Hex(task)}`,
      plaintextTaskVisibleToGateway: true,
    },
    harness,
    payload: result,
    localCodex: {
      shouldAct: true,
      instruction:
        "Use jsonOutput.payload as the protected Agent guidance for local workspace changes. Do not ask for or fetch private creator files.",
      preferredSource: "jsonOutput.payload",
      blockedSources: ["AGENTS.md", "design.md", "skills/**", "harness/**"],
    },
    proof: {
      gatewayTrustedExecutor: true,
      runnerIdentity,
      gatewayOnlyDecrypt: validation.gatewayOnlyDecrypt === true,
      folderManifestDigest: validation.safeSummary?.folderManifestDigest || harness.artifact.folderManifestDigest,
      sealProvider: validation.sealEncryption?.provider || harness.artifact.sealProvider,
      sealPackageId: validation.sealEncryption?.packageId || harness.artifact.sealPackageId,
      sealApproveTarget: validation.sealEncryption?.sealApproveTarget || null,
      sealPolicyId: harness.artifact.sealPolicyId,
      walrusStoresCiphertextOnly: true,
      privateFolderReturnedToCodex: false,
    },
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
