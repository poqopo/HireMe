import { validateSealedArtifact } from "../apps/gateway/src/localSealedArtifact.mjs";

const recordPath = process.argv[2];
if (!recordPath) {
  console.error("Usage: node scripts/validate-protected-artifact.mjs <public-record.json> [hire-receipt-object-id]");
  process.exit(1);
}

const hireReceiptObjectId = process.argv[3] || "hire_receipt_local_paid_demo";

const result = await validateSealedArtifact({
  recordPath,
  hireReceiptObjectId,
});

console.log(JSON.stringify(result, null, 2));
