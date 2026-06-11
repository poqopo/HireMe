import { validateSealedArtifact } from "../server/gateway/localSealedArtifact.mjs";

const recordPath =
  process.argv[2] || ".hireme/artifacts/example-code-reviewer.public-record.json";
const hireReceiptObjectId = process.argv[3] || "hire_receipt_local_paid_demo";

const result = await validateSealedArtifact({
  recordPath,
  hireReceiptObjectId,
});

console.log(JSON.stringify(result, null, 2));
