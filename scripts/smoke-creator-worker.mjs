#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCreatorWorkerService,
  createWorkerIdentity,
  decryptCreatorBackup,
  encryptCreatorBackup,
} from "../apps/desktop/creatorWorker.mjs";
import { evaluateMachineContract } from "../apps/desktop/creatorWorkerExecutor.mjs";

const tempRoot = await mkdtemp(join(tmpdir(), "hireme-creator-worker-smoke-"));
const workerId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const agentId = "44444444-4444-4444-8444-444444444444";

try {
  const packageDigest = `sha256:${"a".repeat(64)}`;
  const packageBytes = Buffer.from(JSON.stringify({
    schema: "hireme.local_specialist.package.v1",
    integrity: { packageDigest },
  }));
  const identity = createWorkerIdentity();
  const encrypted = encryptCreatorBackup({ packageBytes, packageDigest, identity });
  assert.equal(JSON.parse(encrypted.bytes.toString("utf8")).packageDigest, packageDigest);
  const decrypted = decryptCreatorBackup({ envelopeBytes: encrypted.bytes, identity });
  assert.equal(decrypted.packageBytes.toString("utf8"), packageBytes.toString("utf8"));
  decrypted.packageBytes.fill(0);
  encrypted.bytes.fill(0);

  const previewArtifacts = [];
  for (let index = 0; index < 3; index += 1) {
    const bytes = Buffer.alloc(25);
    Buffer.from("89504e470d0a1a0a", "hex").copy(bytes, 0);
    bytes.writeUInt32BE(1080, 16);
    bytes.writeUInt32BE(1350, 20);
    bytes[24] = index;
    const path = join(tempRoot, `direction-${index + 1}.png`);
    await writeFile(path, bytes);
    previewArtifacts.push({ path, name: `direction-${index + 1}.png`, kind: "preview", mimeType: "image/png" });
  }
  const rationalePath = join(tempRoot, "rationale.json");
  await writeFile(rationalePath, "{}");
  const machineEvaluation = await evaluateMachineContract([
    ...previewArtifacts,
    { path: rationalePath, name: "rationale.json", kind: "rationale", mimeType: "application/json" },
  ], { deliverables: [{ dimensions: "1080x1350" }] });
  assert.equal(machineEvaluation.verdict, "pass");
  assert.equal(machineEvaluation.scores.distinctPreviewCount, 3);

  const artifactPath = join(tempRoot, "preview.png");
  await writeFile(artifactPath, Buffer.from("creator-worker-preview"));
  let claimed = false;
  let completed = false;
  let uploaded = false;
  let available = false;
  const invocations = [];
  const client = {
    functions: {
      async invoke(name, { body }) {
        assert.equal(name, "creator-worker");
        invocations.push(body.action);
        if (body.action === "register") return { data: { worker: { id: workerId, availability: available ? "available" : "unavailable", status: "active" } }, error: null };
        if (body.action === "state") return { data: { workers: [{ id: workerId, availability: available ? "available" : "unavailable", health: "online" }], jobs: [], approvalItems: [] }, error: null };
        if (body.action === "set-availability") {
          available = body.available === true;
          return { data: { worker: { id: workerId, availability: available ? "available" : "unavailable", status: "active" } }, error: null };
        }
        if (body.action === "heartbeat") return { data: { worker: { id: workerId, availability: "available", status: "active", last_heartbeat_at: new Date().toISOString() } }, error: null };
        if (body.action === "claim") {
          if (claimed) return { data: { job: null }, error: null };
          claimed = true;
          return { data: { job: { id: jobId, project_id: projectId, agent_id: agentId, worker_id: workerId, status: "leased", attempt_number: 1, workflow_id: "brand-social-campaign", workflow_revision: "v1", harness_revision: "1.0.0", harness_digest: packageDigest }, leaseToken: "lease-token" }, error: null };
        }
        if (body.action === "start" || body.action === "renew") return { data: body.action === "renew" ? { renewed: true } : { status: "running" }, error: null };
        if (body.action === "prepare-artifacts") return { data: { uploads: [{ artifactId: "55555555-5555-4555-8555-555555555555", path: "delivery/preview.png", token: "upload-token" }] }, error: null };
        if (body.action === "complete") {
          assert.equal(body.artifactIds.length, 1);
          assert.equal(body.evaluations.length, 2);
          completed = true;
          return { data: { status: "awaiting_creator_approval" }, error: null };
        }
        throw new Error(`Unexpected action: ${body.action}`);
      },
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "design-deliveries");
        return {
          async uploadToSignedUrl(path, token, bytes) {
            assert.equal(path, "delivery/preview.png");
            assert.equal(token, "upload-token");
            assert.ok(bytes.length > 0);
            uploaded = true;
            return { data: { path }, error: null };
          },
        };
      },
    },
  };
  const scheduled = new Set();
  const service = createCreatorWorkerService({
    getClient: () => client,
    getUser: () => ({ id: "creator-user" }),
    appVersion: "0.2.0",
    platform: "darwin",
    deviceName: "Smoke Mac",
    identityPath: join(tempRoot, "identity.bin"),
    protectSecret: async (value) => Buffer.from(value),
    unprotectSecret: async (value) => Buffer.from(value),
    executeJob: async () => ({
      artifacts: [{ path: artifactPath, kind: "preview", mimeType: "image/png" }],
      evaluations: [
        { evaluator: "worker_machine", verdict: "pass", scores: { completeness: 1 }, reasons: [] },
        { evaluator: "design_critic", verdict: "pass", scores: { fidelity: 0.8 }, reasons: [] },
      ],
      cleanup: async () => {},
    }),
    setTimer(fn, delay) {
      const timer = { unref() {} };
      scheduled.add(timer);
      if (delay === 0 || delay === 250) queueMicrotask(fn);
      return timer;
    },
    clearTimer(timer) { scheduled.delete(timer); },
  });
  await service.initialize();
  await service.setAvailable(true);
  for (let index = 0; index < 100 && !completed; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(uploaded, true);
  assert.equal(completed, true);
  assert.ok(invocations.includes("heartbeat"));
  assert.deepEqual(invocations.slice(0, 3), ["register", "state", "set-availability"]);
  await service.stop();
  console.log("Creator Worker smoke test passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
