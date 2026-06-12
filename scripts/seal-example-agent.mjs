import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sealAgentFolder } from "../server/gateway/localSealedArtifact.mjs";

const folderPath = process.argv[2] || "examples/code-reviewer-agent";
const publicProfile = JSON.parse(await readFile(join(folderPath, "public.json"), "utf8"));

const sealed = await sealAgentFolder({
  folderPath,
  agentId: publicProfile.agentId,
  pricePerCallUsd: publicProfile.pricePerCallUsd,
  epochs: Number.parseInt(process.env.HIREME_EXAMPLE_STORAGE_EPOCHS || "3", 10),
});

console.log(
  JSON.stringify(
    {
      status: sealed.status,
      recordPath: sealed.recordPath,
      walrusPath: sealed.walrusPath,
      publicRecord: {
        agentId: sealed.publicRecord.agentId,
        encryptionProvider: sealed.publicRecord.encryptionProvider,
        platformKmsKeyId: sealed.publicRecord.platformKmsKeyId,
        sealPackageId: sealed.publicRecord.sealPackageId,
        sealPolicyId: sealed.publicRecord.sealPolicyId,
        sealEncryptionId: sealed.publicRecord.sealEncryptionId,
        ciphertextFormat: sealed.publicRecord.ciphertextFormat,
        sealThreshold: sealed.publicRecord.sealThreshold,
        sealKeyServerIds: sealed.publicRecord.sealKeyServerIds,
        walrusBlobId: sealed.publicRecord.walrusBlobId,
        walrusSuiObjectId: sealed.publicRecord.walrusSuiObjectId,
        ciphertextDigest: sealed.publicRecord.ciphertextDigest,
        folderManifestDigest: sealed.publicRecord.folderManifestDigest,
        plaintextStoredInDb: sealed.publicRecord.plaintextStoredInDb,
      },
    },
    null,
    2,
  ),
);
