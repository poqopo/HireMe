import { readMemWalSnapshot } from "../apps/gateway/src/memWal.mjs";

const recordPath = process.argv[2];
if (!recordPath) {
  console.error("Usage: node scripts/read-memwal-snapshot.mjs <memwal-record.json> [hire-receipt-object-id]");
  process.exit(1);
}

const hireReceiptObjectId = process.argv[3] || "hire_receipt_local_paid_demo";

const result = await readMemWalSnapshot({
  recordPath,
  hireReceiptObjectId,
});

console.log(JSON.stringify(result, null, 2));
