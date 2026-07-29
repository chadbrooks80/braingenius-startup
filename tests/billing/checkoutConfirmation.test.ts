import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  createStripeStateService,
  type BillingStateRepository,
  type CheckoutSessionSnapshot,
  type StripeStateProvider,
  type StripeSubscriptionSnapshot,
} from "../../src/lib/billing/stripe-state";

const NOW = new Date("2026-07-28T20:00:00.000Z");
const FUTURE = new Date("2026-08-28T20:00:00.000Z");
const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const SESSION_ID = "cs_test_1234567890";
const MONTHLY_PRICE = "price_monthly";
const LIFETIME_PRICE = "price_lifetime";

type SavedState = Parameters<BillingStateRepository["upsertSubscription"]>[1];

let checkout: CheckoutSessionSnapshot;
let subscription: StripeSubscriptionSnapshot;
let providerFailure = false;
let databaseFailure = false;
let providerCalls = 0;
let savedState: SavedState | null;
let upsertCount = 0;
let users: Set<string>;

const provider: StripeStateProvider = {
  async retrieveCheckoutSession() {
    providerCalls += 1;
    if (providerFailure) throw new Error("simulated provider failure");
    return checkout;
  },
  async retrieveSubscription() {
    if (providerFailure) throw new Error("simulated provider failure");
    return subscription;
  },
};

const repository: BillingStateRepository = {
  async userExists(userId) {
    if (databaseFailure) throw new Error("simulated database failure");
    return users.has(userId);
  },
  async upsertSubscription(_userId, state) {
    if (databaseFailure) throw new Error("simulated database failure");
    savedState = { ...state };
    upsertCount += 1;
    return {
      tier: state.tier,
      trialEndsAt: null,
      stripePriceId: state.stripePriceId,
      stripeStatus: state.stripeStatus,
      currentPeriodEnd: state.currentPeriodEnd,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    };
  },
  async updateSubscriptionByStripeId() {
    throw new Error("not used by checkout confirmation tests");
  },
};

function validCheckout(
  overrides: Partial<CheckoutSessionSnapshot> = {}
): CheckoutSessionSnapshot {
  return {
    id: SESSION_ID,
    clientReferenceId: USER_ID,
    customerId: "cus_checkout",
    subscriptionId: "sub_monthly",
    mode: "subscription",
    status: "complete",
    paymentStatus: "paid",
    lineItems: [{ priceId: MONTHLY_PRICE, quantity: 1 }],
    lineItemsHaveMore: false,
    ...overrides,
  };
}

function validSubscription(
  overrides: Partial<StripeSubscriptionSnapshot> = {}
): StripeSubscriptionSnapshot {
  return {
    id: "sub_monthly",
    customerId: "cus_checkout",
    status: "active",
    cancelAtPeriodEnd: false,
    items: [{ priceId: MONTHLY_PRICE, currentPeriodEnd: FUTURE }],
    itemsHaveMore: false,
    ...overrides,
  };
}

function service() {
  return createStripeStateService({
    provider,
    repository,
    prices: { monthly: MONTHLY_PRICE, lifetime: LIFETIME_PRICE },
    now: () => NOW,
  });
}

beforeEach(() => {
  checkout = validCheckout();
  subscription = validSubscription();
  providerFailure = false;
  databaseFailure = false;
  providerCalls = 0;
  savedState = null;
  upsertCount = 0;
  users = new Set([USER_ID, OTHER_USER_ID]);
});

test("malformed checkout IDs reject before a Stripe call", async () => {
  const result = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: "not-a-checkout-session",
    userId: USER_ID,
  });

  assert.deepEqual(result, { status: "rejected" });
  assert.equal(providerCalls, 0);
  assert.equal(savedState, null);
});

test("a checkout owned by another user rejects without mutation", async () => {
  checkout = validCheckout({ clientReferenceId: OTHER_USER_ID });

  const result = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });

  assert.deepEqual(result, { status: "rejected" });
  assert.equal(savedState, null);
});

test("a missing local user rejects without mutation", async () => {
  users.clear();

  const result = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });

  assert.deepEqual(result, { status: "rejected" });
  assert.equal(savedState, null);
});

test("invalid checkout and subscription shapes fail closed", async () => {
  const cases: ReadonlyArray<{
    name: string;
    checkout?: Partial<CheckoutSessionSnapshot>;
    subscription?: Partial<StripeSubscriptionSnapshot>;
  }> = [
    { name: "unknown price", checkout: { lineItems: [{ priceId: "price_unknown", quantity: 1 }] } },
    { name: "wrong mode", checkout: { mode: "payment" } },
    { name: "wrong quantity", checkout: { lineItems: [{ priceId: MONTHLY_PRICE, quantity: 2 }] } },
    { name: "multiple line items", checkout: { lineItemsHaveMore: true } },
    { name: "incomplete checkout", checkout: { status: "open" } },
    { name: "no confirmed payment", checkout: { paymentStatus: "no_payment_required" } },
    { name: "missing monthly subscription", checkout: { subscriptionId: null } },
    { name: "subscription price mismatch", subscription: { items: [{ priceId: LIFETIME_PRICE, currentPeriodEnd: FUTURE }] } },
    { name: "subscription customer mismatch", subscription: { customerId: "cus_other" } },
  ];

  for (const entry of cases) {
    checkout = validCheckout(entry.checkout);
    subscription = validSubscription(entry.subscription);
    savedState = null;

    const result = await service().confirmPaidCheckoutForUser({
      checkoutSessionId: SESSION_ID,
      userId: USER_ID,
    });

    assert.deepEqual(result, { status: "rejected" }, entry.name);
    assert.equal(savedState, null, `${entry.name} must not mutate`);
  }
});

test("a paid lifetime checkout persists one-time state and confirms idempotently", async () => {
  checkout = validCheckout({
    subscriptionId: null,
    mode: "payment",
    lineItems: [{ priceId: LIFETIME_PRICE, quantity: 1 }],
  });

  const first = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });
  const repeated = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });

  assert.deepEqual(first, { status: "confirmed", plan: "LIFETIME" });
  assert.deepEqual(repeated, { status: "confirmed", plan: "LIFETIME" });
  assert.equal(upsertCount, 2);
  assert.deepEqual(savedState, {
    tier: "LIFETIME",
    stripeCustomerId: "cus_checkout",
    stripeSubscriptionId: null,
    stripePriceId: LIFETIME_PRICE,
    stripeStatus: "paid",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
});

test("a paid monthly checkout persists actual lifecycle state and confirms", async () => {
  subscription = validSubscription({
    status: "trialing",
    cancelAtPeriodEnd: true,
  });

  const result = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });

  assert.deepEqual(result, { status: "confirmed", plan: "MONTHLY" });
  assert.deepEqual(savedState, {
    tier: "MONTHLY",
    stripeCustomerId: "cus_checkout",
    stripeSubscriptionId: "sub_monthly",
    stripePriceId: MONTHLY_PRICE,
    stripeStatus: "trialing",
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: true,
  });
});

test("inactive monthly state is persisted fail-closed and does not confirm", async () => {
  subscription = validSubscription({ status: "past_due" });

  const result = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });

  assert.deepEqual(result, { status: "rejected" });
  assert.equal(savedState?.tier, null);
  assert.equal(savedState?.stripeStatus, "past_due");
});

test("delayed payment stays pending and can confirm after Stripe reports paid", async () => {
  checkout = validCheckout({ paymentStatus: "unpaid" });

  const pending = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });
  assert.deepEqual(pending, { status: "pending" });
  assert.equal(savedState, null);

  checkout = validCheckout({ paymentStatus: "paid" });
  const confirmed = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });
  assert.deepEqual(confirmed, { status: "confirmed", plan: "MONTHLY" });
});

test("Stripe and database failures return safe pending state without fake success", async () => {
  providerFailure = true;
  const providerResult = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });
  assert.deepEqual(providerResult, { status: "pending" });

  providerFailure = false;
  databaseFailure = true;
  const databaseResult = await service().confirmPaidCheckoutForUser({
    checkoutSessionId: SESSION_ID,
    userId: USER_ID,
  });
  assert.deepEqual(databaseResult, { status: "pending" });
  assert.equal(savedState, null);
});
