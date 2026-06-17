import { readMemWalSnapshot } from "../apps/gateway/src/memWal.mjs";

const recordPath = process.argv[2] || ".hireme/memwal/example-code-reviewer.memwal-record.json";
const hireReceiptObjectId = process.argv[3] || "hire_receipt_local_paid_demo";

const result = await readMemWalSnapshot({
  recordPath,
  hireReceiptObjectId,
});

console.log(JSON.stringify(result, null, 2));
