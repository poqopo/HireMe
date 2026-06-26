import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const suiPath = process.env.SUI_CLI_PATH || "sui";
const packagePath = process.argv[2] || "move/hireme";
const outputPath = process.env.HIREME_SUI_PACKAGE_RECORD || ".hireme/sui/hireme-package.json";
const gasBudget = process.env.SUI_PUBLISH_GAS_BUDGET;
const pubfilePath = process.env.SUI_PUBLISH_PUBFILE_PATH || process.env.SUI_PUBFILE_PATH;
const buildEnv = process.env.SUI_PUBLISH_BUILD_ENV || process.env.SUI_BUILD_ENV;

const args = ["client", pubfilePath ? "test-publish" : "publish", packagePath, "--json"];
if (gasBudget) {
  args.push("--gas-budget", gasBudget);
}
if (pubfilePath) {
  args.push("--pubfile-path", pubfilePath);
}
if (buildEnv) {
  args.push("--build-env", buildEnv);
}

const result = spawnSync(suiPath, args, {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

let publishResult;
try {
  publishResult = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(result.stdout);
  throw new Error(`Failed to parse sui publish JSON output: ${error.message}`);
}

const packageId = publishResult.objectChanges?.find(
  (change) => change.type === "published" && change.packageId,
)?.packageId;

if (!packageId) {
  throw new Error("Sui publish output did not include a published packageId");
}

const record = {
  schema: "hireme.sui_package_publish.v1",
  packageId,
  packagePath,
  network: process.env.SUI_NETWORK || null,
  activeEnv: readStringResult([suiPath, "client", "active-env"]),
  activeAddress: readStringResult([suiPath, "client", "active-address"]),
  sealApproveTarget: `${packageId}::access::seal_approve`,
  createWalletTarget: `${packageId}::access::create_wallet`,
  createWalletForOwnerTarget: `${packageId}::access::create_wallet_for_owner`,
  depositWalletTarget: `${packageId}::access::deposit_wallet`,
  withdrawAvailableTarget: `${packageId}::access::withdraw_available`,
  createAgentTarget: `${packageId}::access::create_agent`,
  publishAgentVersionTarget: `${packageId}::access::publish_agent_version`,
  registerProtectedArtifactTarget: `${packageId}::access::register_protected_artifact`,
  hireAgentTarget: `${packageId}::access::hire_agent`,
  openCallEscrowTarget: `${packageId}::access::open_call_escrow`,
  settleCallEscrowTarget: `${packageId}::access::settle_call_escrow`,
  cancelCallEscrowTarget: `${packageId}::access::cancel_call_escrow`,
  expireCallEscrowTarget: `${packageId}::access::expire_call_escrow`,
  claimEarningsTarget: `${packageId}::access::claim_earnings`,
  packageVersionObjectId: findCreatedObjectId(publishResult, "PackageVersion"),
  packageVersionCapObjectId: findCreatedObjectId(publishResult, "PackageVersionCap"),
  settlementAdminCapObjectId: findCreatedObjectId(publishResult, "SettlementAdminCap"),
  digest: publishResult.digest,
  publishedAt: new Date().toISOString(),
};

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, JSON.stringify(record, null, 2));

console.log(
  JSON.stringify(
    {
      status: "published",
      packageId,
      outputPath,
      env: {
        HIREME_SUI_PACKAGE_ID: packageId,
        HIREME_SEAL_PACKAGE_ID: packageId,
        HIREME_SEAL_APPROVE_TARGET: record.sealApproveTarget,
        HIREME_SETTLEMENT_ADMIN_CAP_ID: record.settlementAdminCapObjectId,
        HIREME_CREATE_WALLET_FOR_OWNER_TARGET: record.createWalletForOwnerTarget,
      },
      objects: {
        packageVersionObjectId: record.packageVersionObjectId,
        packageVersionCapObjectId: record.packageVersionCapObjectId,
        settlementAdminCapObjectId: record.settlementAdminCapObjectId,
      },
      targets: {
        createWalletTarget: record.createWalletTarget,
        createWalletForOwnerTarget: record.createWalletForOwnerTarget,
        depositWalletTarget: record.depositWalletTarget,
        openCallEscrowTarget: record.openCallEscrowTarget,
        settleCallEscrowTarget: record.settleCallEscrowTarget,
        claimEarningsTarget: record.claimEarningsTarget,
      },
    },
    null,
    2,
  ),
);

function findCreatedObjectId(publishResult, typeName) {
  return publishResult.objectChanges?.find(
    (change) =>
      change.type === "created" &&
      typeof change.objectType === "string" &&
      change.objectType.endsWith(`::access::${typeName}`),
  )?.objectId || null;
}

function readStringResult(command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}
