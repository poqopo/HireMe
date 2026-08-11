#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createDesktopAgentAuthoringService } from "../electron/agentAuthoring.mjs";

const root = await mkdtemp(join(tmpdir(), "hireme-desktop-authoring-"));
const workspace = join(root, "workspace");
const userDataDir = join(root, "user-data");
const userId = "desktop-authoring-smoke-user";
const clientId = "desktop-authoring-smoke-client";
const bundledOwnershipChecks = [];

try {
  const service = createDesktopAgentAuthoringService({
    runtimeRoot: resolve("../.."),
    userDataDir,
    getWorkspace: () => workspace,
    assertBundledAgentOwnership: async ({ userId: checkedUserId, agentId }) => {
      bundledOwnershipChecks.push({ userId: checkedUserId, agentId });
      if (agentId !== "launch-brief-specialist") {
        throw Object.assign(new Error("not owner"), { code: "agent_management_forbidden" });
      }
    },
  });
  const created = await service.createDraft({
    userId,
    input: {
      agentId: "desktop-conversation-agent",
      name: "Desktop Conversation Agent",
      category: "Business",
      headline: "Turns client requests into a concise project brief.",
      summary: "Helps independent creators clarify scope, assumptions, deliverables, and next steps.",
      skills: ["Scope clarification", "Brief writing"],
      resultTypes: ["Project brief"],
    },
  });
  assert.equal(created.status, "created");
  assert.equal(created.revision, 1);
  const existingManagement = await service.prepareManagement({
    userId,
    clientId,
    input: {
      conversationId: "conversation-existing-management",
      agentId: created.agentId,
      name: "Desktop Conversation Agent",
      category: "Business",
      headline: "Turns client requests into a concise project brief.",
      summary: "Helps independent creators clarify scope, assumptions, deliverables, and next steps.",
    },
  });
  assert.equal(existingManagement.status, "ready");
  assert.equal(existingManagement.copiedFromBundle, false);
  assert.equal(existingManagement.managementSession.agentId, created.agentId);
  assert.equal(existingManagement.managementSession.conversationId, "conversation-existing-management");

  const managementRequest = {
    conversationId: existingManagement.conversationId,
    agentId: created.agentId,
    managementSessionId: existingManagement.managementSession.id,
  };
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
  const authorized = service.authorizeManagement({
    userId,
    clientId,
    input: managementRequest,
  });
  assert.equal(authorized.id, existingManagement.managementSession.id);
  assert.ok(
    Date.parse(authorized.expiresAt) > Date.parse(existingManagement.managementSession.expiresAt),
    "verified management activity should renew the session lease",
  );

  const privateFiles = await service.listPrivateHarnessFiles({
    userId,
    clientId,
    input: managementRequest,
  });
  assert.ok(privateFiles.files.some((file) => file.path === "AGENTS.md"));
  assert.ok(!privateFiles.files.some((file) => file.path === "public.json"));

  const privateHarness = await service.readPrivateHarnessFile({
    userId,
    clientId,
    input: { ...managementRequest, path: "AGENTS.md" },
  });
  assert.ok(privateHarness.content.includes("Private Harness"));
  assert.match(privateHarness.sha256, /^[a-f0-9]{64}$/);

  await assert.rejects(
    service.readPrivateHarnessFile({
      userId,
      clientId,
      input: { ...managementRequest, path: "public.json" },
    }),
    (error) => error?.code === "private_harness_path_required",
  );
  const privateSkillDir = join(
    userDataDir,
    "runtime",
    userId,
    "agents",
    created.agentId,
    "skills",
  );
  await mkdir(privateSkillDir, { recursive: true });
  await writeFile(join(privateSkillDir, "outside.txt"), "SYMLINK_PRIVATE_MARKER\n", "utf8");
  await symlink("outside.txt", join(privateSkillDir, "alias.md"));
  await assert.rejects(
    service.readPrivateHarnessFile({
      userId,
      clientId,
      input: { ...managementRequest, path: "skills/alias.md" },
    }),
    (error) => error?.code === "path_outside_agent",
  );
  await assert.rejects(
    service.updatePrivateHarnessFile({
      userId,
      clientId,
      input: {
        ...managementRequest,
        path: "skills/alias.md",
        content: "symlink overwrite\n",
        expectedSha256: privateHarness.sha256,
      },
    }),
    (error) => error?.code === "path_outside_agent",
  );
  assert.equal(await readFile(join(privateSkillDir, "outside.txt"), "utf8"), "SYMLINK_PRIVATE_MARKER\n");
  await rm(join(privateSkillDir, "alias.md"), { force: true });
  await assert.rejects(
    service.readPrivateHarnessFile({
      userId,
      clientId,
      input: { ...managementRequest, path: "../AGENTS.md" },
    }),
    (error) => error?.code === "private_harness_path_required",
  );
  assert.throws(
    () => service.authorizeManagement({
      userId: "another-user",
      clientId,
      input: managementRequest,
    }),
    (error) => error?.code === "management_session_mismatch",
  );
  assert.throws(
    () => service.authorizeManagement({
      userId,
      clientId: "another-client",
      input: managementRequest,
    }),
    (error) => error?.code === "management_session_mismatch",
  );

  const revocableClientId = "desktop-authoring-revocable-client";
  const revocableManagement = await service.prepareManagement({
    userId,
    clientId: revocableClientId,
    input: {
      conversationId: "conversation-client-revocation",
      agentId: created.agentId,
      name: "Desktop Conversation Agent",
      category: "Business",
      headline: "Turns client requests into a concise project brief.",
      summary: "Helps independent creators clarify scope, assumptions, deliverables, and next steps.",
    },
  });
  assert.deepEqual(service.revokeClientSessions({ clientId: revocableClientId }), { revoked: 1 });
  assert.throws(
    () => service.authorizeManagement({
      userId,
      clientId: revocableClientId,
      input: {
        conversationId: revocableManagement.conversationId,
        agentId: created.agentId,
        managementSessionId: revocableManagement.managementSession.id,
      },
    }),
    (error) => error?.code === "management_session_required",
  );

  const updatedHarness = await service.updatePrivateHarnessFile({
    userId,
    clientId,
    input: {
      ...managementRequest,
      path: "AGENTS.md",
      content: `${privateHarness.content.trimEnd()}\n\n- Management-session smoke rule.\n`,
      expectedSha256: privateHarness.sha256,
    },
  });
  assert.equal(updatedHarness.status, "updated");
  assert.ok(updatedHarness.revision > existingManagement.revision);
  await assert.rejects(
    service.updatePrivateHarnessFile({
      userId,
      clientId,
      input: {
        ...managementRequest,
        path: "AGENTS.md",
        content: privateHarness.content,
        expectedSha256: privateHarness.sha256,
      },
    }),
    (error) => error?.code === "hash_mismatch",
  );

  const studioSnapshot = await service.getStudioSnapshot({ userId, clientId, input: managementRequest });
  assert.equal(studioSnapshot.graphValidation.valid, true);
  assert.ok(studioSnapshot.graph.nodes.some((node) => node.id === "human-gate"));
  const guidedPatch = {
    middleOrder: ["decide", "analyze", "explore"],
    exploreEnabled: true,
    humanGateEnabled: true,
    maxRevisionAttempts: 3,
    skillRefs: Object.fromEntries(studioSnapshot.graph.nodes.map((node) => [node.id, node.skillRef])),
  };
  const graphPreview = await service.previewGraphPatch({
    userId,
    clientId,
    input: {
      ...managementRequest,
      expectedRevision: studioSnapshot.revision,
      expectedGraphDigest: studioSnapshot.graphValidation.digest,
      patch: guidedPatch,
    },
  });
  assert.equal(graphPreview.validation.valid, true);
  assert.equal(graphPreview.graph.budgets.maxRevisionAttempts, 3);
  const graphApplied = await service.applyGraphPatch({
    userId,
    clientId,
    input: {
      ...managementRequest,
      expectedRevision: studioSnapshot.revision,
      expectedGraphDigest: studioSnapshot.graphValidation.digest,
      patch: guidedPatch,
    },
  });
  assert.equal(graphApplied.status, "applied");
  assert.ok(graphApplied.revision > studioSnapshot.revision);
  await service.saveStudioLayout({
    userId,
    clientId,
    input: {
      ...managementRequest,
      layout: { positions: { intake: { x: 24, y: 48 } }, viewport: { x: 1, y: 2, zoom: 0.9 } },
    },
  });
  const studioReloaded = await service.getStudioSnapshot({ userId, clientId, input: managementRequest });
  assert.deepEqual(studioReloaded.layout.positions.intake, { x: 24, y: 48 });
  await assert.rejects(
    service.previewGraphPatch({
      userId,
      clientId,
      input: {
        ...managementRequest,
        expectedRevision: studioSnapshot.revision,
        expectedGraphDigest: studioSnapshot.graphValidation.digest,
        patch: guidedPatch,
      },
    }),
    (error) => error?.code === "agent_graph_revision_conflict",
  );

  const bundledManagement = await service.prepareManagement({
    userId,
    clientId,
    input: {
      conversationId: "conversation-bundled-management",
      agentId: "launch-brief-specialist",
      name: "Launch Brief Specialist",
      category: "Business",
      headline: "Creates launch briefs.",
      summary: "Turns a launch idea into a practical brief.",
    },
  });
  assert.equal(bundledManagement.status, "ready");
  assert.equal(bundledManagement.copiedFromBundle, true);
  assert.deepEqual(bundledOwnershipChecks, [{ userId, agentId: "launch-brief-specialist" }]);
  await assert.rejects(
    service.prepareManagement({
      userId,
      clientId,
      input: {
        conversationId: "conversation-unowned-bundle",
        agentId: "dokpami-create-agent",
        name: "Unowned Agent",
        category: "Other",
        headline: "Must remain private.",
        summary: "Ownership denial smoke.",
      },
    }),
    (error) => error?.code === "agent_management_forbidden",
  );

  const published = await service.publishDraft({
    userId,
    clientId,
    input: {
      ...managementRequest,
      version: "0.1.0",
    },
  });
  assert.equal(published.status, "published");
  assert.equal(published.includesPrivateHarness, true);
  assert.equal(published.memory?.bootstrap?.included, true);
  const packageText = await readFile(published.packagePath, "utf8");
  const packageDocument = JSON.parse(packageText);
  assert.ok(packageDocument.files.some((file) => file.path === "AGENTS.md"));
  assert.ok(packageDocument.files.some((file) => file.path === "memory/bootstrap.jsonl"));
  assert.ok(packageDocument.archiveBase64 || packageDocument.archive?.base64);
  const publication = await service.recordPublication({
    userId,
    agentId: created.agentId,
    harnessRevision: "0.1.0",
    packageDigest: published.packageDigest,
    agentVersionId: "version-smoke",
    packagePath: published.packagePath,
  });
  const snapshotHarnessPath = join(publication.snapshotRoot, created.agentId, "AGENTS.md");
  const snapshottedHarness = await readFile(snapshotHarnessPath, "utf8");
  assert.ok(snapshottedHarness.includes("Management-session smoke rule"));
  await writeFile(join(service.pathsForUser(userId).specialistRoot, created.agentId, "AGENTS.md"), "edited after publication\n", "utf8");
  assert.equal(await readFile(snapshotHarnessPath, "utf8"), snapshottedHarness);
  await writeFile(join(service.pathsForUser(userId).specialistRoot, created.agentId, "AGENTS.md"), snapshottedHarness, "utf8");
  const receipt = JSON.parse(await readFile(join(publication.snapshotRoot, created.agentId, ".hireme-published.json"), "utf8"));
  assert.equal(receipt.packageDigest, published.packageDigest);

  assert.throws(
    () => service.authorizeManagement({ userId, clientId, input: managementRequest }),
    (error) => error?.code === "management_session_required",
  );
  const clientBoundSession = await service.prepareManagement({
    userId,
    clientId,
    input: {
      conversationId: "conversation-client-revoke",
      agentId: created.agentId,
      name: "Desktop Conversation Agent",
      category: "Business",
      headline: "Turns client requests into a concise project brief.",
      summary: "Client session revocation smoke.",
    },
  });
  const rotatedClientSession = await service.prepareManagement({
    userId,
    clientId,
    input: {
      conversationId: "conversation-client-revoke",
      agentId: created.agentId,
      name: "Desktop Conversation Agent",
      category: "Business",
      headline: "Turns client requests into a concise project brief.",
      summary: "Rotated client session smoke.",
    },
  });
  assert.throws(
    () => service.authorizeManagement({
      userId,
      clientId,
      input: {
        conversationId: clientBoundSession.conversationId,
        agentId: created.agentId,
        managementSessionId: clientBoundSession.managementSession.id,
      },
    }),
    (error) => error?.code === "management_session_required",
  );
  assert.equal(service.authorizeManagement({
    userId,
    clientId,
    input: {
      conversationId: rotatedClientSession.conversationId,
      agentId: created.agentId,
      managementSessionId: rotatedClientSession.managementSession.id,
    },
  }).id, rotatedClientSession.managementSession.id);
  assert.equal(service.revokeClientSessions({ clientId }).revoked, 2);
  assert.throws(
    () => service.authorizeManagement({
      userId,
      clientId,
      input: {
        conversationId: rotatedClientSession.conversationId,
        agentId: created.agentId,
        managementSessionId: rotatedClientSession.managementSession.id,
      },
    }),
    (error) => error?.code === "management_session_required",
  );

  process.stdout.write("Desktop Agent authoring smoke passed.\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
