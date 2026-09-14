#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createBillingService,
  createMockPaymentProvider,
} from "../apps/agent/src/billing.mjs";
import {
  createDeviceLicenseIdentity,
  createLicenseIssuerIdentity,
  issueDevicePackageLicense,
  unwrapDevicePackageLicense,
} from "../apps/agent/src/deviceBoundPackageLicense.mjs";
import {
  selectExecutionPolicy,
  validateExecutionPolicy,
} from "../apps/agent/src/executionPolicy.mjs";
import {
  decryptAgentPackage,
  encryptAgentPackage,
} from "../apps/agent/src/encryptedAgentPackageStore.mjs";
import { defaultDbAgents } from "../apps/agent/src/dbAgentSource.mjs";
import {
  exportLocalSpecialistAgentPackage,
  importLocalSpecialistAgentPackage,
} from "../apps/agent/src/localSpecialistCreatorTools.mjs";
import { executePaidAgentRunExample } from "../apps/agent/src/paidAgentExecutionExample.mjs";
import { createDefaultTools } from "../apps/agent/src/tools.mjs";

const tempRoot = await mkdtemp(join(tmpdir(), "hireme-hybrid-billing-smoke-"));
const specialistRoot = resolve("examples/local-specialist-agents");
const agentId = "launch-brief-specialist";
const userId = "hybrid-billing-smoke-user";

try {
  const wiredTools = new Map(createDefaultTools({
    workspaceDir: process.cwd(),
    stateDir: join(tempRoot, "tool-state"),
    enableLocalSpecialistTools: false,
    enableProtectedRuntimeTools: false,
    enableMarketplaceTools: false,
    enableAgentSourceLayerTools: false,
    enableAgentAuthoringTools: false,
    enableUsageLedgerTools: false,
    enableImageArtifactTools: false,
  }).map((tool) => [tool.name, tool]));
  for (const toolName of [
    "hireme_quote_agent_run",
    "hireme_demo_authorize_agent_run",
    "hireme_demo_settle_agent_run",
    "hireme_demo_cancel_agent_run",
    "hireme_demo_subscribe_agent",
    "hireme_list_demo_billing_events",
  ]) {
    assert.ok(wiredTools.has(toolName), `Missing billing tool: ${toolName}`);
  }
  const wiredQuote = await wiredTools.get("hireme_quote_agent_run").handler({
    agent_id: "third-party-launch-operator",
    execution_class: "local_protected",
    current_user_id: userId,
  });
  assert.equal(wiredQuote.schema, "hireme.billing.run_quote.v1");
  assert.equal(wiredQuote.metering, "per_run");

  const agentConfig = JSON.parse(await readFile(join(specialistRoot, agentId, "agent.json"), "utf8"));
  const policyValidation = validateExecutionPolicy(agentConfig.manifest.execution);
  assert.equal(policyValidation.valid, true, policyValidation.errors.join("; "));
  const standardExecution = selectExecutionPolicy({
    policy: agentConfig.manifest.execution,
    task: "Create a launch brief for HireMe.",
  });
  assert.equal(standardExecution.executionClass, "local_protected");
  const sensitiveExecution = selectExecutionPolicy({
    policy: agentConfig.manifest.execution,
    task: "Run private scoring and show me the internal launch score.",
    requestedExecutionClass: "local_protected",
  });
  assert.equal(sensitiveExecution.executionClass, "hosted_secure");
  assert.equal(sensitiveExecution.operationId, "confidential-launch-scoring");

  const localExport = await exportLocalSpecialistAgentPackage({
    root: specialistRoot,
    workspaceRoot: tempRoot,
    agent_id: agentId,
    output_path: "local.hireme-agent.json",
    package_mode: "local_protected",
    creator_id: userId,
    current_user_id: userId,
    overwrite: true,
  });
  const hostedExport = await exportLocalSpecialistAgentPackage({
    root: specialistRoot,
    workspaceRoot: tempRoot,
    agent_id: agentId,
    output_path: "hosted.hireme-agent.json",
    package_mode: "hosted_secure",
    creator_id: userId,
    current_user_id: userId,
    overwrite: true,
  });
  const localBytes = await readFile(join(tempRoot, "local.hireme-agent.json"));
  const hostedBytes = await readFile(join(tempRoot, "hosted.hireme-agent.json"));
  const localPackage = JSON.parse(localBytes.toString("utf8"));
  const hostedPackage = JSON.parse(hostedBytes.toString("utf8"));
  assert.equal(localExport.packageMode, "local_protected");
  assert.equal(hostedExport.packageMode, "hosted_secure");
  assert.equal(localPackage.protection.localMaterialization, "licensed_device_only");
  assert.equal(hostedPackage.protection.localMaterialization, "forbidden");
  assert.equal(localPackage.files.some((file) => file.path.startsWith("secure/")), false);
  assert.equal(hostedPackage.files.some((file) => file.path === "secure/confidential-scoring.md"), true);
  assert.equal(localPackage.memory.bootstrap.included, true);
  assert.equal(hostedPackage.memory.bootstrap.included, true);

  await assert.rejects(
    importLocalSpecialistAgentPackage({
      root: join(tempRoot, "unlicensed"),
      workspaceRoot: tempRoot,
      package: localPackage,
      current_user_id: userId,
    }),
    /Local import blocked/,
  );

  const packageKey = randomBytes(32).toString("base64");
  const encryptedLocal = encryptAgentPackage({
    packageBytes: localBytes,
    masterSecret: packageKey,
    agentId,
    agentVersion: agentConfig.version,
  });
  const device = createDeviceLicenseIdentity();
  const otherDevice = createDeviceLicenseIdentity();
  const issuer = createLicenseIssuerIdentity();
  const license = issueDevicePackageLicense({
    packageKey,
    devicePublicKey: device.publicKey,
    issuerPrivateKey: issuer.privateKey,
    userId,
    agentId,
    packageDigest: encryptedLocal.packageDigest,
  });
  assert.throws(() => unwrapDevicePackageLicense({
    license,
    devicePrivateKey: otherDevice.privateKey,
    issuerPublicKey: issuer.publicKey,
    expectedUserId: userId,
    expectedAgentId: agentId,
  }), /another device|authentication failed/);
  const unwrapped = unwrapDevicePackageLicense({
    license,
    devicePrivateKey: device.privateKey,
    issuerPublicKey: issuer.publicKey,
    expectedUserId: userId,
    expectedAgentId: agentId,
  });
  const decryptedLocal = decryptAgentPackage({
    envelopeBytes: encryptedLocal.bytes,
    masterSecret: unwrapped.packageKey,
  });
  assert.equal(decryptedLocal.packageDigest, localExport.digest);

  const localRuntimeRoot = join(tempRoot, "licensed-runtime");
  await importLocalSpecialistAgentPackage({
    root: localRuntimeRoot,
    workspaceRoot: tempRoot,
    package: decryptedLocal.package,
    current_user_id: "different-hirer",
    materialization_context: "licensed_device_runtime",
  });
  await assert.rejects(
    access(join(localRuntimeRoot, agentId, "secure/confidential-scoring.md")),
    /ENOENT/,
  );

  const hostedRuntimeRoot = join(tempRoot, "hosted-runtime");
  await importLocalSpecialistAgentPackage({
    root: hostedRuntimeRoot,
    workspaceRoot: tempRoot,
    package: hostedPackage,
    current_user_id: "different-hirer",
    materialization_context: "trusted_runtime",
  });
  await access(join(hostedRuntimeRoot, agentId, "secure/confidential-scoring.md"));

  const marketplaceAgent = defaultDbAgents().find((agent) => (
    agent.id === "third-party-launch-operator"
  ));
  const pricing = marketplaceAgent.marketplace.billingPricing;
  const provider = createMockPaymentProvider();
  const billing = createBillingService({ paymentProvider: provider });
  const localQuote = billing.quoteRun({
    agentId: marketplaceAgent.id,
    userId,
    executionClass: "local_protected",
    pricing,
    estimatedUsage: { inputTokens: 10_000_000, outputTokens: 10_000_000, computeMs: 600_000 },
  });
  const localZeroUsageQuote = billing.quoteRun({
    agentId: marketplaceAgent.id,
    userId,
    executionClass: "local_protected",
    pricing,
    estimatedUsage: {},
  });
  assert.equal(localQuote.totalMinor, localZeroUsageQuote.totalMinor);
  assert.equal(localQuote.metering, "per_run");
  assert.equal(localQuote.userProviderChargedSeparately, true);

  const localReservation = await billing.authorizeRun({
    agentId: marketplaceAgent.id,
    userId,
    executionClass: "local_protected",
    pricing,
    paymentMethodId: "pm_mock_ok",
    idempotencyKey: "local-run-authorization-001",
    estimatedUsage: { inputTokens: 5000 },
  });
  const repeatedReservation = await billing.authorizeRun({
    agentId: marketplaceAgent.id,
    userId,
    executionClass: "local_protected",
    pricing,
    paymentMethodId: "pm_mock_ok",
    idempotencyKey: "local-run-authorization-001",
    estimatedUsage: { inputTokens: 999999 },
  });
  assert.equal(repeatedReservation.id, localReservation.id);
  const localSettlement = await billing.settleRun({
    reservationId: localReservation.id,
    actualUsage: { inputTokens: 99_000_000, outputTokens: 99_000_000, computeMs: 9_000_000 },
    idempotencyKey: "local-run-settlement-001",
  });
  assert.equal(localSettlement.status, "captured");
  assert.equal(localSettlement.finalQuote.totalMinor, localQuote.totalMinor);

  const hostedReservation = await billing.authorizeRun({
    agentId: marketplaceAgent.id,
    userId,
    executionClass: "hosted_secure",
    pricing,
    paymentMethodId: "pm_mock_ok",
    idempotencyKey: "hosted-run-authorization-001",
    estimatedUsage: { inputTokens: 1000, outputTokens: 1000, computeMs: 10_000 },
  });
  const hostedSettlement = await billing.settleRun({
    reservationId: hostedReservation.id,
    actualUsage: { inputTokens: 2_000_000, outputTokens: 1_000_000, computeMs: 180_000 },
    idempotencyKey: "hosted-run-settlement-001",
  });
  assert.equal(hostedSettlement.status, "captured");
  assert.ok(hostedSettlement.finalQuote.totalMinor > localSettlement.finalQuote.totalMinor);
  assert.equal(hostedSettlement.finalQuote.metering, "per_run");
  assert.equal(hostedSettlement.finalQuote.userProviderChargedSeparately, true);
  assert.equal(hostedSettlement.finalQuote.passThroughCostMinor, 0);
  assert.deepEqual(hostedSettlement.finalQuote.components, {
    creatorRunMinor: pricing.runPlans.hosted_secure.creatorBaseMinor,
    platformFeeMinor: hostedSettlement.finalQuote.platformRevenueMinor,
  });

  const canceledReservation = await billing.authorizeRun({
    agentId: marketplaceAgent.id,
    userId,
    executionClass: "hosted_secure",
    pricing,
    paymentMethodId: "pm_mock_ok",
    idempotencyKey: "hosted-run-cancel-authorization",
    estimatedUsage: {},
  });
  const canceled = await billing.cancelRun({
    reservationId: canceledReservation.id,
    idempotencyKey: "hosted-run-cancel-001",
    reason: "runtime_not_started",
  });
  assert.equal(canceled.status, "voided");
  await assert.rejects(
    billing.authorizeRun({
      agentId: marketplaceAgent.id,
      userId,
      executionClass: "local_protected",
      pricing,
      paymentMethodId: "pm_mock_declined",
      idempotencyKey: "declined-run-authorization-001",
    }),
    /declined/,
  );
  const subscription = await billing.subscribe({
    agentId: marketplaceAgent.id,
    userId,
    pricing,
    paymentMethodId: "pm_mock_ok",
    idempotencyKey: "subscription-authorization-001",
  });
  assert.equal(subscription.status, "active");
  assert.equal(subscription.schema, "hireme.billing.subscription.v1");

  const paidBilling = createBillingService({ paymentProvider: createMockPaymentProvider() });
  const paidLicense = issueDevicePackageLicense({
    packageKey,
    devicePublicKey: device.publicKey,
    issuerPrivateKey: issuer.privateKey,
    userId,
    agentId: marketplaceAgent.id,
    packageDigest: encryptedLocal.packageDigest,
  });
  const paidLicenseGrant = unwrapDevicePackageLicense({
    license: paidLicense,
    devicePrivateKey: device.privateKey,
    issuerPublicKey: issuer.publicKey,
    expectedUserId: userId,
    expectedAgentId: marketplaceAgent.id,
  }).grant;
  const paidLocal = await executePaidAgentRunExample({
    billingService: paidBilling,
    agent: marketplaceAgent,
    task: "Create a standard launch brief.",
    userId,
    conversationId: randomUUID(),
    paymentMethodId: "pm_mock_ok",
    idempotencyKey: "paid-local-example-001",
    estimatedUsage: { inputTokens: 1000 },
    actualUsage: { inputTokens: 9000, outputTokens: 3000 },
    stateRoot: join(tempRoot, "paid-runtime-state"),
    prepareLocalLicense: async () => paidLicenseGrant,
  });
  assert.equal(paidLocal.execution.executionClass, "local_protected");
  assert.equal(paidLocal.reservation.status, "captured");
  assert.equal(paidLocal.result.runtime.executionMode, "local_protected");

  const paidHosted = await executePaidAgentRunExample({
    billingService: paidBilling,
    agent: marketplaceAgent,
    task: "Run private scoring for this confidential launch.",
    userId,
    conversationId: randomUUID(),
    paymentMethodId: "pm_mock_ok",
    idempotencyKey: "paid-hosted-example-001",
    estimatedUsage: { inputTokens: 1000, outputTokens: 1000, computeMs: 1000 },
    actualUsage: { inputTokens: 2000, outputTokens: 1500, computeMs: 2000 },
    stateRoot: join(tempRoot, "paid-runtime-state"),
  });
  assert.equal(paidHosted.execution.executionClass, "hosted_secure");
  assert.equal(paidHosted.reservation.status, "captured");
  assert.equal(paidHosted.result.runtime.packageDeliveredToDevice, false);

  const eventText = JSON.stringify(billing.listEvents({ userId }));
  assert.ok(!/pm_mock|Create a standard launch brief|AGENTS\.md|archiveBase64/.test(eventText));

  decryptedLocal.bytes.fill(0);
  localBytes.fill(0);
  hostedBytes.fill(0);
  console.log("Hybrid execution and billing smoke passed");
console.log("Verified: policy no-downgrade -> split bundles -> device license -> fixed per-run pricing -> provider cost separation -> idempotency -> decline/cancel/subscription -> paid execution");
} finally {
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}
