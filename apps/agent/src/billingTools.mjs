import {
  createBillingService,
  createMockPaymentProvider,
  exampleHybridPricing,
} from "./billing.mjs";
import { defaultDbAgents } from "./dbAgentSource.mjs";

export function createBillingTools({
  currentUserId = process.env.HIREME_USER_ID || "local-dev-user",
  agents = defaultDbAgents(),
  paymentProvider = createMockPaymentProvider(),
  billingService,
} = {}) {
  const billing = billingService || createBillingService({ paymentProvider });
  const pricingFor = (agentId) => {
    const agent = agents.find((candidate) => candidate.id === agentId);
    if (!agent) throw new Error(`Billing Agent not found: ${agentId}`);
    return {
      agent,
      pricing: agent.marketplace?.billingPricing || exampleHybridPricing,
    };
  };
  const userIdFor = (args) => String(
    args.current_user_id || args.currentUserId || currentUserId,
  );

  return [
    {
      name: "hireme_quote_agent_run",
      description:
        "Create a safe example quote for local-protected or hosted-secure execution. This does not charge a payment method.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          execution_class: {
            type: "string",
            enum: ["local_protected", "hosted_secure"],
          },
          estimated_usage: usageSchema(),
          current_user_id: { type: "string" },
        },
        required: ["agent_id", "execution_class"],
      },
      handler: async (args = {}) => {
        const { pricing } = pricingFor(args.agent_id || args.agentId);
        return billing.quoteRun({
          agentId: args.agent_id || args.agentId,
          userId: userIdFor(args),
          executionClass: args.execution_class || args.executionClass,
          estimatedUsage: args.estimated_usage || args.estimatedUsage,
          pricing,
        });
      },
    },
    {
      name: "hireme_demo_authorize_agent_run",
      description:
        "Authorize an example Agent run through the mock payment provider. Accepts only an opaque mock payment token, never card data.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          execution_class: {
            type: "string",
            enum: ["local_protected", "hosted_secure"],
          },
          payment_method_id: { type: "string" },
          idempotency_key: { type: "string" },
          estimated_usage: usageSchema(),
          current_user_id: { type: "string" },
        },
        required: ["agent_id", "execution_class", "payment_method_id", "idempotency_key"],
      },
      handler: async (args = {}) => {
        const { pricing } = pricingFor(args.agent_id || args.agentId);
        return billing.authorizeRun({
          agentId: args.agent_id || args.agentId,
          userId: userIdFor(args),
          executionClass: args.execution_class || args.executionClass,
          estimatedUsage: args.estimated_usage || args.estimatedUsage,
          pricing,
          paymentMethodId: args.payment_method_id || args.paymentMethodId,
          idempotencyKey: args.idempotency_key || args.idempotencyKey,
        });
      },
    },
    {
      name: "hireme_demo_settle_agent_run",
      description:
        "Capture an authorized example Agent run at its fixed run price. Usage fields are telemetry only and never change the creator charge.",
      inputSchema: {
        type: "object",
        properties: {
          reservation_id: { type: "string" },
          idempotency_key: { type: "string" },
          actual_usage: usageSchema(),
        },
        required: ["reservation_id", "idempotency_key"],
      },
      handler: async (args = {}) => billing.settleRun({
        reservationId: args.reservation_id || args.reservationId,
        idempotencyKey: args.idempotency_key || args.idempotencyKey,
        actualUsage: args.actual_usage || args.actualUsage,
      }),
    },
    {
      name: "hireme_demo_cancel_agent_run",
      description: "Void an uncaptured example Agent run authorization.",
      inputSchema: {
        type: "object",
        properties: {
          reservation_id: { type: "string" },
          idempotency_key: { type: "string" },
          reason: { type: "string" },
        },
        required: ["reservation_id", "idempotency_key"],
      },
      handler: async (args = {}) => billing.cancelRun({
        reservationId: args.reservation_id || args.reservationId,
        idempotencyKey: args.idempotency_key || args.idempotencyKey,
        reason: args.reason,
      }),
    },
    {
      name: "hireme_demo_subscribe_agent",
      description:
        "Create an example monthly Agent subscription through the mock payment provider.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          payment_method_id: { type: "string" },
          idempotency_key: { type: "string" },
          current_user_id: { type: "string" },
        },
        required: ["agent_id", "payment_method_id", "idempotency_key"],
      },
      handler: async (args = {}) => {
        const { pricing } = pricingFor(args.agent_id || args.agentId);
        return billing.subscribe({
          agentId: args.agent_id || args.agentId,
          userId: userIdFor(args),
          pricing,
          paymentMethodId: args.payment_method_id || args.paymentMethodId,
          idempotencyKey: args.idempotency_key || args.idempotencyKey,
        });
      },
    },
    {
      name: "hireme_list_demo_billing_events",
      description:
        "List safe example billing events without card data, prompts, Harness content, or artifacts.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          current_user_id: { type: "string" },
        },
      },
      handler: async (args = {}) => billing.listEvents({
        userId: userIdFor(args),
        agentId: args.agent_id || args.agentId,
      }),
    },
  ];
}

function usageSchema() {
  return {
    type: "object",
    properties: {
      inputTokens: { type: "integer" },
      outputTokens: { type: "integer" },
      computeMs: { type: "integer" },
    },
  };
}
