import { selectExecutionPolicy } from "./executionPolicy.mjs";
import { callProtectedAgentRuntime } from "./protectedRuntimeTools.mjs";

export async function executePaidAgentRunExample({
  billingService,
  agent,
  task,
  userId,
  conversationId,
  paymentMethodId,
  idempotencyKey,
  estimatedUsage,
  actualUsage,
  stateRoot,
  prepareLocalLicense,
} = {}) {
  if (!billingService?.authorizeRun || !billingService?.settleRun) {
    throw new Error("billingService is required.");
  }
  if (!agent?.id) throw new Error("agent is required.");
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(String(idempotencyKey || ""))) {
    throw new Error("A stable idempotencyKey is required.");
  }
  const execution = selectExecutionPolicy({
    policy: agent.manifest?.execution,
    task,
  });
  const pricing = agent.marketplace?.billingPricing;
  if (!pricing) throw new Error(`Agent billing pricing is missing: ${agent.id}`);

  const reservation = await billingService.authorizeRun({
    agentId: agent.id,
    userId,
    executionClass: execution.executionClass,
    pricing,
    estimatedUsage,
    paymentMethodId,
    idempotencyKey: `${idempotencyKey}:authorize`,
  });

  let localLicense = null;
  try {
    if (execution.executionClass === "local_protected") {
      if (typeof prepareLocalLicense !== "function") {
        throw new Error("Local protected execution requires a device-bound package license.");
      }
      localLicense = await prepareLocalLicense({
        agent,
        userId,
        execution,
        reservation,
      });
      if (
        !localLicense?.licenseId ||
        localLicense.executionClass !== "local_protected" ||
        localLicense.userId !== userId ||
        localLicense.agentId !== agent.id
      ) {
        throw new Error("Local package license preparation failed.");
      }
    }

    const result = await callProtectedAgentRuntime({
      agents: [agent],
      stateRoot,
      agent_id: agent.id,
      task,
      conversation_id: conversationId,
      current_user_id: userId,
      execution_class: execution.executionClass,
      operation_id: execution.operationId,
    });
    if (result.status !== "completed") {
      const canceled = await billingService.cancelRun({
        reservationId: reservation.id,
        idempotencyKey: `${idempotencyKey}:cancel`,
        reason: `runtime_${result.status}`,
      });
      return { execution, reservation: canceled, result, localLicense };
    }
    const settled = await billingService.settleRun({
      reservationId: reservation.id,
      actualUsage,
      idempotencyKey: `${idempotencyKey}:settle`,
    });
    return { execution, reservation: settled, result, localLicense };
  } catch (error) {
    await billingService.cancelRun({
      reservationId: reservation.id,
      idempotencyKey: `${idempotencyKey}:cancel-error`,
      reason: "runtime_error_before_capture",
    }).catch(() => {});
    throw error;
  }
}
