import { randomUUID } from "node:crypto";

export const billingPricingSchema = "hireme.billing.pricing.v2";
export const billingQuoteSchema = "hireme.billing.run_quote.v1";
export const billingReservationSchema = "hireme.billing.run_reservation.v1";
export const billingSubscriptionSchema = "hireme.billing.subscription.v1";

const localProtected = "local_protected";
const hostedSecure = "hosted_secure";
const executionClasses = new Set([localProtected, hostedSecure]);

export const exampleHybridPricing = {
  schema: billingPricingSchema,
  currency: "USD",
  runPlans: {
    local_protected: {
      metering: "per_run",
      creatorBaseMinor: 250,
      platformFeeBps: 1200,
      providerCostResponsibility: "user",
    },
    hosted_secure: {
      metering: "per_run",
      creatorBaseMinor: 700,
      platformFeeBps: 1200,
      providerCostResponsibility: "user",
    },
  },
  subscription: {
    amountMinor: 2900,
    interval: "month",
    includedRuns: 100,
  },
};

export function createBillingService({
  paymentProvider = createMockPaymentProvider(),
  quoteTtlMs = 10 * 60 * 1000,
  now = () => Date.now(),
} = {}) {
  const reservations = new Map();
  const subscriptions = new Map();
  const idempotency = new Map();
  const events = [];

  const appendEvent = (type, payload = {}) => {
    const event = {
      schema: "hireme.billing.event.v1",
      id: randomUUID(),
      type,
      at: new Date(now()).toISOString(),
      ...payload,
    };
    events.push(event);
    return event;
  };

  const idempotent = async (scope, key, operation) => {
    const normalizedKey = requireIdempotencyKey(key);
    const storageKey = `${scope}:${normalizedKey}`;
    if (idempotency.has(storageKey)) return clone(idempotency.get(storageKey));
    const result = await operation(normalizedKey);
    idempotency.set(storageKey, clone(result));
    return clone(result);
  };

  return {
    quoteRun(input = {}) {
      const pricing = normalizePricing(input.pricing);
      const executionClass = requireExecutionClass(input.executionClass);
      const quote = buildRunQuote({
        agentId: input.agentId,
        userId: input.userId,
        executionClass,
        pricing,
        usage: input.estimatedUsage,
        quoteTtlMs,
        now: now(),
        estimated: true,
      });
      appendEvent("run.quoted", quoteEventMetadata(quote));
      return quote;
    },

    async authorizeRun(input = {}) {
      return idempotent("authorize", input.idempotencyKey, async (idempotencyKey) => {
        const pricing = normalizePricing(input.pricing);
        const executionClass = requireExecutionClass(input.executionClass);
        const quote = buildRunQuote({
          agentId: input.agentId,
          userId: input.userId,
          executionClass,
          pricing,
          usage: input.estimatedUsage,
          quoteTtlMs,
          now: now(),
          estimated: true,
        });
        const authorization = await paymentProvider.authorize({
          amountMinor: quote.authorizationMinor,
          currency: quote.currency,
          paymentMethodId: requirePaymentMethodId(input.paymentMethodId),
          idempotencyKey,
          metadata: safeProviderMetadata(quote),
        });
        const reservation = {
          schema: billingReservationSchema,
          id: randomUUID(),
          quote,
          agentId: quote.agentId,
          userId: quote.userId,
          executionClass,
          status: "authorized",
          authorizationId: authorization.id,
          authorizedMinor: authorization.amountMinor,
          capturedMinor: 0,
          refundedMinor: 0,
          currency: quote.currency,
          createdAt: new Date(now()).toISOString(),
          settledAt: null,
          canceledAt: null,
          pricing,
        };
        reservations.set(reservation.id, reservation);
        appendEvent("run.authorized", reservationEventMetadata(reservation));
        return publicReservation(reservation);
      });
    },

    async settleRun(input = {}) {
      const reservationId = requireUuid(input.reservationId, "reservationId");
      return idempotent(`settle:${reservationId}`, input.idempotencyKey, async (idempotencyKey) => {
        const reservation = requireReservation(reservations, reservationId);
        if (reservation.status === "captured") return publicReservation(reservation);
        if (reservation.status !== "authorized") {
          throw new Error(`Cannot settle reservation in ${reservation.status} state.`);
        }
        const finalQuote = buildRunQuote({
          agentId: reservation.agentId,
          userId: reservation.userId,
          executionClass: reservation.executionClass,
          pricing: reservation.pricing,
          usage: input.actualUsage,
          quoteTtlMs,
          now: now(),
          estimated: false,
        });
        if (finalQuote.totalMinor > reservation.authorizedMinor) {
          if (typeof paymentProvider.incrementAuthorization !== "function") {
            throw new Error("Final charge exceeds the authorized amount.");
          }
          const incremented = await paymentProvider.incrementAuthorization({
            authorizationId: reservation.authorizationId,
            amountMinor: finalQuote.totalMinor,
            idempotencyKey: `${idempotencyKey}:increment`,
          });
          reservation.authorizedMinor = incremented.amountMinor;
        }
        const capture = await paymentProvider.capture({
          authorizationId: reservation.authorizationId,
          amountMinor: finalQuote.totalMinor,
          idempotencyKey,
        });
        reservation.status = "captured";
        reservation.capturedMinor = capture.amountMinor;
        reservation.finalQuote = finalQuote;
        reservation.settledAt = new Date(now()).toISOString();
        appendEvent("run.captured", reservationEventMetadata(reservation));
        return publicReservation(reservation);
      });
    },

    async cancelRun(input = {}) {
      const reservationId = requireUuid(input.reservationId, "reservationId");
      return idempotent(`cancel:${reservationId}`, input.idempotencyKey, async (idempotencyKey) => {
        const reservation = requireReservation(reservations, reservationId);
        if (reservation.status === "voided") return publicReservation(reservation);
        if (reservation.status !== "authorized") {
          throw new Error(`Cannot cancel reservation in ${reservation.status} state.`);
        }
        await paymentProvider.voidAuthorization({
          authorizationId: reservation.authorizationId,
          idempotencyKey,
        });
        reservation.status = "voided";
        reservation.canceledAt = new Date(now()).toISOString();
        reservation.cancelReason = safeReason(input.reason);
        appendEvent("run.voided", reservationEventMetadata(reservation));
        return publicReservation(reservation);
      });
    },

    async refundRun(input = {}) {
      const reservationId = requireUuid(input.reservationId, "reservationId");
      return idempotent(`refund:${reservationId}`, input.idempotencyKey, async (idempotencyKey) => {
        const reservation = requireReservation(reservations, reservationId);
        if (reservation.status !== "captured" && reservation.status !== "partially_refunded") {
          throw new Error(`Cannot refund reservation in ${reservation.status} state.`);
        }
        const remaining = reservation.capturedMinor - reservation.refundedMinor;
        const amountMinor = input.amountMinor === undefined
          ? remaining
          : requireMinorAmount(input.amountMinor, "amountMinor", { allowZero: false });
        if (amountMinor > remaining) throw new Error("Refund exceeds the remaining captured amount.");
        const refund = await paymentProvider.refund({
          authorizationId: reservation.authorizationId,
          amountMinor,
          idempotencyKey,
        });
        reservation.refundedMinor += refund.amountMinor;
        reservation.status = reservation.refundedMinor === reservation.capturedMinor
          ? "refunded"
          : "partially_refunded";
        appendEvent("run.refunded", reservationEventMetadata(reservation));
        return publicReservation(reservation);
      });
    },

    quoteSubscription(input = {}) {
      return buildSubscriptionQuote({
        agentId: input.agentId,
        userId: input.userId,
        pricing: normalizePricing(input.pricing),
        now: now(),
      });
    },

    async subscribe(input = {}) {
      return idempotent("subscribe", input.idempotencyKey, async (idempotencyKey) => {
        const quote = buildSubscriptionQuote({
          agentId: input.agentId,
          userId: input.userId,
          pricing: normalizePricing(input.pricing),
          now: now(),
        });
        const providerSubscription = await paymentProvider.createSubscription({
          amountMinor: quote.amountMinor,
          currency: quote.currency,
          interval: quote.interval,
          paymentMethodId: requirePaymentMethodId(input.paymentMethodId),
          idempotencyKey,
          metadata: {
            agentId: quote.agentId,
            userId: quote.userId,
          },
        });
        const subscription = {
          ...quote,
          schema: billingSubscriptionSchema,
          id: randomUUID(),
          providerSubscriptionId: providerSubscription.id,
          status: "active",
          createdAt: new Date(now()).toISOString(),
        };
        subscriptions.set(subscription.id, subscription);
        appendEvent("subscription.created", subscriptionEventMetadata(subscription));
        return clone(subscription);
      });
    },

    listEvents({ userId, agentId } = {}) {
      return {
        schema: "hireme.billing.event_list.v1",
        events: events
          .filter((event) => !userId || event.userId === userId)
          .filter((event) => !agentId || event.agentId === agentId)
          .map(clone),
        privacyBoundary:
          "Billing events contain opaque payment references and safe usage totals only; no card data, raw prompts, Harness content, or artifacts are stored.",
      };
    },

    getReservation(id) {
      return publicReservation(requireReservation(reservations, id));
    },

    paymentProvider,
  };
}

export function createMockPaymentProvider() {
  const authorizations = new Map();
  const subscriptions = new Map();
  const idempotency = new Map();
  const events = [];

  const once = async (scope, key, operation) => {
    const storageKey = `${scope}:${requireIdempotencyKey(key)}`;
    if (idempotency.has(storageKey)) return clone(idempotency.get(storageKey));
    const result = await operation();
    idempotency.set(storageKey, clone(result));
    return clone(result);
  };

  return {
    name: "mock_payment_provider",

    authorize(input) {
      return once("authorize", input.idempotencyKey, async () => {
        if (String(input.paymentMethodId).includes("declined")) {
          throw Object.assign(new Error("Mock payment method was declined."), {
            code: "payment_declined",
          });
        }
        const authorization = {
          id: `auth_${randomUUID()}`,
          status: "authorized",
          amountMinor: requireMinorAmount(input.amountMinor, "amountMinor"),
          capturedMinor: 0,
          refundedMinor: 0,
          currency: requireCurrency(input.currency),
          paymentMethodRef: requirePaymentMethodId(input.paymentMethodId),
        };
        authorizations.set(authorization.id, authorization);
        events.push({ type: "authorized", authorizationId: authorization.id });
        return authorization;
      });
    },

    incrementAuthorization(input) {
      return once(`increment:${input.authorizationId}`, input.idempotencyKey, async () => {
        const authorization = requireAuthorization(authorizations, input.authorizationId);
        if (authorization.status !== "authorized") throw new Error("Authorization cannot be incremented.");
        const amountMinor = requireMinorAmount(input.amountMinor, "amountMinor");
        if (amountMinor < authorization.amountMinor) throw new Error("Authorization increment cannot reduce amount.");
        authorization.amountMinor = amountMinor;
        events.push({ type: "authorization_incremented", authorizationId: authorization.id });
        return authorization;
      });
    },

    capture(input) {
      return once(`capture:${input.authorizationId}`, input.idempotencyKey, async () => {
        const authorization = requireAuthorization(authorizations, input.authorizationId);
        if (authorization.status === "captured") return authorization;
        if (authorization.status !== "authorized") throw new Error("Authorization cannot be captured.");
        const amountMinor = requireMinorAmount(input.amountMinor, "amountMinor");
        if (amountMinor > authorization.amountMinor) throw new Error("Capture exceeds authorization.");
        authorization.status = "captured";
        authorization.capturedMinor = amountMinor;
        events.push({ type: "captured", authorizationId: authorization.id });
        return { ...authorization, amountMinor };
      });
    },

    voidAuthorization(input) {
      return once(`void:${input.authorizationId}`, input.idempotencyKey, async () => {
        const authorization = requireAuthorization(authorizations, input.authorizationId);
        if (authorization.status === "voided") return authorization;
        if (authorization.status !== "authorized") throw new Error("Authorization cannot be voided.");
        authorization.status = "voided";
        events.push({ type: "voided", authorizationId: authorization.id });
        return authorization;
      });
    },

    refund(input) {
      return once(`refund:${input.authorizationId}`, input.idempotencyKey, async () => {
        const authorization = requireAuthorization(authorizations, input.authorizationId);
        if (authorization.status !== "captured") throw new Error("Authorization cannot be refunded.");
        const amountMinor = requireMinorAmount(input.amountMinor, "amountMinor", { allowZero: false });
        if (authorization.refundedMinor + amountMinor > authorization.capturedMinor) {
          throw new Error("Refund exceeds captured amount.");
        }
        authorization.refundedMinor += amountMinor;
        events.push({ type: "refunded", authorizationId: authorization.id });
        return { id: `refund_${randomUUID()}`, amountMinor };
      });
    },

    createSubscription(input) {
      return once("subscription", input.idempotencyKey, async () => {
        if (String(input.paymentMethodId).includes("declined")) {
          throw Object.assign(new Error("Mock payment method was declined."), {
            code: "payment_declined",
          });
        }
        const subscription = {
          id: `sub_${randomUUID()}`,
          status: "active",
          amountMinor: requireMinorAmount(input.amountMinor, "amountMinor"),
          currency: requireCurrency(input.currency),
          interval: requireInterval(input.interval),
        };
        subscriptions.set(subscription.id, subscription);
        events.push({ type: "subscription_created", subscriptionId: subscription.id });
        return subscription;
      });
    },

    inspect() {
      return {
        authorizations: [...authorizations.values()].map(clone),
        subscriptions: [...subscriptions.values()].map(clone),
        events: events.map(clone),
      };
    },
  };
}

function buildRunQuote({
  agentId,
  userId,
  executionClass,
  pricing,
  usage,
  quoteTtlMs,
  now,
  estimated,
}) {
  const plan = pricing.runPlans[executionClass];
  if (!plan) throw new Error(`No pricing plan for ${executionClass}.`);
  const normalizedUsage = normalizeUsage(usage);
  const creatorRunMinor = plan.creatorBaseMinor;
  const creatorEarningsMinor = creatorRunMinor;
  const platformFeeMinor = basisPointCharge(creatorEarningsMinor, plan.platformFeeBps);
  const totalMinor = safeAdd(creatorEarningsMinor, platformFeeMinor);
  const authorizationMinor = totalMinor;
  return {
    schema: billingQuoteSchema,
    id: randomUUID(),
    agentId: requireAgentId(agentId),
    userId: requirePrincipal(userId, "userId"),
    executionClass,
    metering: plan.metering,
    estimated: estimated === true,
    currency: pricing.currency,
    usageTelemetry: normalizedUsage,
    components: {
      creatorRunMinor,
      platformFeeMinor,
    },
    creatorEarningsMinor,
    platformRevenueMinor: platformFeeMinor,
    passThroughCostMinor: 0,
    totalMinor,
    authorizationMinor,
    providerCostResponsibility: plan.providerCostResponsibility,
    userProviderChargedSeparately: true,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + quoteTtlMs).toISOString(),
  };
}

function buildSubscriptionQuote({ agentId, userId, pricing, now }) {
  const plan = pricing.subscription;
  if (!plan) throw new Error("Agent does not offer a subscription plan.");
  return {
    schema: "hireme.billing.subscription_quote.v1",
    agentId: requireAgentId(agentId),
    userId: requirePrincipal(userId, "userId"),
    amountMinor: plan.amountMinor,
    currency: pricing.currency,
    interval: plan.interval,
    includedRuns: plan.includedRuns,
    createdAt: new Date(now).toISOString(),
  };
}

function normalizePricing(value) {
  const pricing = value && typeof value === "object" ? value : exampleHybridPricing;
  if (pricing.schema !== billingPricingSchema) throw new Error(`pricing.schema must be ${billingPricingSchema}.`);
  const currency = requireCurrency(pricing.currency);
  const local = normalizeRunPlan(pricing.runPlans?.local_protected, localProtected);
  const hosted = normalizeRunPlan(pricing.runPlans?.hosted_secure, hostedSecure);
  const subscription = pricing.subscription
    ? {
        amountMinor: requireMinorAmount(pricing.subscription.amountMinor, "subscription.amountMinor"),
        interval: requireInterval(pricing.subscription.interval),
        includedRuns: requireNonNegativeInteger(
          pricing.subscription.includedRuns,
          "subscription.includedRuns",
        ),
      }
    : null;
  return {
    schema: billingPricingSchema,
    currency,
    runPlans: {
      local_protected: local,
      hosted_secure: hosted,
    },
    subscription,
  };
}

function normalizeRunPlan(value, executionClass) {
  if (!value || typeof value !== "object") throw new Error(`Missing ${executionClass} run plan.`);
  const expectedMetering = "per_run";
  if (value.metering !== expectedMetering) {
    throw new Error(`${executionClass} metering must be ${expectedMetering}.`);
  }
  if (
    [
      value.creatorInputPerMillionMinor,
      value.creatorOutputPerMillionMinor,
      value.modelInputPerMillionMinor,
      value.modelOutputPerMillionMinor,
      value.computePerMinuteMinor,
    ].some((rate) => Number(rate || 0) !== 0)
  ) {
    throw new Error("Per-run Agent pricing cannot include token or compute rates.");
  }
  return {
    metering: expectedMetering,
    creatorBaseMinor: requireMinorAmount(value.creatorBaseMinor, "creatorBaseMinor"),
    platformFeeBps: requireBasisPoints(value.platformFeeBps),
    providerCostResponsibility: "user",
  };
}

function publicReservation(reservation) {
  const result = {
    schema: reservation.schema,
    id: reservation.id,
    quote: reservation.quote,
    agentId: reservation.agentId,
    userId: reservation.userId,
    executionClass: reservation.executionClass,
    status: reservation.status,
    authorizationId: reservation.authorizationId,
    authorizedMinor: reservation.authorizedMinor,
    capturedMinor: reservation.capturedMinor,
    refundedMinor: reservation.refundedMinor,
    currency: reservation.currency,
    createdAt: reservation.createdAt,
    settledAt: reservation.settledAt,
    canceledAt: reservation.canceledAt,
  };
  if (reservation.finalQuote) result.finalQuote = reservation.finalQuote;
  if (reservation.cancelReason) result.cancelReason = reservation.cancelReason;
  return clone(result);
}

function quoteEventMetadata(quote) {
  return {
    agentId: quote.agentId,
    userId: quote.userId,
    executionClass: quote.executionClass,
    currency: quote.currency,
    amountMinor: quote.totalMinor,
  };
}

function reservationEventMetadata(reservation) {
  return {
    reservationId: reservation.id,
    agentId: reservation.agentId,
    userId: reservation.userId,
    executionClass: reservation.executionClass,
    currency: reservation.currency,
    status: reservation.status,
    authorizedMinor: reservation.authorizedMinor,
    capturedMinor: reservation.capturedMinor,
    refundedMinor: reservation.refundedMinor,
  };
}

function subscriptionEventMetadata(subscription) {
  return {
    subscriptionId: subscription.id,
    agentId: subscription.agentId,
    userId: subscription.userId,
    currency: subscription.currency,
    amountMinor: subscription.amountMinor,
    status: subscription.status,
  };
}

function safeProviderMetadata(quote) {
  return {
    quoteId: quote.id,
    agentId: quote.agentId,
    userId: quote.userId,
    executionClass: quote.executionClass,
  };
}

function normalizeUsage(value = {}) {
  return {
    inputTokens: requireNonNegativeInteger(value.inputTokens || 0, "inputTokens"),
    outputTokens: requireNonNegativeInteger(value.outputTokens || 0, "outputTokens"),
    computeMs: requireNonNegativeInteger(value.computeMs || 0, "computeMs"),
  };
}

function basisPointCharge(amountMinor, basisPoints) {
  if (!amountMinor || !basisPoints) return 0;
  const result = (BigInt(amountMinor) * BigInt(basisPoints) + 9_999n) / 10_000n;
  return safeBigIntToNumber(result, "basis point charge");
}

function safeAdd(...values) {
  return safeBigIntToNumber(
    values.reduce((sum, value) => sum + BigInt(value || 0), 0n),
    "money total",
  );
}

function safeBigIntToNumber(value, name) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${name} exceeds safe integer range.`);
  return Number(value);
}

function requireReservation(store, value) {
  const id = requireUuid(value, "reservationId");
  const reservation = store.get(id);
  if (!reservation) throw new Error(`Billing reservation not found: ${id}`);
  return reservation;
}

function requireAuthorization(store, id) {
  const authorization = store.get(String(id || ""));
  if (!authorization) throw new Error(`Mock authorization not found: ${id}`);
  return authorization;
}

function requireExecutionClass(value) {
  const normalized = String(value || "").trim();
  if (!executionClasses.has(normalized)) throw new Error(`Unsupported execution class: ${value}`);
  return normalized;
}

function requireMinorAmount(value, name, { allowZero = true } = {}) {
  const number = Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`${name} must be an integer minor-unit amount of at least ${minimum}.`);
  }
  return number;
}

function requireNonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${name} must be a non-negative integer.`);
  return number;
}

function requireBasisPoints(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 10_000) {
    throw new Error("platformFeeBps must be between 0 and 10000.");
  }
  return number;
}

function requireCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a three-letter code.");
  return currency;
}

function requireInterval(value) {
  const interval = String(value || "").trim().toLowerCase();
  if (!["month", "year"].includes(interval)) throw new Error("interval must be month or year.");
  return interval;
}

function requireAgentId(value) {
  const id = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(id)) throw new Error("agentId is invalid.");
  return id;
}

function requirePrincipal(value, name) {
  const principal = String(value || "").trim().slice(0, 160);
  if (!principal || /[\u0000-\u001f]/.test(principal)) throw new Error(`${name} is invalid.`);
  return principal;
}

function requirePaymentMethodId(value) {
  const id = String(value || "").trim();
  if (!/^pm_[A-Za-z0-9_-]{3,120}$/.test(id)) {
    throw new Error("paymentMethodId must be an opaque payment-provider token.");
  }
  return id;
}

function requireIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(key)) throw new Error("A stable idempotencyKey is required.");
  return key;
}

function requireUuid(value, name) {
  const id = String(value || "").trim();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) {
    throw new Error(`${name} must be a UUID.`);
  }
  return id;
}

function safeReason(value) {
  return String(value || "canceled_before_execution").replace(/[\u0000-\u001f]/g, "").slice(0, 160);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
