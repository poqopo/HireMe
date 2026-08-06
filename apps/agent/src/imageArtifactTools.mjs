import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

const specialistOutputSchemaVersion = "hireme.specialist_agent.output.v1";
const codexImageGenRequestSchemaVersion = "hireme.codex_image_gen.request.v1";
const maxSvgBytes = 1024 * 1024;
const imageProviders = ["auto", "local_svg", "local_file", "codex_image", "codex_image_gen"];

export function createImageArtifactTools({
  workspaceDir = process.cwd(),
  specialistRoot = process.env.HIREME_LOCAL_SPECIALIST_ROOT ||
    "examples/local-specialist-agents",
  codexImageGenCommand = process.env.HIREME_CODEX_IMAGE_GEN_COMMAND || "",
  codexImageGenArgs = readJsonArrayEnv("HIREME_CODEX_IMAGE_GEN_ARGS"),
  codexImageGenTimeoutMs = readPositiveInteger(
    process.env.HIREME_CODEX_IMAGE_GEN_TIMEOUT_MS,
    120_000,
  ),
} = {}) {
  const workspaceRoot = resolve(workspaceDir);
  const localSpecialistRoot = resolve(workspaceRoot, specialistRoot);
  const codexImageGen = {
    command: String(codexImageGenCommand || "").trim(),
    args: Array.isArray(codexImageGenArgs) ? codexImageGenArgs.map(String) : [],
    timeoutMs: codexImageGenTimeoutMs,
  };
  return [
    {
      name: "hireme_validate_image_artifact",
      description:
        "Validate a specialist Agent image artifact before creating a workspace file. Returns validation only.",
      inputSchema: {
        type: "object",
        properties: {
          specialist_result: { type: "object" },
          artifact_index: { type: "integer" },
          artifact_kind: { type: "string" },
          provider: {
            type: "string",
            enum: imageProviders,
          },
        },
        required: ["specialist_result"],
      },
      handler: async (args = {}) =>
        validateSpecialistImageArtifact({
          codexImageGen,
          ...args,
        }),
    },
    {
      name: "hireme_materialize_specialist_image_artifact",
      description:
        "Create a workspace image file from a specialist Agent result after validating the returned artifact. The default provider materializes local SVG artifacts; codex_image_gen calls the configured image provider command.",
      inputSchema: {
        type: "object",
        properties: {
          specialist_result: { type: "object" },
          artifact_index: { type: "integer" },
          artifact_kind: { type: "string" },
          output_path: { type: "string" },
          provider: {
            type: "string",
            enum: imageProviders,
          },
          size: { type: "string" },
          mime_type: { type: "string" },
          overwrite: { type: "boolean" },
        },
        required: ["specialist_result"],
      },
      handler: async (args = {}, { signal } = {}) =>
        materializeSpecialistImageArtifact({
          workspaceRoot,
          localSpecialistRoot,
          codexImageGen,
          signal,
          ...args,
        }),
    },
  ];
}

export function validateSpecialistImageArtifact({
  specialist_result,
  specialistResult,
  artifact_index,
  artifactIndex,
  artifact_kind,
  artifactKind,
  provider = "auto",
  codexImageGen = {},
} = {}) {
  const specialistResultValue = specialist_result || specialistResult;
  const requestedProvider = normalizeProvider(provider);
  const artifact = findImageArtifact(specialistResultValue, {
    artifactIndex: artifact_index ?? artifactIndex,
    artifactKind: artifact_kind || artifactKind,
  });
  const imageSpec = specialistResultValue?.structuredResult?.imageSpec;
  const errors = [];
  const warnings = [];

  if (!specialistResultValue || typeof specialistResultValue !== "object") {
    errors.push("specialist_result must be an object.");
  } else {
    if (specialistResultValue.schema !== specialistOutputSchemaVersion) {
      errors.push(`specialist_result.schema must be ${specialistOutputSchemaVersion}.`);
    }
    if (specialistResultValue.status !== "completed") {
      warnings.push(`specialist_result.status is ${specialistResultValue.status || "missing"}.`);
    }
    if (containsProtectedLeak(JSON.stringify(specialistResultValue))) {
      errors.push("specialist_result appears to contain protected internal terms.");
    }
  }

  if (isCodexImageGenProvider(requestedProvider)) {
    const prompt = buildImagePrompt(specialistResultValue);
    if (!prompt) {
      errors.push("No imageSpec.brief or outputText was found for codex_image_gen.");
    }
    const commandConfigured = Boolean(codexImageGen?.command);
    return {
      type: "hireme_image_artifact_validation",
      provider: "codex_image_gen",
      status: errors.length
        ? "invalid"
        : commandConfigured
          ? "valid"
          : "provider_unavailable",
      valid: errors.length === 0 && commandConfigured,
      materializable: errors.length === 0 && commandConfigured,
      errors,
      warnings,
      imageSpec: imageSpec || null,
      bridgeConfigured: commandConfigured,
      nextAction:
        commandConfigured
          ? "Use hireme_materialize_specialist_image_artifact with provider=codex_image_gen."
          : "Run `hireme image-bridge set-openai-codex` or set HIREME_CODEX_IMAGE_GEN_COMMAND to a custom image provider command.",
    };
  }

  if (!artifact) {
    return {
      type: "hireme_image_artifact_validation",
      provider: requestedProvider,
      status: imageSpec ? "provider_required" : "invalid",
      valid: errors.length === 0 && Boolean(imageSpec),
      materializable: false,
      errors: imageSpec ? errors : [...errors, "No image artifact was found."],
      warnings,
      imageSpec: imageSpec || null,
      nextAction: imageSpec
        ? "Use a configured raster image provider to create the final image from imageSpec.brief."
        : "Ask the specialist Agent for an image artifact or image_spec result.",
    };
  }

  const mimeType = String(artifact.mimeType || artifact.mime_type || "").toLowerCase();
  const kind = String(artifact.kind || "").toLowerCase();
  const isSvg = mimeType === "image/svg+xml" || kind === "svg_preview" || kind === "svg";
  const artifactPath = getArtifactPath(artifact);
  const isLocalFileImage = Boolean(artifactPath) && mimeType.startsWith("image/");
  const effectiveProvider = requestedProvider === "auto"
    ? isSvg && typeof artifact.content === "string"
      ? "local_svg"
      : isLocalFileImage
        ? "local_file"
        : requestedProvider
    : requestedProvider;

  if (effectiveProvider === "local_svg") {
    if (!isSvg) {
      errors.push(`Unsupported local SVG artifact type: ${mimeType || kind || "unknown"}.`);
    }
    if (typeof artifact.content !== "string") {
      errors.push("Local SVG artifacts must include string content.");
    }
    if (isSvg && typeof artifact.content === "string") {
      const svgValidation = validateSvgContent(artifact.content);
      errors.push(...svgValidation.errors);
      warnings.push(...svgValidation.warnings);
    }
  } else if (effectiveProvider === "local_file") {
    if (!artifactPath) {
      errors.push("Local file image artifacts must include path or localPath.");
    }
    if (!mimeType.startsWith("image/")) {
      errors.push(`Unsupported local file image mime type: ${mimeType || "unknown"}.`);
    }
  } else {
    errors.push(`Unsupported image artifact provider: ${effectiveProvider}.`);
  }

  return {
    type: "hireme_image_artifact_validation",
    provider: effectiveProvider,
    status: errors.length ? "invalid" : "valid",
    valid: errors.length === 0,
    materializable: errors.length === 0 && (effectiveProvider === "local_svg" || effectiveProvider === "local_file"),
    errors,
    warnings,
    artifact: publicArtifactDescriptor(artifact),
  };
}

async function materializeSpecialistImageArtifact({
  workspaceRoot,
  localSpecialistRoot,
  codexImageGen = {},
  output_path,
  outputPath,
  size = "1024x1024",
  mime_type,
  mimeType,
  overwrite = false,
  signal,
  ...validationArgs
} = {}) {
  throwIfAborted(signal);
  const validation = validateSpecialistImageArtifact({
    codexImageGen,
    ...validationArgs,
  });
  if (!validation.valid || !validation.materializable) {
    return {
      type: "hireme_image_artifact_materialized",
      status: validation.status === "provider_unavailable" ? "blocked" : "invalid",
      validation,
      path: null,
      bytes: 0,
    };
  }

  if (validation.provider === "codex_image_gen") {
    return materializeCodexImageGenArtifact({
      workspaceRoot,
      localSpecialistRoot,
      codexImageGen,
      validation,
      outputPath: output_path || outputPath,
      overwrite,
      size,
      mimeType: mime_type || mimeType || "image/png",
      specialistResult: validationArgs.specialist_result || validationArgs.specialistResult,
      signal,
    });
  }

  if (validation.provider === "local_file") {
    return materializeLocalFileImageArtifact({
      workspaceRoot,
      validation,
      outputPath: output_path || outputPath,
      overwrite,
      specialistResult: validationArgs.specialist_result || validationArgs.specialistResult,
      artifactIndex: validationArgs.artifact_index ?? validationArgs.artifactIndex,
      artifactKind: validationArgs.artifact_kind || validationArgs.artifactKind,
      signal,
    });
  }

  const artifact = findImageArtifact(validationArgs.specialist_result || validationArgs.specialistResult, {
    artifactIndex: validationArgs.artifact_index ?? validationArgs.artifactIndex,
    artifactKind: validationArgs.artifact_kind || validationArgs.artifactKind,
  });
  const targetPath = output_path || outputPath || `artifacts/${safeImageFileName(artifact.filename)}`;
  if (wantsPngRaster({ targetPath, mimeType: mime_type || mimeType })) {
    return materializeLocalSvgRasterArtifact({
      workspaceRoot,
      validation,
      artifact,
      targetPath,
      overwrite,
      signal,
    });
  }
  if (/\.(jpe?g|webp)$/i.test(String(targetPath || ""))) {
    return blockedLocalSvgRasterResult({
      workspaceRoot,
      validation,
      targetPath,
      error:
        "Local SVG preview raster fallback currently supports PNG only. Use provider=codex_image_gen for JPEG/WebP, or use a .svg output_path for the fallback preview.",
    });
  }
  const filePath = await resolveWritablePath(workspaceRoot, targetPath);
  const existed = await stat(filePath)
    .then(() => true)
    .catch((err) => {
      if (err?.code === "ENOENT") return false;
      throw err;
    });

  if (existed && overwrite !== true) {
    return {
      type: "hireme_image_artifact_materialized",
      status: "blocked",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: 0,
      error: "File already exists. Pass overwrite=true to replace it.",
    };
  }

  const content = String(artifact.content || "");
  await writeFile(filePath, content, "utf8");
  return {
    type: "hireme_image_artifact_materialized",
    status: "completed",
    provider: validation.provider,
    validation,
    path: relative(workspaceRoot, filePath),
    bytes: Buffer.byteLength(content, "utf8"),
    mimeType: "image/svg+xml",
    created: !existed,
    overwritten: existed,
  };
}

async function materializeLocalSvgRasterArtifact({
  workspaceRoot,
  validation,
  artifact,
  targetPath,
  overwrite,
  signal,
}) {
  throwIfAborted(signal);
  const filePath = await resolveWritablePath(workspaceRoot, targetPath);
  const existed = await stat(filePath)
    .then(() => true)
    .catch((err) => {
      if (err?.code === "ENOENT") return false;
      throw err;
    });

  if (existed && overwrite !== true) {
    return {
      type: "hireme_image_artifact_materialized",
      status: "blocked",
      provider: "local_svg_raster",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: 0,
      error: "File already exists. Pass overwrite=true to replace it.",
    };
  }

  const tmpRoot = await mkdtemp(join(tmpdir(), "hireme-svg-raster-"));
  const svgPath = join(tmpRoot, "preview.svg");
  try {
    await writeFile(svgPath, String(artifact.content || ""), "utf8");
    const render = await renderSvgToPng(svgPath, filePath, tmpRoot, { signal });
    if (!render.ok) {
      return blockedLocalSvgRasterResult({
        workspaceRoot,
        validation,
        targetPath,
        error: render.error,
      });
    }
    const inspection = await inspectGeneratedImageFile(filePath);
    return {
      type: "hireme_image_artifact_materialized",
      status: "completed",
      provider: "local_svg_raster",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: inspection.bytes,
      mimeType: inspection.mimeType,
      created: !existed,
      overwritten: existed,
      renderer: render.renderer,
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function renderSvgToPng(svgPath, outputPath, tmpRoot, { signal } = {}) {
  await mkdir(dirname(outputPath), { recursive: true });
  const attempts = [
    {
      renderer: "rsvg-convert",
      command: "rsvg-convert",
      args: ["-w", "1024", "-h", "1024", "-o", outputPath, svgPath],
      resultPath: outputPath,
    },
    {
      renderer: "magick",
      command: "magick",
      args: [svgPath, outputPath],
      resultPath: outputPath,
    },
    {
      renderer: "convert",
      command: "convert",
      args: [svgPath, outputPath],
      resultPath: outputPath,
    },
    {
      renderer: "qlmanage",
      command: "qlmanage",
      args: ["-t", "-s", "1024", "-o", tmpRoot, svgPath],
      resultPath: `${svgPath}.png`,
      after: async (resultPath) => {
        await rename(resultPath, outputPath);
      },
    },
  ];

  const errors = [];
  for (const attempt of attempts) {
    throwIfAborted(signal);
    const result = await runRenderer(attempt.command, attempt.args, { signal });
    if (result.aborted) throw abortErrorFromSignal(signal);
    if (!result.ok) {
      errors.push(`${attempt.renderer}: ${result.error}`);
      continue;
    }
    try {
      if (attempt.after) await attempt.after(attempt.resultPath);
      await inspectGeneratedImageFile(outputPath);
      return { ok: true, renderer: attempt.renderer };
    } catch (err) {
      errors.push(`${attempt.renderer}: ${err?.message || String(err)}`);
    }
  }
  return {
    ok: false,
    error:
      "No local SVG-to-PNG renderer succeeded. Configure `hireme image-bridge set <command>` for final PNG generation, or install rsvg-convert/ImageMagick.",
    details: errors,
  };
}

function runRenderer(command, args, { signal } = {}) {
  return new Promise((resolveRun) => {
    if (signal?.aborted) {
      resolveRun({ ok: false, error: abortErrorFromSignal(signal).message, aborted: true });
      return;
    }
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.("abort", onAbort);
      resolveRun(result);
    };
    const onAbort = () => {
      child.kill("SIGTERM");
      settle({ ok: false, error: abortErrorFromSignal(signal).message, aborted: true });
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      settle({ ok: false, error: err?.message || String(err) });
    });
    child.on("exit", (exitCode) => {
      if (exitCode === 0) {
        settle({ ok: true });
        return;
      }
      settle({
        ok: false,
        error: stderr.trim() || `exit ${exitCode}`,
      });
    });
  });
}

function blockedLocalSvgRasterResult({ workspaceRoot, validation, targetPath, error }) {
  return {
    type: "hireme_image_artifact_materialized",
    status: "blocked",
    provider: "local_svg_raster",
    validation,
    path: targetPath ? relative(workspaceRoot, resolve(workspaceRoot, targetPath)) : null,
    bytes: 0,
    error,
  };
}

function wantsPngRaster({ targetPath, mimeType }) {
  return (
    /\.png$/i.test(String(targetPath || "")) ||
    String(mimeType || "").toLowerCase() === "image/png"
  );
}

async function materializeLocalFileImageArtifact({
  workspaceRoot,
  validation,
  outputPath,
  overwrite,
  specialistResult,
  artifactIndex,
  artifactKind,
  signal,
}) {
  throwIfAborted(signal);
  const artifact = findImageArtifact(specialistResult, { artifactIndex, artifactKind });
  const sourcePath = await resolveReadablePath(workspaceRoot, getArtifactPath(artifact));
  const sourceInspection = await inspectGeneratedImageFile(sourcePath);
  const targetPath =
    outputPath || `artifacts/${safeImageOutputFileName(artifact.filename || basename(sourcePath))}`;
  const filePath = await resolveWritablePath(workspaceRoot, targetPath);
  const existed = await stat(filePath)
    .then(() => true)
    .catch((err) => {
      if (err?.code === "ENOENT") return false;
      throw err;
    });

  if (existed && overwrite !== true) {
    return {
      type: "hireme_image_artifact_materialized",
      status: "blocked",
      provider: "local_file",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: 0,
      error: "File already exists. Pass overwrite=true to replace it.",
    };
  }

  const bytes = await readFile(sourcePath);
  await writeFile(filePath, bytes);
  const targetInspection = await inspectGeneratedImageFile(filePath);
  return {
    type: "hireme_image_artifact_materialized",
    status: "completed",
    provider: "local_file",
    validation,
    path: relative(workspaceRoot, filePath),
    sourcePath: relative(workspaceRoot, sourcePath),
    bytes: targetInspection.bytes,
    mimeType: targetInspection.mimeType || sourceInspection.mimeType,
    created: !existed,
    overwritten: existed,
  };
}

async function materializeCodexImageGenArtifact({
  workspaceRoot,
  localSpecialistRoot,
  codexImageGen,
  validation,
  outputPath,
  overwrite,
  size,
  mimeType,
  specialistResult,
  signal,
}) {
  throwIfAborted(signal);
  const prompt = buildImagePrompt(specialistResult);
  const targetPath = outputPath || `artifacts/${defaultRasterFileName(specialistResult)}`;
  const filePath = await resolveWritablePath(workspaceRoot, targetPath);
  let referenceImages = [];
  try {
    referenceImages = await collectReferenceImages(
      specialistResult,
      workspaceRoot,
      localSpecialistRoot,
    );
  } catch (err) {
    return {
      type: "hireme_image_artifact_materialized",
      status: "failed",
      provider: "codex_image_gen",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: 0,
      error: err?.message || String(err),
    };
  }
  const existed = await stat(filePath)
    .then(() => true)
    .catch((err) => {
      if (err?.code === "ENOENT") return false;
      throw err;
    });

  if (existed && overwrite !== true) {
    return {
      type: "hireme_image_artifact_materialized",
      status: "blocked",
      provider: "codex_image_gen",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: 0,
      error: "File already exists. Pass overwrite=true to replace it.",
    };
  }

  const request = {
    schema: codexImageGenRequestSchemaVersion,
    prompt,
    outputPath: filePath,
    outputPathRelative: relative(workspaceRoot, filePath),
    referenceImages,
    mimeType,
    size,
    source: {
      schema: specialistResult?.schema || null,
      agentId: specialistResult?.agentId || null,
      imageSpec: specialistResult?.structuredResult?.imageSpec || null,
    },
  };

  let commandResult = null;
  try {
    commandResult = await runCodexImageGenCommand(codexImageGen, request, { signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
    return {
      type: "hireme_image_artifact_materialized",
      status: "failed",
      provider: "codex_image_gen",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: 0,
      error: err?.message || String(err),
    };
  }

  const imageFile = await inspectGeneratedImageFile(filePath).catch((err) => ({
    ok: false,
    error: err?.message || String(err),
  }));
  if (!imageFile.ok) {
    return {
      type: "hireme_image_artifact_materialized",
      status: "failed",
      provider: "codex_image_gen",
      validation,
      path: relative(workspaceRoot, filePath),
      bytes: 0,
      error: imageFile.error || "Generated image file failed validation.",
      commandResult: publicCommandResult(commandResult),
    };
  }

  return {
    type: "hireme_image_artifact_materialized",
    status: "completed",
    provider: "codex_image_gen",
    validation,
    path: relative(workspaceRoot, filePath),
    bytes: imageFile.bytes,
    mimeType: imageFile.mimeType,
    created: !existed,
    overwritten: existed,
    commandResult: publicCommandResult(commandResult),
  };
}

function findImageArtifact(specialistResult, { artifactIndex, artifactKind } = {}) {
  const artifacts = Array.isArray(specialistResult?.artifacts)
    ? specialistResult.artifacts
    : [];
  if (Number.isInteger(artifactIndex) && artifacts[artifactIndex]) {
    return artifacts[artifactIndex];
  }
  if (artifactKind) {
    const requestedKind = String(artifactKind).toLowerCase();
    const matched = artifacts.find(
      (artifact) => String(artifact.kind || "").toLowerCase() === requestedKind,
    );
    if (matched) return matched;
  }
  return artifacts.find((artifact) => {
    const kind = String(artifact.kind || "").toLowerCase();
    const mimeType = String(artifact.mimeType || artifact.mime_type || "").toLowerCase();
    return (
      kind === "svg_preview" ||
      kind === "svg" ||
      kind === "image" ||
      mimeType.startsWith("image/")
    );
  });
}

function validateSvgContent(content) {
  const errors = [];
  const warnings = [];
  const text = String(content || "");
  const bytes = Buffer.byteLength(text, "utf8");

  if (bytes > maxSvgBytes) {
    errors.push(`SVG content is too large: ${bytes} bytes.`);
  }
  if (!/<svg[\s>]/i.test(text)) {
    errors.push("SVG content does not contain an <svg> root.");
  }
  if (/<script[\s>]/i.test(text)) {
    errors.push("SVG content must not include script elements.");
  }
  if (/<foreignObject[\s>]/i.test(text)) {
    errors.push("SVG content must not include foreignObject.");
  }
  if (/\son[a-z]+\s*=/i.test(text)) {
    errors.push("SVG content must not include inline event handlers.");
  }
  if (/(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:|javascript:)/i.test(text)) {
    errors.push("SVG content must not reference external, data, or javascript URLs.");
  }
  if (/<image[\s>]/i.test(text)) {
    warnings.push("SVG content includes an image element; prefer self-contained vector output.");
  }
  if (containsProtectedLeak(text)) {
    errors.push("SVG content appears to contain protected internal terms.");
  }
  return { errors, warnings };
}

function publicArtifactDescriptor(artifact) {
  if (!artifact) return null;
  return {
    kind: artifact.kind || null,
    filename: artifact.filename || null,
    mimeType: artifact.mimeType || artifact.mime_type || null,
    description: artifact.description || null,
    hasPath: Boolean(getArtifactPath(artifact)),
    hasContent: typeof artifact.content === "string",
  };
}

function normalizeProvider(provider) {
  const value = String(provider || "auto").trim().toLowerCase();
  if (imageProviders.includes(value)) return value;
  return "auto";
}

function isCodexImageGenProvider(provider) {
  return provider === "codex_image" || provider === "codex_image_gen";
}

function buildImagePrompt(specialistResult) {
  const imageSpec = specialistResult?.structuredResult?.imageSpec;
  if (imageSpec?.brief) {
    const lines = [imageSpec.brief];
    if (Array.isArray(imageSpec.referenceImages) && imageSpec.referenceImages.length) {
      lines.push(
        `Use the provided reference image file(s) as strict visual identity references: ${imageSpec.referenceImages
          .map((item) => item.path || item.localPath || item.local_path)
          .filter(Boolean)
          .join(", ")}.`,
      );
    }
    if (Array.isArray(imageSpec.lockedIdentity) && imageSpec.lockedIdentity.length) {
      lines.push(`Preserve: ${imageSpec.lockedIdentity.join(", ")}.`);
    }
    if (Array.isArray(imageSpec.forbidden) && imageSpec.forbidden.length) {
      lines.push(`Avoid: ${imageSpec.forbidden.join(", ")}.`);
    }
    return lines.join("\n");
  }
  return String(specialistResult?.outputText || "").trim();
}

async function collectReferenceImages(specialistResult, workspaceRoot, localSpecialistRoot) {
  const references = Array.isArray(specialistResult?.structuredResult?.imageSpec?.referenceImages)
    ? specialistResult.structuredResult.imageSpec.referenceImages
    : [];
  const collected = [];
  for (const reference of references) {
    const referencePath = reference?.path || reference?.localPath || reference?.local_path;
    if (!referencePath) continue;
    const filePath = await resolveReferenceImagePath({
      workspaceRoot,
      localSpecialistRoot,
      agentId: specialistResult?.agentId,
      referencePath,
    });
    const inspection = await inspectGeneratedImageFile(filePath);
    collected.push({
      role: reference.role || "reference",
      path: filePath,
      pathRelative: relative(workspaceRoot, filePath),
      mimeType: inspection.mimeType,
      bytes: inspection.bytes,
      instruction: reference.instruction || "",
    });
  }
  return collected;
}

async function resolveReferenceImagePath({
  workspaceRoot,
  localSpecialistRoot,
  agentId,
  referencePath,
}) {
  let workspaceError;
  try {
    return await resolveReadablePath(workspaceRoot, referencePath);
  } catch (err) {
    workspaceError = err;
  }

  const safeAgentId = String(agentId || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(safeAgentId)) {
    throw workspaceError;
  }
  const agentRoot = resolve(localSpecialistRoot, safeAgentId);
  const rootRelative = relative(localSpecialistRoot, agentRoot);
  if (rootRelative.startsWith("..") || /^[A-Za-z]:/.test(rootRelative)) {
    throw workspaceError;
  }

  const normalized = String(referencePath).replaceAll("\\", "/");
  const agentMarker = `examples/local-specialist-agents/${safeAgentId}/`;
  const markerIndex = normalized.indexOf(agentMarker);
  const agentRelativePath = markerIndex >= 0
    ? normalized.slice(markerIndex + agentMarker.length)
    : normalized.startsWith(`${safeAgentId}/`)
      ? normalized.slice(safeAgentId.length + 1)
      : normalized;
  try {
    return await resolveReadablePath(agentRoot, agentRelativePath);
  } catch {
    throw workspaceError;
  }
}

function defaultRasterFileName(specialistResult) {
  const artifact = findImageArtifact(specialistResult, { artifactKind: "image_spec" }) ||
    findImageArtifact(specialistResult, { artifactKind: "svg_preview" });
  const sourceName = artifact?.filename || `${specialistResult?.agentId || "specialist"}-image`;
  const stem = String(sourceName || "specialist-image")
    .replace(/\.(svg|json|png|jpe?g|webp)$/i, "")
    .replace(/[^\w가-힣.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "specialist-image";
  return `${stem}.png`;
}

function containsProtectedLeak(value) {
  return /OPENAI_API_KEY|sk-[A-Za-z0-9_-]{20,}|Private Calibration|CHARACTER_STYLE_PRESET|AGENTS\.md content|BEGIN PRIVATE|END PRIVATE|creator-only note:|scratchpad:/i.test(
    String(value || ""),
  );
}

function safeImageFileName(value) {
  const base = String(value || "specialist-image.svg")
    .replace(/[^\w가-힣.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const filename = base || "specialist-image.svg";
  return filename.toLowerCase().endsWith(".svg") ? filename : `${filename}.svg`;
}

function safeImageOutputFileName(value) {
  const filename = String(value || "specialist-image.png")
    .replace(/[^\w가-힣.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "specialist-image.png";
  if (/\.(png|jpe?g|webp|svg)$/i.test(filename)) return filename;
  return `${filename}.png`;
}

function getArtifactPath(artifact) {
  return artifact?.path || artifact?.localPath || artifact?.local_path || "";
}

async function runCodexImageGenCommand(
  { command, args = [], timeoutMs = 120_000 },
  request,
  { signal } = {},
) {
  if (!command) {
    throw Object.assign(new Error("HIREME_CODEX_IMAGE_GEN_COMMAND is not configured."), {
      code: "codex_image_gen_unconfigured",
    });
  }

  return new Promise((resolveRun, rejectRun) => {
    if (signal?.aborted) {
      rejectRun(abortErrorFromSignal(signal));
      return;
    }
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (fn) => {
      if (settled) return false;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener?.("abort", onAbort);
      fn();
      return true;
    };
    const timeout = setTimeout(() => {
      settle(() => {
        child.kill("SIGTERM");
        rejectRun(
          Object.assign(new Error("Codex image_gen bridge command timed out."), {
            code: "codex_image_gen_timeout",
          }),
        );
      });
    }, timeoutMs);
    const onAbort = () => {
      settle(() => {
        child.kill("SIGTERM");
        rejectRun(abortErrorFromSignal(signal));
      });
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      settle(() => rejectRun(err));
    });
    child.on("exit", (exitCode) => {
      settle(() => {
        if (exitCode !== 0) {
          rejectRun(
            Object.assign(
              new Error(
                `Codex image_gen bridge command failed with exit code ${exitCode}: ${stderr.trim()}`,
              ),
              { code: "codex_image_gen_failed", exitCode, stderr },
            ),
          );
          return;
        }
        resolveRun(parseCommandJson(stdout, stderr));
      });
    });

    child.stdin.end(`${JSON.stringify(request)}\n`);
  });
}

function parseCommandJson(stdout, stderr) {
  const text = String(stdout || "").trim();
  if (!text) return { status: "completed", stderr: String(stderr || "").trim() };
  try {
    return JSON.parse(text);
  } catch {
    return {
      status: "completed",
      stdout: text.slice(0, 2000),
      stderr: String(stderr || "").trim().slice(0, 2000),
    };
  }
}

function publicCommandResult(result) {
  if (!result || typeof result !== "object") return null;
  return {
    status: result.status || null,
    mimeType: result.mimeType || result.mime_type || null,
    provider: result.provider || null,
    model: result.model || null,
    auth: result.auth || null,
    transport: result.transport || null,
  };
}

async function inspectGeneratedImageFile(filePath) {
  const [fileStat, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  if (!fileStat.isFile() || fileStat.size <= 0) {
    throw new Error("Generated image file is empty or not a file.");
  }
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw new Error("Generated file is not a supported image type.");
  }
  return {
    ok: true,
    bytes: fileStat.size,
    mimeType,
  };
}

function detectImageMimeType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.slice(0, 4).toString("ascii") === "RIFF" &&
    bytes.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const text = bytes.slice(0, 256).toString("utf8");
  if (/<svg[\s>]/i.test(text)) return "image/svg+xml";
  return "";
}

function readJsonArrayEnv(name) {
  const raw = process.env[name];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw abortErrorFromSignal(signal);
}

function abortErrorFromSignal(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const err = new Error("Run cancelled.");
  err.name = "AbortError";
  err.code = "run_cancelled";
  err.cancelled = true;
  return err;
}

function isAbortError(err) {
  return Boolean(
    err &&
      (
        err.cancelled === true ||
        err.code === "run_cancelled" ||
        err.name === "AbortError"
      ),
  );
}

async function resolveWritablePath(root, candidate) {
  const rawPath = String(candidate || "").trim();
  if (!rawPath) {
    throw Object.assign(new Error("output_path is required"), { code: "missing_path" });
  }
  const target = resolve(root, rawPath);
  const lexicalRelative = relative(root, target);
  if (
    lexicalRelative === "" ||
    lexicalRelative.startsWith("..") ||
    /^[A-Za-z]:/.test(lexicalRelative)
  ) {
    throw Object.assign(new Error(`Path escapes workspace: ${candidate}`), {
      code: "path_outside_workspace",
    });
  }

  await mkdir(dirname(target), { recursive: true });
  const [realRoot, realParent] = await Promise.all([
    realpath(root).catch(() => root),
    realpath(dirname(target)),
  ]);
  if (realParent !== realRoot && !realParent.startsWith(`${realRoot}/`)) {
    throw Object.assign(new Error(`Path escapes workspace: ${candidate}`), {
      code: "path_outside_workspace",
    });
  }
  return target;
}

async function resolveReadablePath(root, candidate) {
  const rawPath = String(candidate || "").trim();
  if (!rawPath) {
    throw Object.assign(new Error("source image path is required"), { code: "missing_path" });
  }
  const target = resolve(root, rawPath);
  const [realRoot, realTarget] = await Promise.all([
    realpath(root).catch(() => root),
    realpath(target),
  ]);
  if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}/`)) {
    throw Object.assign(new Error(`Path escapes workspace: ${candidate}`), {
      code: "path_outside_workspace",
    });
  }
  return realTarget;
}
