import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const recordPath = process.argv[2] || ".hireme/artifacts/example-code-reviewer.public-record.json";
const publicRecord = JSON.parse(await readFile(resolve(recordPath), "utf8"));
const walrusPath = resolve(publicRecord.localWalrusPath);
const walrusPayload = await readFile(walrusPath, "utf8");
const encryptedObject = JSON.parse(walrusPayload);
const envelopeMetadata = encryptedObject.platform || encryptedObject.seal || {};
const blockedMarkers = [
  "AGENTS.md",
  "Private Operating Notes",
  "Hidden Scoring Criteria",
  "contentBase64",
];
const leakedMarkers = blockedMarkers.filter((marker) => walrusPayload.includes(marker));

console.log(
  JSON.stringify(
    {
      status: leakedMarkers.length === 0 ? "sealed_ciphertext_only" : "plaintext_marker_detected",
      recordPath,
      walrusPath,
      agentId: publicRecord.agentId,
      encryptionProvider: publicRecord.encryptionProvider || publicRecord.sealProvider || envelopeMetadata.provider || "unknown",
      platformKmsKeyId: publicRecord.platformKmsKeyId || envelopeMetadata.kmsKeyId || null,
      sealPackageId: publicRecord.sealPackageId || envelopeMetadata.packageId || null,
      sealApproveTarget: envelopeMetadata.sealApproveTarget || null,
      sealPolicyId: publicRecord.sealPolicyId,
      sealEncryptionId: publicRecord.sealEncryptionId,
      ciphertextFormat: publicRecord.ciphertextFormat || publicRecord.sealCiphertextFormat || encryptedObject.format,
      sealThreshold: publicRecord.sealThreshold || envelopeMetadata.threshold || null,
      sealKeyServerIds: publicRecord.sealKeyServerIds || envelopeMetadata.keyServerIds || [],
      ciphertextDigest: publicRecord.ciphertextDigest,
      plaintextStoredInWalrus: leakedMarkers.length > 0,
      leakedMarkers,
    },
    null,
    2,
  ),
);

if (leakedMarkers.length > 0) {
  process.exitCode = 1;
}
