import assert from "node:assert/strict";
import { afterEach, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { registerBillingRouteTestHooks } from "./testDoubles/registerBillingRouteTestHooks";

registerBillingRouteTestHooks();

import { __setStripeEvent } from "./testDoubles/fakeStripe";
import {
  __failNextStripeStateOperation,
  __getStripeStateCalls,
  __resetFakeStripeState,
} from "./testDoubles/fakeStripeState";
import {
  createStripeStateService,
  type BillingStateRepository,
  type CheckoutSessionSnapshot,
  type StripeStateProvider,
  type StripeSubscriptionSnapshot,
} from "../../src/lib/billing/stripe-state";

const NOW = new Date("2026-07-28T20:00:00.000Z");
const FUTURE = new Date("2026-08-28T20:00:00.000Z");
const SESSION_ID = "cs_test_1234567890";
const MONTHLY_PRICE = "price_monthly";
const ORIGINAL_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let POST: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ POST } = await import("../../src/app/api/webhooks/stripe/route"));
});

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "test-webhook-secret";
  __resetFakeStripeState();
  __setStripeEvent({
    type: "checkout.session.completed",
    data: { object: { id: SESSION_ID } },
  });
});

afterEach(() => {
  if (ORIGINAL_WEBHOOK_SECRET === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    return;
  }

  process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK_SECRET;
});

function request(signature?: string): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : undefined,
    body: "{}",
  });
}

test("missing or invalid signatures produce no mutation", async () => {
  const missing = await POST(request());
  const invalid = await POST(request("invalid-signature"));

  assert.equal(missing.status, 400);
  assert.equal(invalid.status, 400);
  assert.deepEqual(__getStripeStateCalls(), []);
});

test("verified checkout and delayed-payment-success events use shared synchronization", async () => {
  const completed = await POST(request("valid-signature"));
  assert.equal(completed.status, 200);

  __setStripeEvent({
    type: "checkout.session.async_payment_succeeded",
    data: { object: { id: SESSION_ID } },
  });
  const delayed = await POST(request("valid-signature"));

  assert.equal(delayed.status, 200);
  assert.deepEqual(__getStripeStateCalls(), [
    { operation: "checkout", id: SESSION_ID },
    { operation: "checkout", id: SESSION_ID },
  ]);
  assert.equal((await delayed.text()).includes(SESSION_ID), false);
});

test("verified subscription update and deletion events use shared synchronization", async () => {
  __setStripeEvent({
    type: "customer.subscription.updated",
    data: { object: { id: "sub_123" } },
  });
  const updated = await POST(request("valid-signature"));

  __setStripeEvent({
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_123" } },
  });
  const deleted = await POST(request("valid-signature"));

  assert.equal(updated.status, 200);
  assert.equal(deleted.status, 200);
  assert.deepEqual(__getStripeStateCalls(), [
    { operation: "subscription.updated", id: "sub_123" },
    { operation: "subscription.deleted", id: "sub_123" },
  ]);
});

test("unsupported verified events are acknowledged without mutation", async () => {
  __setStripeEvent({
    type: "customer.created",
    data: { object: { id: "cus_123" } },
  });

  const response = await POST(request("valid-signature"));

  assert.equal(response.status, 200);
  assert.deepEqual(__getStripeStateCalls(), []);
});

test("supported-event processing failure returns non-success without protected identifiers", async () => {
  __failNextStripeStateOperation();

  const response = await POST(request("valid-signature"));
  const body = await response.text();

  assert.equal(response.status, 500);
  assert.equal(body.includes(SESSION_ID), false);
  assert.equal(body.includes("customer"), false);
});

type SavedState = Parameters<
  BillingStateRepository["updateSubscriptionByStripeId"]
>[1];

function subscriptionSnapshot(
  overrides: Partial<StripeSubscriptionSnapshot> = {}
): StripeSubscriptionSnapshot {
  return {
    id: "sub_monthly",
    customerId: "cus_monthly",
    status: "active",
    cancelAtPeriodEnd: false,
    items: [{ priceId: MONTHLY_PRICE, currentPeriodEnd: FUTURE }],
    itemsHaveMore: false,
    ...overrides,
  };
}

function checkoutSnapshot(
  overrides: Partial<CheckoutSessionSnapshot> = {}
): CheckoutSessionSnapshot {
  return {
    id: SESSION_ID,
    clientReferenceId: "user-1",
    customerId: "cus_monthly",
    subscriptionId: "sub_monthly",
    mode: "subscription",
    status: "complete",
    paymentStatus: "paid",
    lineItems: [{ priceId: MONTHLY_PRICE, quantity: 1 }],
    lineItemsHaveMore: false,
    ...overrides,
  };
}

function synchronizationHarness() {
  let checkout = checkoutSnapshot();
  let subscription = subscriptionSnapshot();
  let savedState: SavedState | null = null;
  let updateCount = 1;
  let checkoutUpserts = 0;

  const provider: StripeStateProvider = {
    async retrieveCheckoutSession() {
      return checkout;
    },
    async retrieveSubscription() {
      return subscription;
    },
  };
  const repository: BillingStateRepository = {
    async userExists() {
      return true;
    },
    async upsertSubscription(_userId, state) {
      checkoutUpserts += 1;
      savedState = { ...state };
      return {
        tier: state.tier,
        trialEndsAt: null,
        stripePriceId: state.stripePriceId,
        stripeStatus: state.stripeStatus,
        currentPeriodEnd: state.currentPeriodEnd,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      };
    },
    async updateSubscriptionByStripeId(_stripeSubscriptionId, state) {
      savedState = { ...state };
      return updateCount;
    },
  };

  return {
    service: createStripeStateService({
      provider,
      repository,
      prices: { monthly: MONTHLY_PRICE, lifetime: "price_lifetime" },
      now: () => NOW,
    }),
    setCheckout(value: CheckoutSessionSnapshot) {
      checkout = value;
    },
    setSubscription(value: StripeSubscriptionSnapshot) {
      subscription = value;
    },
    setUpdateCount(value: number) {
      updateCount = value;
    },
    savedState() {
      return savedState;
    },
    checkoutUpserts() {
      return checkoutUpserts;
    },
  };
}

test("completed-but-unpaid webhook checkout remains pending without mutation", async () => {
  const harness = synchronizationHarness();
  harness.setCheckout(checkoutSnapshot({ paymentStatus: "unpaid" }));

  const result = await harness.service.synchronizeCheckoutForWebhook(SESSION_ID);

  assert.deepEqual(result, { status: "pending" });
  assert.equal(harness.checkoutUpserts(), 0);
});

test("monthly updates grant only approved active/trialing unexpired state", async () => {
  const harness = synchronizationHarness();

  for (const status of ["active", "trialing"]) {
    await harness.service.synchronizeSubscriptionUpdated(
      subscriptionSnapshot({ status })
    );
    assert.equal(harness.savedState()?.tier, "MONTHLY", status);
  }

  for (const status of [
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
    "canceled",
    "future_status",
  ]) {
    await harness.service.synchronizeSubscriptionUpdated(
      subscriptionSnapshot({ status })
    );
    assert.equal(harness.savedState()?.tier, null, status);
  }
});

test("unknown price fails closed and a later qualifying update restores monthly", async () => {
  const harness = synchronizationHarness();

  await harness.service.synchronizeSubscriptionUpdated(
    subscriptionSnapshot({
      items: [{ priceId: "price_unknown", currentPeriodEnd: FUTURE }],
    })
  );
  assert.equal(harness.savedState()?.tier, null);

  await harness.service.synchronizeSubscriptionUpdated(subscriptionSnapshot());
  assert.equal(harness.savedState()?.tier, "MONTHLY");
});

test("subscription deletion cancels entitlement and duplicate delivery is idempotent", async () => {
  const harness = synchronizationHarness();
  const deleted = subscriptionSnapshot({ status: "canceled" });

  await harness.service.synchronizeSubscriptionDeleted(deleted);
  const first = harness.savedState();
  await harness.service.synchronizeSubscriptionDeleted(deleted);

  assert.deepEqual(harness.savedState(), first);
  assert.equal(harness.savedState()?.tier, "CANCELED");
  assert.equal(harness.savedState()?.stripeStatus, "canceled");
});

test("a missing local subscription match makes supported processing retryable", async () => {
  const harness = synchronizationHarness();
  harness.setUpdateCount(0);

  await assert.rejects(
    harness.service.synchronizeSubscriptionUpdated(subscriptionSnapshot()),
    /could not be synchronized/
  );
});
