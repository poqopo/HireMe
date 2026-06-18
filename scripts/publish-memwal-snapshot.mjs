import { publishMemWalSnapshot } from "../apps/gateway/src/memWal.mjs";

const memoryPath = process.argv[2];
const agentId = process.argv[3] || process.env.HIREME_MEMWAL_AGENT_ID;
if (!memoryPath || !agentId) {
  console.error("Usage: node scripts/publish-memwal-snapshot.mjs <memory.json> <agent-id>");
  process.exit(1);
}

const result = await publishMemWalSnapshot({
  agentId,
  memoryPath,
  epochs: Number.parseInt(process.env.HIREME_MEMWAL_STORAGE_EPOCHS || "3", 10),
  uploadToWalrus: process.env.HIREME_MEMWAL_LOCAL_ONLY !== "1",
});

console.log(
  JSON.stringify(
    {
      status: result.status,
      recordPath: result.recordPath,
      localCiphertextPath: result.localCiphertextPath,
      publicRecord: {
        agentId: result.publicRecord.agentId,
        kind: result.publicRecord.kind,
        storageProvider: result.publicRecord.storageProvider,
        encryptionProvider: result.publicRecord.encryptionProvider,
        platformKmsKeyId: result.publicRecord.platformKmsKeyId,
        walrusBlobId: result.publicRecord.walrusBlobId || null,
        walrusSuiObjectId: result.publicRecord.walrusSuiObjectId || null,
        ciphertextDigest: result.publicRecord.ciphertextDigest,
        memoryDigest: result.publicRecord.memoryDigest,
        plaintextStoredInDb: result.publicRecord.plaintextStoredInDb,
      },
    },
    null,
    2,
  ),
);
