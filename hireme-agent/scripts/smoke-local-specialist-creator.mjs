#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDefaultTools } from "../runtime/src/tools.mjs";

const stateDir = resolve(".hireme/tmp/local-specialist-creator-smoke");
const specialistRoot = ".hireme/tmp/local-specialist-creator-smoke/agents";
const importedSpecialistRoot = ".hireme/tmp/local-specialist-creator-smoke/imported-agents";
const agentId = "smoke-image-specialist";

await rm(stateDir, { recursive: true, force: true });

try {
  const tools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
    localSpecialistOptions: {
      specialistRoot,
    },
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const expectedTool of [
    "hireme_create_local_specialist_agent",
    "hireme_list_local_specialist_agent_files",
    "hireme_update_local_specialist_agent_file",
    "hireme_export_local_specialist_agent",
    "hireme_import_local_specialist_agent",
    "hireme_validate_local_specialist_agent",
    "hireme_list_local_specialist_agents",
    "hireme_call_local_specialist_agent",
    "hireme_materialize_specialist_image_artifact",
  ]) {
    if (!byName.has(expectedTool)) {
      throw new Error(`Missing creator/local specialist tool: ${expectedTool}`);
    }
  }

  const created = await byName.get("hireme_create_local_specialist_agent").handler({
    agent_id: agentId,
    name: "Smoke Image Specialist",
    category: "Image",
    description: "Smoke-test HireMe-native image specialist template.",
    creator: "HireMe Smoke",
    headline: "Creates safe image specs through the HireMe specialist contract.",
    public_summary:
      "A smoke-test local image specialist created directly from the HireMe internal template.",
    template: "image_spec",
    skills: ["Image specification", "Identity locks", "Artifact validation"],
  });
  if (
    created.status !== "created" ||
    created.agent?.id !== agentId ||
    created.template !== "image_spec" ||
    !created.files.some((file) => file.path === "adapter/run.mjs") ||
    !created.files.some((file) => file.path === "private-source/AGENTS.md")
  ) {
    throw new Error("Creator tool did not create the expected HireMe-native image template.");
  }

  const files = await byName.get("hireme_list_local_specialist_agent_files").handler({
    agent_id: agentId,
  });
  if (
    files.count < 15 ||
    !files.files.some((file) => file.path === "harness/io-contract.md") ||
    files.files.some((file) => Object.hasOwn(file, "content"))
  ) {
    throw new Error("Creator file listing did not return the expected metadata-only file list.");
  }

  const update = await byName.get("hireme_update_local_specialist_agent_file").handler({
    agent_id: agentId,
    path: "skills/domain-checklist.md",
    content: [
      "# Domain Checklist",
      "",
      "- Confirm the image request is public-safe.",
      "- Preserve the creator-defined identity locks.",
      "- Return a local svg_preview plus imageSpec, never private prompt source.",
      "- Delegate final raster files to HireMe Runtime codex_image_gen image provider.",
    ].join("\n"),
    overwrite: true,
  });
  if (!update.overwritten || update.path !== "skills/domain-checklist.md" || !update.sha256) {
    throw new Error("Creator update tool did not overwrite the target skill file.");
  }

  const validation = await byName.get("hireme_validate_local_specialist_agent").handler({
    agent_id: agentId,
  });
  if (!validation.valid || validation.agent?.id !== agentId) {
    throw new Error("Generated local specialist Agent did not pass validation.");
  }

  const listed = await byName.get("hireme_list_local_specialist_agents").handler({
    query: "smoke image",
  });
  if (!listed.agents.some((agent) => agent.id === agentId)) {
    throw new Error("Generated local specialist Agent was not discoverable.");
  }

  const result = await byName.get("hireme_call_local_specialist_agent").handler({
    agent_id: agentId,
    task: "Create an image spec for a teal launch badge with no text.",
    response_mode: "artifact_spec",
  });
  const svgPreview = result.artifacts?.find((artifact) => artifact.kind === "svg_preview");
  if (
    result.schema !== "hireme.specialist_agent.output.v1" ||
    result.status !== "completed" ||
    result.responseMode !== "artifact_spec" ||
    !svgPreview?.content?.includes("<svg") ||
    !result.structuredResult?.imageSpec?.brief ||
    result.structuredResult?.imageSpec?.sourceHarness?.rasterProvider !== "codex_image_gen" ||
    result.structuredResult?.imageSpec?.sourceHarness?.directImageEndpointCall !== false ||
    /private-source\/AGENTS\.md|creator-only note|SECRET_|BEGIN_PRIVATE/i.test(
      JSON.stringify(result),
    )
  ) {
    throw new Error("Generated image specialist did not return a safe image spec envelope.");
  }

  const previewWrite = await byName.get("hireme_materialize_specialist_image_artifact").handler({
    specialist_result: result,
    provider: "auto",
    output_path: ".hireme/tmp/local-specialist-creator-smoke/preview.svg",
  });
  if (
    previewWrite.status !== "completed" ||
    previewWrite.provider !== "local_svg" ||
    previewWrite.mimeType !== "image/svg+xml" ||
    !previewWrite.path.endsWith(".svg")
  ) {
    throw new Error("Generated image specialist SVG preview was not materializable.");
  }

  const bridgeTools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
    enableLocalSpecialistTools: false,
    imageArtifactOptions: {
      codexImageGenCommand: process.execPath,
      codexImageGenArgs: ["scripts/fixtures/codex-image-gen-fixture.mjs"],
    },
  });
  const bridgeMaterialize = bridgeTools.find(
    (tool) => tool.name === "hireme_materialize_specialist_image_artifact",
  );
  const rasterWrite = await bridgeMaterialize.handler({
    specialist_result: result,
    provider: "codex_image_gen",
    output_path: ".hireme/tmp/local-specialist-creator-smoke/raster.png",
  });
  if (
    rasterWrite.status !== "completed" ||
    rasterWrite.provider !== "codex_image_gen" ||
    rasterWrite.mimeType !== "image/png" ||
    !rasterWrite.path.endsWith(".png")
  ) {
    throw new Error("Generated image specialist was not compatible with codex_image_gen bridge materialization.");
  }

  const exported = await byName.get("hireme_export_local_specialist_agent").handler({
    agent_id: agentId,
    output_path: ".hireme/tmp/local-specialist-creator-smoke/exports/smoke-image-specialist.hireme-agent.json",
    creator_id: "hireme-smoke-creator",
    current_user_id: "hireme-smoke-creator",
    overwrite: true,
  });
  if (
    exported.status !== "created" ||
    exported.schema !== "hireme.local_specialist.package.v1" ||
    exported.agent?.id !== agentId ||
    exported.packageMode !== "full" ||
    exported.includesPrivate !== true ||
    exported.ownership?.currentUserIsCreator !== true ||
    exported.protection?.localMaterialization !== "creator_only" ||
    exported.protection?.cachePolicy !== "creator_plaintext_cache_only" ||
    !exported.digest?.startsWith("sha256:") ||
    !exported.path.endsWith(".hireme-agent.json")
  ) {
    throw new Error("Local specialist export did not produce the expected package metadata.");
  }

  const exportedPackage = JSON.parse(await readFile(exported.path, "utf8"));
  if (
    exportedPackage.archiveFormat !== "tar.gz" ||
    !exportedPackage.archiveBase64 ||
    exportedPackage.files?.some((file) => Object.hasOwn(file, "contentBase64"))
  ) {
    throw new Error("Local specialist export did not use archive-based package payloads.");
  }

  const importTools = createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir,
    enableHireMeTools: true,
    localSpecialistOptions: {
      specialistRoot: importedSpecialistRoot,
    },
  });
  const importByName = new Map(importTools.map((tool) => [tool.name, tool]));
  const imported = await importByName.get("hireme_import_local_specialist_agent").handler({
    package_path: exported.path,
    current_user_id: "hireme-smoke-creator",
  });
  if (
    imported.status !== "created" ||
    imported.agent?.id !== agentId ||
    imported.schema !== "hireme.local_specialist.package.v1" ||
    imported.fileCount < 15 ||
    !imported.digest?.startsWith("sha256:")
  ) {
    throw new Error("Local specialist import did not restore the exported package.");
  }

  const importedValidation = await importByName.get("hireme_validate_local_specialist_agent").handler({
    agent_id: agentId,
  });
  if (!importedValidation.valid || importedValidation.agent?.id !== agentId) {
    throw new Error("Imported local specialist Agent did not pass validation.");
  }

  const importedResult = await importByName.get("hireme_call_local_specialist_agent").handler({
    agent_id: agentId,
    task: "Create an image spec for a gold launch badge with no text.",
    response_mode: "artifact_spec",
  });
  if (
    importedResult.schema !== "hireme.specialist_agent.output.v1" ||
    importedResult.status !== "completed" ||
    importedResult.responseMode !== "artifact_spec" ||
    !importedResult.artifacts?.some((artifact) => artifact.kind === "svg_preview")
  ) {
    throw new Error("Imported local specialist Agent was not callable.");
  }

  const thirdPartyPackage = {
    ...exportedPackage,
    ownership: {
      ...exportedPackage.ownership,
      creatorId: "third-party-creator",
      exportedBy: "third-party-creator",
      currentUserIsCreator: false,
    },
    protection: {
      ...exportedPackage.protection,
      visibility: "protected",
      localMaterialization: "creator_only",
      cachePolicy: "creator_plaintext_cache_only",
      executionMode: "local_if_creator_else_remote",
    },
  };
  delete thirdPartyPackage.integrity.packageDigest;
  thirdPartyPackage.integrity.packageDigest = `sha256:${sha256(stableStringify(thirdPartyPackage))}`;
  const thirdPartyPackagePath =
    ".hireme/tmp/local-specialist-creator-smoke/exports/third-party-smoke-image-specialist.hireme-agent.json";
  await writeFile(thirdPartyPackagePath, `${stableStringify(thirdPartyPackage)}\n`, "utf8");
  let blockedImport = false;
  try {
    await importByName.get("hireme_import_local_specialist_agent").handler({
      package_path: thirdPartyPackagePath,
      current_user_id: "hireme-smoke-creator",
      overwrite: true,
    });
  } catch (err) {
    blockedImport = err?.code === "local_materialization_forbidden";
  }
  if (!blockedImport) {
    throw new Error("Third-party protected package import was not blocked.");
  }

  console.log("Local specialist creator smoke passed");
  console.log(`Agent: ${agentId}`);
  console.log(`Folder: ${created.folderPath}`);
  console.log(`Package: ${exported.path}`);
  console.log("Verified: create template -> list files -> update file -> validate -> list -> call -> preview -> bridge -> export -> import -> call -> third-party import guard");
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch(() => {});
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}
