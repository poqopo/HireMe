#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  decryptAgentPackage,
  encryptAgentPackage,
} from "../runtime/src/encryptedAgentPackageStore.mjs";
import { exportLocalSpecialistAgentPackage } from "../runtime/src/localSpecialistCreatorTools.mjs";

const tempRoot = await mkdtemp(join(tmpdir(), "hireme-encryption-smoke-"));
try {
  await exportLocalSpecialistAgentPackage({
    root: resolve("examples/local-specialist-agents"),
    workspaceRoot: tempRoot,
    agent_id: "dokpami-create-agent",
    output_path: "dokpami.hireme-agent.json",
    package_mode: "full",
    creator_id: "11111111-1111-4111-8111-111111111111",
    current_user_id: "11111111-1111-4111-8111-111111111111",
    overwrite: true,
  });
  const packageBytes = await readFile(join(tempRoot, "dokpami.hireme-agent.json"));
  const masterSecret = randomBytes(32).toString("base64");
  const encrypted = encryptAgentPackage({
    packageBytes,
    masterSecret,
    agentId: "dokpami-create-agent",
    agentVersion: "0.1.0",
  });
  const rawEnvelope = encrypted.bytes.toString("utf8");
  assert.ok(!rawEnvelope.includes("archiveBase64"));
  assert.ok(!rawEnvelope.includes("PRIVATE_HARNESS"));
  assert.ok(!rawEnvelope.includes("prompt_builder.py"));

  const decrypted = decryptAgentPackage({ envelopeBytes: encrypted.bytes, masterSecret });
  assert.deepEqual(decrypted.bytes, packageBytes);
  assert.equal(decrypted.package.agent.id, "dokpami-create-agent");
  assert.equal(decrypted.packageDigest, encrypted.packageDigest);

  const tampered = JSON.parse(rawEnvelope);
  const ciphertext = Buffer.from(tampered.ciphertext, "base64");
  ciphertext[Math.floor(ciphertext.length / 2)] ^= 1;
  tampered.ciphertext = ciphertext.toString("base64");
  assert.throws(
    () => decryptAgentPackage({
      envelopeBytes: Buffer.from(JSON.stringify(tampered)),
      masterSecret,
    }),
    /ciphertext digest mismatch/,
  );
  assert.throws(
    () => decryptAgentPackage({
      envelopeBytes: encrypted.bytes,
      masterSecret: randomBytes(32).toString("base64"),
    }),
    /authentication failed/,
  );

  packageBytes.fill(0);
  decrypted.bytes.fill(0);
  console.log("Encrypted Agent package smoke passed");
  console.log("Verified: full package -> AES-256-GCM -> no plaintext markers -> digest/authentication rejection");
} finally {
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}
