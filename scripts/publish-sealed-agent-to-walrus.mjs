import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sealAgentFolder } from "../apps/gateway/src/localSealedArtifact.mjs";
import { storeFileOnWalrus } from "../apps/gateway/src/walrusBlobStore.mjs";

const folderPath = process.argv[2] || "examples/code-reviewer-agent";
const publicProfile = JSON.parse(await readFile(join(folderPath, "public.json"), "utf8"));
const epochs = Number.parseInt(process.env.HIREME_EXAMPLE_STORAGE_EPOCHS || "3", 10);

const sealed = await sealAgentFolder({
  folderPath,
  agentId: publicProfile.agentId,
  pricePerCallUsd: publicProfile.pricePerCallUsd,
  epochs,
});

const encryptedBytes = await readFile(sealed.walrusPath);
const upload = await storeFileOnWalrus({
  filePath: sealed.walrusPath,
  epochs,
});

const publicRecord = {
  ...sealed.publicRecord,
  storageProvider: "walrus",
  storageNetwork: process.env.WALRUS_NETWORK || process.env.WALRUS_CONTEXT || "testnet",
  walrusBlobId: upload.blobId,
  walrusSuiObjectId: upload.suiObjectId,
  ciphertextDigest: `sha256:${sha256Hex(encryptedBytes)}`,
  ciphertextSizeBytes: encryptedBytes.length,
  localWalrusPath: sealed.walrusPath,
  localWalrusPathIsCache: true,
  walrusStoreResult: upload.result,
  walrusUploadedAt: new Date().toISOString(),
};

await writeFile(sealed.recordPath, JSON.stringify(publicRecord, null, 2));

console.log(
  JSON.stringify(
    {
      status: "encrypted_and_uploaded",
      agentId: publicRecord.agentId,
      recordPath: sealed.recordPath,
      localCiphertextPath: sealed.walrusPath,
      encryption: {
        provider: publicRecord.encryptionProvider || publicRecord.sealProvider,
        platformKmsKeyId: publicRecord.platformKmsKeyId,
        policyId: publicRecord.policyId || publicRecord.sealPolicyId,
        optionalSealPackageId: publicRecord.sealPackageId,
        optionalSealApproveTarget: publicRecord.sealApproveTarget || null,
        encryptionId: publicRecord.sealEncryptionId,
        threshold: publicRecord.sealThreshold,
        keyServerIds: publicRecord.sealKeyServerIds,
      },
      walrus: {
        blobId: publicRecord.walrusBlobId,
        suiObjectId: publicRecord.walrusSuiObjectId,
        storageNetwork: publicRecord.storageNetwork,
        epochs: publicRecord.storageEpochs,
      },
      ciphertext: {
        digest: publicRecord.ciphertextDigest,
        sizeBytes: publicRecord.ciphertextSizeBytes,
        plaintextStoredInWalrus: false,
      },
      next: {
        validateThroughGateway:
          `node scripts/validate-protected-artifact.mjs ${sealed.recordPath}`,
        callThroughGateway:
          `hireme_call_agent agent_id=${publicRecord.agentId} hire_receipt_object_id=hire_receipt_local_paid_demo`,
      },
    },
    null,
    2,
  ),
);

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
